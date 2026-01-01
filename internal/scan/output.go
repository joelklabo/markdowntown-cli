// Package scan provides registry loading and file matching helpers.
package scan

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

// OutputOptions controls output metadata.
type OutputOptions struct {
	SchemaVersion   string
	RegistryVersion string
	ToolVersion     string
	RepoRoot        string
	ScanStartedAt   int64
	GeneratedAt     int64
	Timing          Timing
}

// BuildOutput assembles the final scan output with deterministic ordering.
func BuildOutput(result Result, opts OutputOptions) Output {
	configs := append([]ConfigEntry(nil), result.Entries...)
	for i := range configs {
		sortTools(configs[i].Tools)
	}
	sortConfigs(configs)

	warnings := append([]Warning(nil), result.Warnings...)
	warnings = append(warnings, conflictWarnings(configs, result.Scans)...)

	return Output{
		SchemaVersion:   opts.SchemaVersion,
		RegistryVersion: opts.RegistryVersion,
		ToolVersion:     opts.ToolVersion,
		ScanStartedAt:   opts.ScanStartedAt,
		GeneratedAt:     opts.GeneratedAt,
		Timing:          opts.Timing,
		RepoRoot:        opts.RepoRoot,
		Scans:           result.Scans,
		Configs:         configs,
		Warnings:        warnings,
	}
}

func sortConfigs(configs []ConfigEntry) {
	sort.SliceStable(configs, func(i, j int) bool {
		left := configs[i]
		right := configs[j]
		if scopeRank(left.Scope) != scopeRank(right.Scope) {
			return scopeRank(left.Scope) < scopeRank(right.Scope)
		}
		if left.Depth != right.Depth {
			return left.Depth < right.Depth
		}
		return sortPathKey(left.Path) < sortPathKey(right.Path)
	})
}

func sortPathKey(path string) string {
	return filepath.ToSlash(path)
}

func scopeRank(scope string) int {
	switch scope {
	case "repo":
		return 0
	case "user":
		return 1
	case "global":
		return 2
	default:
		return 3
	}
}

type conflictKey struct {
	toolID string
	scope  string
	kind   string
	root   string
}

type conflictGroup struct {
	entries   []ConfigEntry
	hasSingle bool
	hasMulti  bool
}

func conflictWarnings(configs []ConfigEntry, scans []Root) []Warning {
	groups := make(map[conflictKey]*conflictGroup)
	for _, entry := range configs {
		root := rootForEntry(entry, scans)
		for _, tool := range entry.Tools {
			key := conflictKey{
				toolID: tool.ToolID,
				scope:  entry.Scope,
				kind:   tool.Kind,
				root:   root,
			}
			group := groups[key]
			if group == nil {
				group = &conflictGroup{}
				groups[key] = group
			}
			group.entries = append(group.entries, entry)
			if isMultiFileLoadBehavior(tool.LoadBehavior) {
				group.hasMulti = true
			} else {
				group.hasSingle = true
			}
		}
	}

	var warnings []Warning
	for key, group := range groups {
		if group.hasMulti && !group.hasSingle {
			continue
		}
		paths := conflictPaths(group.entries, key.root)
		if len(paths) <= 1 {
			continue
		}
		if isAgentsOverridePair(paths) {
			continue
		}
		sort.Strings(paths)
		warningPath := key.root
		if warningPath == "" && len(group.entries) > 0 {
			warningPath = group.entries[0].Path
		}
		warnings = append(warnings, Warning{
			Path:    warningPath,
			Code:    "CONFIG_CONFLICT",
			Message: fmt.Sprintf("%s has conflicting configs: %s", key.toolID, strings.Join(paths, ", ")),
		})
	}

	sort.SliceStable(warnings, func(i, j int) bool {
		leftPath := sortPathKey(warnings[i].Path)
		rightPath := sortPathKey(warnings[j].Path)
		if leftPath != rightPath {
			return leftPath < rightPath
		}
		if warnings[i].Code != warnings[j].Code {
			return warnings[i].Code < warnings[j].Code
		}
		return warnings[i].Message < warnings[j].Message
	})

	return warnings
}

func conflictPaths(entries []ConfigEntry, root string) []string {
	seen := make(map[string]struct{})
	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		path := entry.Path
		if root != "" && isWithinRoot(entry.Path, root) {
			if rel, err := filepath.Rel(root, entry.Path); err == nil && rel != "." {
				path = rel
			}
		}
		path = filepath.ToSlash(path)
		if _, ok := seen[path]; ok {
			continue
		}
		seen[path] = struct{}{}
		paths = append(paths, path)
	}
	return paths
}

func isAgentsOverridePair(paths []string) bool {
	if len(paths) != 2 {
		return false
	}
	dirA := filepath.Dir(paths[0])
	dirB := filepath.Dir(paths[1])
	if dirA != dirB {
		return false
	}
	baseA := strings.ToLower(filepath.Base(paths[0]))
	baseB := strings.ToLower(filepath.Base(paths[1]))
	return (baseA == "agents.md" && baseB == "agents.override.md") ||
		(baseA == "agents.override.md" && baseB == "agents.md")
}

func isMultiFileLoadBehavior(loadBehavior string) bool {
	switch loadBehavior {
	case "directory-glob", "all-ancestors", "nearest-ancestor":
		return true
	default:
		return false
	}
}

func rootForEntry(entry ConfigEntry, scans []Root) string {
	var fallback string
	var best string
	for _, scan := range scans {
		if scan.Scope != entry.Scope {
			continue
		}
		if fallback == "" {
			fallback = scan.Root
		}
		if isWithinRoot(entry.Path, scan.Root) && len(scan.Root) > len(best) {
			best = scan.Root
		}
	}
	if best != "" {
		return best
	}
	return fallback
}
