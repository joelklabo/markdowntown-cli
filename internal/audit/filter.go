package audit

import (
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"markdowntown-cli/internal/scan"
)

// FilterOptions controls rule and path filtering.
type FilterOptions struct {
	IgnoreRules  []string
	ExcludePaths []string
}

// FilterRules removes rules by ID and errors on unknown IDs.
func FilterRules(rules []Rule, ignore []string) ([]Rule, error) {
	if len(ignore) == 0 {
		return append([]Rule(nil), rules...), nil
	}

	byID := make(map[string]Rule)
	for _, rule := range rules {
		byID[rule.ID()] = rule
	}
	for _, id := range ignore {
		if _, ok := byID[id]; !ok {
			return nil, fmt.Errorf("audit: unknown rule ID %q", id)
		}
	}

	ignoreSet := make(map[string]struct{}, len(ignore))
	for _, id := range ignore {
		ignoreSet[id] = struct{}{}
	}

	filtered := make([]Rule, 0, len(rules))
	for _, rule := range rules {
		if _, ok := ignoreSet[rule.ID()]; ok {
			continue
		}
		filtered = append(filtered, rule)
	}

	return filtered, nil
}

// FilterScan excludes configs and warnings that match exclude globs.
func FilterScan(scanOutput scan.Output, exclude []string) (scan.Output, error) {
	if len(exclude) == 0 {
		return scanOutput, nil
	}

	configs := make([]scan.ConfigEntry, 0, len(scanOutput.Configs))
	for _, entry := range scanOutput.Configs {
		excluded, err := matchesAny(entry.Path, exclude)
		if err != nil {
			return scan.Output{}, err
		}
		if excluded {
			continue
		}
		configs = append(configs, entry)
	}

	warnings := make([]scan.Warning, 0, len(scanOutput.Warnings))
	for _, warning := range scanOutput.Warnings {
		excluded, err := matchesAny(warning.Path, exclude)
		if err != nil {
			return scan.Output{}, err
		}
		if excluded {
			continue
		}
		warnings = append(warnings, warning)
	}

	scanOutput.Configs = configs
	scanOutput.Warnings = warnings
	return scanOutput, nil
}

func matchesAny(target string, patterns []string) (bool, error) {
	cleanTarget := filepath.ToSlash(strings.TrimPrefix(target, "./"))
	base := path.Base(cleanTarget)
	for _, pattern := range patterns {
		cleanPattern := filepath.ToSlash(strings.TrimPrefix(pattern, "./"))
		matched, err := path.Match(cleanPattern, cleanTarget)
		if err != nil {
			return false, fmt.Errorf("audit: invalid exclude pattern %q: %w", pattern, err)
		}
		if matched {
			return true, nil
		}
		matched, err = path.Match(cleanPattern, base)
		if err != nil {
			return false, fmt.Errorf("audit: invalid exclude pattern %q: %w", pattern, err)
		}
		if matched {
			return true, nil
		}
	}
	return false, nil
}
