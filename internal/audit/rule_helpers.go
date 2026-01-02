package audit

import (
	"path/filepath"
	"sort"
	"strings"

	"markdowntown-cli/internal/scan"
)

type toolKindKey struct {
	ToolID string
	Kind   string
}

type conflictKey struct {
	Scope  string
	ToolID string
	Kind   string
}

func toolsForEntry(entry scan.ConfigEntry) []Tool {
	seen := make(map[toolKindKey]struct{})
	tools := make([]Tool, 0, len(entry.Tools))
	for _, tool := range entry.Tools {
		key := toolKindKey{ToolID: tool.ToolID, Kind: tool.Kind}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		tools = append(tools, Tool{ToolID: tool.ToolID, Kind: tool.Kind})
	}
	return tools
}

func sortStringUnique(values []string) []string {
	seen := make(map[string]struct{})
	unique := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		unique = append(unique, value)
	}
	sort.Strings(unique)
	return unique
}

func candidateRepoPaths(reg scan.Registry, key toolKindKey) []string {
	var paths []string
	for _, pattern := range reg.Patterns {
		if pattern.Scope != "repo" || pattern.ToolID != key.ToolID || pattern.Kind != key.Kind {
			continue
		}
		paths = append(paths, pattern.Paths...)
	}
	return sortStringUnique(paths)
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

func isMultiFileKind(kind string) bool {
	switch strings.ToLower(kind) {
	case "prompts", "skills":
		return true
	default:
		return false
	}
}

func frontmatterConflictKeys(kind string) []string {
	switch strings.ToLower(kind) {
	case "skills":
		return []string{"name"}
	case "prompts":
		return []string{"name", "title", "id"}
	default:
		return nil
	}
}

func frontmatterValues(frontmatter map[string]any, key string) []string {
	if len(frontmatter) == 0 {
		return nil
	}
	var value any
	for k, v := range frontmatter {
		if strings.EqualFold(k, key) {
			value = v
			break
		}
	}
	if value == nil {
		return nil
	}

	switch typed := value.(type) {
	case string:
		normalized := normalizeFrontmatterValue(typed)
		if normalized == "" {
			return nil
		}
		return []string{normalized}
	case []string:
		return normalizeFrontmatterSlice(typed)
	case []any:
		var values []string
		for _, raw := range typed {
			str, ok := raw.(string)
			if !ok {
				continue
			}
			normalized := normalizeFrontmatterValue(str)
			if normalized == "" {
				continue
			}
			values = append(values, normalized)
		}
		return values
	default:
		return nil
	}
}

func normalizeFrontmatterSlice(values []string) []string {
	var normalized []string
	for _, value := range values {
		value = normalizeFrontmatterValue(value)
		if value == "" {
			continue
		}
		normalized = append(normalized, value)
	}
	return normalized
}

func normalizeFrontmatterValue(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func frontmatterLocation(entry scan.ConfigEntry, key string) *scan.Range {
	if entry.FrontmatterLocations == nil {
		return nil
	}
	for k, loc := range entry.FrontmatterLocations {
		if strings.EqualFold(k, key) {
			return &scan.Range{
				StartLine: loc.StartLine,
				StartCol:  loc.StartCol,
				EndLine:   loc.EndLine,
				EndCol:    loc.EndCol,
			}
		}
	}
	return nil
}

func dedupePaths(paths []Path) []Path {
	seen := make(map[string]struct{})
	unique := make([]Path, 0, len(paths))
	for _, path := range paths {
		key := path.Scope + "|" + path.Path
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		unique = append(unique, path)
	}
	return unique
}
