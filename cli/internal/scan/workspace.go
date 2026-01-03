package scan

import (
	"encoding/json"
	"net/url"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spf13/afero"
)

func discoverWorkspaceRoots(fs afero.Fs, repoRoot string) ([]string, []Warning) {
	if fs == nil {
		fs = afero.NewOsFs()
	}
	if repoRoot == "" {
		return nil, nil
	}

	info, err := fs.Stat(repoRoot)
	if err != nil || !info.IsDir() {
		return nil, nil
	}

	entries, err := afero.ReadDir(fs, repoRoot)
	if err != nil {
		return nil, []Warning{warningForError(repoRoot, err)}
	}

	var roots []string
	seen := make(map[string]struct{})
	var warnings []Warning

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".code-workspace") {
			continue
		}
		path := filepath.Join(repoRoot, name)
		data, err := afero.ReadFile(fs, path)
		if err != nil {
			warnings = append(warnings, warningForError(path, err))
			continue
		}
		folders, err := parseWorkspaceFolders(path, data)
		if err != nil {
			warnings = append(warnings, warningForError(path, err))
			continue
		}
		for _, folder := range folders {
			folder = strings.TrimSpace(folder)
			if folder == "" {
				continue
			}
			abs, err := filepath.Abs(folder)
			if err != nil {
				warnings = append(warnings, warningForError(folder, err))
				continue
			}
			abs = filepath.Clean(abs)
			key := filepath.ToSlash(abs)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			roots = append(roots, abs)
		}
	}

	return roots, warnings
}

func parseWorkspaceFolders(workspacePath string, data []byte) ([]string, error) {
	cleaned := stripJSONCComments(data)
	cleaned = stripJSONCTrailingCommas(cleaned)

	var payload map[string]any
	if err := json.Unmarshal(cleaned, &payload); err != nil {
		return nil, err
	}

	rawFolders, ok := payload["folders"]
	if !ok {
		return nil, nil
	}
	list, ok := rawFolders.([]any)
	if !ok {
		return nil, nil
	}

	baseDir := filepath.Dir(workspacePath)
	var roots []string
	for _, entry := range list {
		switch value := entry.(type) {
		case string:
			if resolved := resolveWorkspaceFolder(baseDir, value); resolved != "" {
				roots = append(roots, resolved)
			}
		case map[string]any:
			if pathValue, ok := value["path"].(string); ok {
				if resolved := resolveWorkspaceFolder(baseDir, pathValue); resolved != "" {
					roots = append(roots, resolved)
				}
				continue
			}
			if uriValue, ok := value["uri"].(string); ok {
				if resolved := resolveWorkspaceURI(uriValue); resolved != "" {
					roots = append(roots, resolved)
				}
			}
		}
	}

	return roots, nil
}

func resolveWorkspaceFolder(baseDir string, path string) string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "file://") {
		return resolveWorkspaceURI(trimmed)
	}
	if strings.HasPrefix(trimmed, "~") {
		return filepath.Clean(expandHomePath(trimmed))
	}
	if filepath.IsAbs(trimmed) {
		return filepath.Clean(trimmed)
	}
	if baseDir == "" {
		return filepath.Clean(trimmed)
	}
	return filepath.Clean(filepath.Join(baseDir, trimmed))
}

func resolveWorkspaceURI(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "file" {
		return ""
	}
	path := parsed.Path
	if unescaped, err := url.PathUnescape(path); err == nil {
		path = unescaped
	}
	if runtime.GOOS == "windows" && strings.HasPrefix(path, "/") && len(path) > 2 && path[2] == ':' {
		path = path[1:]
	}
	if path == "" {
		return ""
	}
	return filepath.Clean(filepath.FromSlash(path))
}
