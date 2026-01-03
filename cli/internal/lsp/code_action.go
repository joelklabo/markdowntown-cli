package lsp

import (
	"fmt"
	"path/filepath"
	"strings"

	protocol "github.com/tliron/glsp/protocol_3_16"
)

func diagnosticEvidenceStrings(diag protocol.Diagnostic, key string) []string {
	value, ok := diagnosticEvidenceValue(diag, key)
	if !ok {
		return nil
	}
	return stringSliceFromAny(value)
}

func diagnosticDataString(diag protocol.Diagnostic, key string) string {
	if diag.Data == nil {
		return ""
	}
	data, ok := diag.Data.(map[string]any)
	if !ok {
		return ""
	}
	value, ok := data[key]
	if !ok {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case []string:
		if len(typed) > 0 {
			return typed[0]
		}
	case []any:
		for _, item := range typed {
			if str, ok := item.(string); ok && str != "" {
				return str
			}
		}
	}
	return fmt.Sprintf("%v", value)
}

func stringSliceFromAny(value any) []string {
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			if str, ok := item.(string); ok && str != "" {
				parts = append(parts, str)
			}
		}
		return parts
	case string:
		if typed != "" {
			return []string{typed}
		}
	}
	return nil
}

func identifierFromPath(path string) string {
	if path == "" {
		return ""
	}
	base := filepath.Base(path)
	lower := strings.ToLower(base)
	if lower == "skill.md" || lower == "skill" {
		base = filepath.Base(filepath.Dir(path))
	} else {
		base = strings.TrimSuffix(base, filepath.Ext(base))
	}
	base = strings.TrimSuffix(base, ".prompt")
	base = strings.TrimSuffix(base, ".instructions")
	return strings.TrimSpace(base)
}

func frontmatterClosingLine(content string) (int, bool) {
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		return 0, false
	}
	if strings.TrimSpace(strings.TrimRight(lines[0], "\r")) != "---" {
		return 0, false
	}
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(strings.TrimRight(lines[i], "\r")) == "---" {
			return i, true
		}
	}
	return 0, false
}

func frontmatterHasOpeningLine(content string) bool {
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		return false
	}
	return strings.TrimSpace(strings.TrimRight(lines[0], "\r")) == "---"
}

func closestToolID(target string, options []string) string {
	target = strings.TrimSpace(strings.ToLower(target))
	if target == "" || len(options) == 0 {
		return ""
	}
	if len(target) < 3 {
		return ""
	}
	best := ""
	bestDistance := -1
	for _, option := range options {
		normalized := strings.ToLower(option)
		if normalized == "" {
			continue
		}
		dist := levenshteinDistance(target, normalized)
		if bestDistance == -1 || dist < bestDistance {
			bestDistance = dist
			best = option
		}
	}
	if bestDistance < 0 {
		return ""
	}
	maxDistance := 2
	if len(target) >= 8 {
		maxDistance = 3
	}
	if bestDistance > maxDistance {
		return ""
	}
	return best
}

func levenshteinDistance(a string, b string) int {
	if a == b {
		return 0
	}
	if a == "" {
		return len(b)
	}
	if b == "" {
		return len(a)
	}

	previous := make([]int, len(b)+1)
	current := make([]int, len(b)+1)
	for j := 0; j <= len(b); j++ {
		previous[j] = j
	}

	for i := 1; i <= len(a); i++ {
		current[0] = i
		for j := 1; j <= len(b); j++ {
			cost := 0
			if a[i-1] != b[j-1] {
				cost = 1
			}
			del := previous[j] + 1
			ins := current[j-1] + 1
			sub := previous[j-1] + cost
			current[j] = minInt(del, minInt(ins, sub))
		}
		previous, current = current, previous
	}
	return previous[len(b)]
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
