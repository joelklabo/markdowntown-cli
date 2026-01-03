package scan

import (
	"path/filepath"
	"sort"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
)

// FilterForFile returns a new Result containing only configs applicable to the target file.
func FilterForFile(result Result, targetPath string) Result {
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return Result{
			Scans:    result.Scans,
			Warnings: result.Warnings,
		}
	}
	if resolved, err := filepath.EvalSymlinks(absTarget); err == nil {
		absTarget = resolved
	}
	absTarget = filepath.Clean(absTarget)

	type toolOccurrence struct {
		entryIndex int
		toolIndex  int
	}

	// Group by ToolID+Kind
	groups := make(map[string][]toolOccurrence)

	for i := range result.Entries {
		entry := &result.Entries[i]
		for j := range entry.Tools {
			tool := &entry.Tools[j]
			key := tool.ToolID + ":" + tool.Kind
			groups[key] = append(groups[key], toolOccurrence{
				entryIndex: i,
				toolIndex:  j,
			})
		}
	}

	kept := make(map[int]map[int]bool)

	for _, occurrences := range groups {
		var applicable []toolOccurrence
		for _, occ := range occurrences {
			entry := &result.Entries[occ.entryIndex]
			tool := &entry.Tools[occ.toolIndex]

			if isApplicable(tool, entry, absTarget) {
				applicable = append(applicable, occ)
			}
		}

		byBehavior := make(map[string][]toolOccurrence)
		for _, occ := range applicable {
			entry := &result.Entries[occ.entryIndex]
			tool := &entry.Tools[occ.toolIndex]
			byBehavior[tool.LoadBehavior] = append(byBehavior[tool.LoadBehavior], occ)
		}

		for behavior, occs := range byBehavior {
			switch behavior {
			case "nearest-ancestor":
				// Pick deepset depth (closest to target)
				sort.Slice(occs, func(i, j int) bool {
					return result.Entries[occs[i].entryIndex].Depth > result.Entries[occs[j].entryIndex].Depth
				})
				if len(occs) > 0 {
					markKept(kept, occs[0])
				}
			default:
				for _, occ := range occs {
					markKept(kept, occ)
				}
			}
		}
	}

	var newEntries []ConfigEntry
	for i := range result.Entries {
		entry := result.Entries[i]
		if toolMap, ok := kept[i]; ok {
			var newTools []ToolEntry
			for j, tool := range entry.Tools {
				if toolMap[j] {
					newTools = append(newTools, tool)
				}
			}
			if len(newTools) > 0 {
				entry.Tools = newTools
				newEntries = append(newEntries, entry)
			}
		}
	}

	return Result{
		Scans:    result.Scans,
		Entries:  newEntries,
		Warnings: result.Warnings,
	}
}

// EntryForPath returns the config entry matching the provided path.
func EntryForPath(result Result, targetPath string) *ConfigEntry {
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return nil
	}
	absTarget = filepath.Clean(absTarget)
	resolvedTarget := absTarget
	if resolved, err := filepath.EvalSymlinks(absTarget); err == nil {
		resolvedTarget = filepath.Clean(resolved)
	}

	for i := range result.Entries {
		entry := &result.Entries[i]
		if samePath(entry.Path, absTarget) || samePath(entry.Path, resolvedTarget) ||
			samePath(entry.Resolved, absTarget) || samePath(entry.Resolved, resolvedTarget) {
			return entry
		}
	}

	return nil
}

