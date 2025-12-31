// Package scan provides registry loading and file matching helpers.
package scan

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
)

// CompiledPattern stores a pattern with its compiled path matchers.
type CompiledPattern struct {
	Pattern Pattern
	Paths   []pathMatcher
}

type pathMatcher struct {
	raw   string
	kind  string
	isAbs bool
	glob  string
	re    *regexp.Regexp
}

// CompilePatterns compiles all registry patterns for matching.
func CompilePatterns(reg Registry) ([]CompiledPattern, error) {
	compiled := make([]CompiledPattern, 0, len(reg.Patterns))
	for _, pattern := range reg.Patterns {
		patternType := strings.ToLower(strings.TrimSpace(pattern.Type))
		if patternType == "" {
			patternType = "glob"
		}

		cp := CompiledPattern{Pattern: pattern}
		for _, rawPath := range pattern.Paths {
			pm, err := compilePath(patternType, rawPath)
			if err != nil {
				return nil, fmt.Errorf("pattern %s (%s): %w", pattern.ID, rawPath, err)
			}
			cp.Paths = append(cp.Paths, pm)
		}

		compiled = append(compiled, cp)
	}

	return compiled, nil
}

// Match reports whether the compiled pattern matches the provided paths.
func (cp CompiledPattern) Match(absPath, relPath string) (bool, string, error) {
	for _, pm := range cp.Paths {
		ok, err := pm.Match(absPath, relPath)
		if err != nil {
			return false, "", err
		}
		if ok {
			return true, pm.raw, nil
		}
	}

	return false, "", nil
}

func compilePath(kind, raw string) (pathMatcher, error) {
	pm := pathMatcher{raw: raw, kind: kind}

	expanded, err := expandHome(raw)
	if err != nil {
		return pm, err
	}

	pm.isAbs = filepath.IsAbs(expanded)
	matchTarget := filepath.ToSlash(expanded)

	switch kind {
	case "glob":
		pm.glob = strings.ToLower(matchTarget)
		if _, err := doublestar.PathMatch(pm.glob, ""); err != nil {
			return pm, err
		}
	case "regex":
		pattern := matchTarget
		if !strings.HasPrefix(pattern, "(?i)") {
			pattern = "(?i)" + pattern
		}
		re, err := regexp.Compile(pattern)
		if err != nil {
			return pm, err
		}
		pm.re = re
	default:
		return pm, fmt.Errorf("unknown matcher type: %s", kind)
	}

	return pm, nil
}

func (pm pathMatcher) Match(absPath, relPath string) (bool, error) {
	candidate := relPath
	if pm.isAbs {
		candidate = absPath
	}

	candidate = filepath.ToSlash(candidate)

	switch pm.kind {
	case "glob":
		candidate = strings.ToLower(candidate)
		return doublestar.PathMatch(pm.glob, candidate)
	case "regex":
		if pm.re == nil {
			return false, fmt.Errorf("regex matcher not compiled")
		}
		return pm.re.MatchString(candidate), nil
	default:
		return false, fmt.Errorf("unknown matcher type: %s", pm.kind)
	}
}
