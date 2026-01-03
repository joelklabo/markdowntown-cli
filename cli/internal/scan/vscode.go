package scan

import (
	"encoding/json"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/afero"
)

func discoverVSCodeInstructionPaths(fs afero.Fs, repoRoot string, userRoots []string) []string {
	if fs == nil {
		fs = afero.NewOsFs()
	}
	var paths []string
	seen := make(map[string]struct{})

	for _, root := range userRoots {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		key := normalizeVSCodePathKey(repoRoot, root)
		if key == "" {
			continue
		}
		seen[key] = struct{}{}
	}

	for _, root := range userRoots {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		expanded := expandHomePath(root)
		absRoot, err := filepath.Abs(expanded)
		if err != nil {
			continue
		}
		settingsPath := filepath.Join(absRoot, "settings.json")
		data, err := afero.ReadFile(fs, settingsPath)
		if err != nil {
			continue
		}
		locations, err := parseVSCodeInstructionsLocations(data)
		if err != nil {
			continue
		}
		for _, location := range locations {
			resolved := resolveVSCodeInstructionPath(repoRoot, location)
			if resolved == "" {
				continue
			}
			key := normalizeVSCodePathKey(repoRoot, resolved)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			paths = append(paths, resolved)
		}
	}

	return paths
}

func parseVSCodeInstructionsLocations(input []byte) ([]string, error) {
	cleaned := stripJSONCComments(input)
	cleaned = stripJSONCTrailingCommas(cleaned)

	var settings map[string]any
	if err := json.Unmarshal(cleaned, &settings); err != nil {
		return nil, err
	}

	value, ok := settings["chat.instructionsFilesLocations"]
	if !ok {
		return nil, nil
	}

	switch typed := value.(type) {
	case string:
		return []string{typed}, nil
	case []any:
		var out []string
		for _, item := range typed {
			switch entry := item.(type) {
			case string:
				out = append(out, entry)
			case map[string]any:
				if pathValue, ok := entry["path"].(string); ok {
					out = append(out, pathValue)
				}
			}
		}
		return out, nil
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key, value := range typed {
			if enabled, ok := value.(bool); ok && enabled {
				keys = append(keys, key)
			}
		}
		sort.Strings(keys)
		return keys, nil
	default:
		return nil, nil
	}
}

func resolveVSCodeInstructionPath(repoRoot string, path string) string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "~") {
		return trimmed
	}
	if filepath.IsAbs(trimmed) {
		return trimmed
	}
	if repoRoot == "" {
		return trimmed
	}
	return filepath.Join(repoRoot, trimmed)
}

func normalizeVSCodePathKey(repoRoot string, path string) string {
	normalized := path
	if strings.HasPrefix(normalized, "~") {
		normalized = expandHomePath(normalized)
	} else if !filepath.IsAbs(normalized) && repoRoot != "" {
		normalized = filepath.Join(repoRoot, normalized)
	}
	normalized = filepath.Clean(normalized)
	return filepath.ToSlash(normalized)
}

func stripJSONCComments(input []byte) []byte {
	if len(input) == 0 {
		return input
	}
	out := make([]byte, 0, len(input))
	inString := false
	escaped := false
	inLineComment := false
	inBlockComment := false

	for i := 0; i < len(input); i++ {
		ch := input[i]

		if inLineComment {
			if ch == '\n' {
				inLineComment = false
				out = append(out, ch)
			}
			continue
		}
		if inBlockComment {
			if ch == '*' && i+1 < len(input) && input[i+1] == '/' {
				inBlockComment = false
				i++
				continue
			}
			if ch == '\n' {
				out = append(out, ch)
			}
			continue
		}

		if inString {
			out = append(out, ch)
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}

		if ch == '"' {
			inString = true
			out = append(out, ch)
			continue
		}

		if ch == '/' && i+1 < len(input) {
			next := input[i+1]
			if next == '/' {
				inLineComment = true
				i++
				continue
			}
			if next == '*' {
				inBlockComment = true
				i++
				continue
			}
		}

		out = append(out, ch)
	}

	return out
}

func stripJSONCTrailingCommas(input []byte) []byte {
	if len(input) == 0 {
		return input
	}
	out := make([]byte, 0, len(input))
	inString := false
	escaped := false

	for i := 0; i < len(input); i++ {
		ch := input[i]

		if inString {
			out = append(out, ch)
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}

		if ch == '"' {
			inString = true
			out = append(out, ch)
			continue
		}

		if ch == ',' {
			j := i + 1
			for j < len(input) {
				switch input[j] {
				case ' ', '\t', '\n', '\r':
					j++
					continue
				}
				break
			}
			if j < len(input) && (input[j] == '}' || input[j] == ']') {
				continue
			}
		}

		out = append(out, ch)
	}

	return out
}