// ShadowingEntry returns the higher-precedence entry that shadows targetPath, if any.
func ShadowingEntry(result Result, targetPath string) (*ConfigEntry, *ToolEntry) {
	entry := EntryForPath(result, targetPath)
	if entry == nil || len(entry.Tools) == 0 {
		return nil, nil
	}

	for _, tool := range entry.Tools {
		if override := overrideEntryForTool(result, entry, tool); override != nil {
			return override, &tool
		}
	}

	entryRank := scopeRank(entry.Scope)
	var best *ConfigEntry
	var bestTool *ToolEntry
	bestRank := int(^uint(0) >> 1)
	bestKey := ""

	for _, tool := range entry.Tools {
		if isMultiFileLoadBehavior(tool.LoadBehavior) {
			continue
		}
		for i := range result.Entries {
			other := &result.Entries[i]
			if sameEntry(entry, other) {
				continue
			}
			if scopeRank(other.Scope) >= entryRank {
				continue
			}
			if !entryHasTool(other, tool) {
				continue
			}
			rank := scopeRank(other.Scope)
			key := sortPathKey(other.Path)
			if best == nil || rank < bestRank || (rank == bestRank && key < bestKey) {
				best = other
				bestTool = &tool
				bestRank = rank
				bestKey = key
			}
		}
	}

	return best, bestTool
}

func markKept(kept map[int]map[int]bool, occ struct{ entryIndex, toolIndex int }) {
	if kept[occ.entryIndex] == nil {
		kept[occ.entryIndex] = make(map[int]bool)
	}
	kept[occ.entryIndex][occ.toolIndex] = true
}

func isApplicable(tool *ToolEntry, entry *ConfigEntry, absTarget string) bool {
	switch tool.LoadBehavior {
	case "single":
		return true
	case "nearest-ancestor", "all-ancestors":
		configDir := filepath.Dir(entry.Path)
		targetDir := filepath.Dir(absTarget)
		return isAncestorDir(configDir, targetDir)
	case "directory-glob":
		switch tool.Application {
		case "pattern-matched":
			if tool.ApplicationField == "" {
				return false
			}
			val, ok := entry.Frontmatter[tool.ApplicationField]
			if !ok {
				return false
			}
			glob, ok := val.(string)
			if !ok {
				return false
			}
			configDir := filepath.Dir(entry.Path)
			rel, err := filepath.Rel(configDir, absTarget)
			if err != nil {
				return false
			}
			rel = filepath.ToSlash(rel)
			matched, _ := doublestar.Match(glob, rel)
			return matched
		default:
			return true
		}
	default:
		return true
	}
}

func isAncestorDir(ancestor, child string) bool {
	if ancestor == child {
		return true
	}
	rel, err := filepath.Rel(ancestor, child)
	if err != nil {
		return false
	}
	return !strings.HasPrefix(rel, "..")
}

func sameEntry(left *ConfigEntry, right *ConfigEntry) bool {
	if left == nil || right == nil {
		return false
	}
	if samePath(left.Path, right.Path) {
		return true
	}
	if left.Resolved != "" && samePath(left.Resolved, right.Path) {
		return true
	}
	if right.Resolved != "" && samePath(left.Path, right.Resolved) {
		return true
	}
	return left.Resolved != "" && right.Resolved != "" && samePath(left.Resolved, right.Resolved)
}

func samePath(left string, right string) bool {
	if left == "" || right == "" {
		return false
	}
	return filepath.Clean(left) == filepath.Clean(right)
}

func entryHasTool(entry *ConfigEntry, tool ToolEntry) bool {
	for _, candidate := range entry.Tools {
		if candidate.ToolID == tool.ToolID && candidate.Kind == tool.Kind {
			return true
		}
	}
	return false
}

func overrideEntryForTool(result Result, entry *ConfigEntry, tool ToolEntry) *ConfigEntry {
	if entry == nil {
		return nil
	}
	if !isAgentsBase(entry.Path) {
		return nil
	}
	entryDir := filepath.Dir(entry.Path)
	for i := range result.Entries {
		other := &result.Entries[i]
		if other == nil || sameEntry(entry, other) {
			continue
		}
		if !isAgentsOverride(other.Path) {
			continue
		}
		if filepath.Dir(other.Path) != entryDir {
			continue
		}
		if !entryHasTool(other, tool) {
			continue
		}
		return other
	}
	return nil
}

func isAgentsBase(path string) bool {
	return strings.EqualFold(filepath.Base(path), "agents.md")
}

func isAgentsOverride(path string) bool {
	return strings.EqualFold(filepath.Base(path), "agents.override.md")
}
