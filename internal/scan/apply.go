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
