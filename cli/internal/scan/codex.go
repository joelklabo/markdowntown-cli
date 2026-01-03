package scan

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/afero"
)

const codexConfigFilename = "config.toml"

func loadCodexFallbackFilenames(fs afero.Fs) ([]string, string, error) {
	if fs == nil {
		fs = afero.NewOsFs()
	}

	codexHome := os.Getenv("CODEX_HOME")
	if codexHome == "" {
		codexHome = "~/.codex"
	}
	codexHome = filepath.Clean(expandHomePath(codexHome))
	configPath := filepath.Join(codexHome, codexConfigFilename)

	data, err := afero.ReadFile(fs, configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, configPath, nil
		}
		return nil, configPath, err
	}

	fallback, err := parseCodexFallbackFilenames(data)
	if err != nil {
		return nil, configPath, err
	}

	return fallback, configPath, nil
}

func parseCodexFallbackFilenames(data []byte) ([]string, error) {
	var table string

	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#") {
			continue
		}

		if idx := strings.Index(line, "#"); idx >= 0 {
			line = strings.TrimSpace(line[:idx])
			if line == "" {
				continue
			}
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			table = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(line, "["), "]"))
			continue
		}

		if table != "" {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		if key == "project_doc_fallback_filenames" {
			parsed, err := parseCodexStringArray(value)
			if err != nil {
				return nil, fmt.Errorf("parse project_doc_fallback_filenames: %w", err)
			}
			return parsed, nil
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return nil, nil
}

func parseCodexStringArray(value string) ([]string, error) {
	trimmed := strings.TrimSpace(value)
	if !strings.HasPrefix(trimmed, "[") || !strings.HasSuffix(trimmed, "]") {
		return nil, fmt.Errorf("expected array, got %q", value)
	}

	inner := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(trimmed, "["), "]"))
	if inner == "" {
		return nil, nil
	}

	parts := strings.Split(inner, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		item = strings.Trim(item, "\"'")
		if item == "" {
			continue
		}
		out = append(out, item)
	}

	return out, nil
}

func appendCodexFallbackPatterns(patterns []CompiledPattern, fallback []string) ([]CompiledPattern, error) {
	if len(fallback) == 0 {
		return patterns, nil
	}

	base, ok := codexRepoInstructionPattern(patterns)
	if !ok {
		return patterns, nil
	}

	existing := make(map[string]struct{})
	for _, compiled := range patterns {
		if compiled.Pattern.ToolID != "codex" || compiled.Pattern.Scope != "repo" || compiled.Pattern.Kind != "instructions" {
			continue
		}
		for _, path := range compiled.Pattern.Paths {
			key := strings.ToLower(strings.TrimSpace(path))
			if key == "" {
				continue
			}
			existing[key] = struct{}{}
		}
	}

	added := make(map[string]struct{})
	count := 0
	for _, name := range fallback {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := existing[key]; ok {
			continue
		}
		if _, ok := added[key]; ok {
			continue
		}
		added[key] = struct{}{}
		count++

		pattern := base
		pattern.ID = fmt.Sprintf("codex-fallback-repo-%d", count)
		pattern.Paths = []string{trimmed}
		pattern.Notes = "Fallback instruction filename from codex config"

		pm, err := compilePath(pattern.Type, trimmed)
		if err != nil {
			return patterns, err
		}

		patterns = append(patterns, CompiledPattern{
			Pattern: pattern,
			Paths:   []pathMatcher{pm},
		})
	}

	return patterns, nil
}

func codexRepoInstructionPattern(patterns []CompiledPattern) (Pattern, bool) {
	for _, compiled := range patterns {
		if compiled.Pattern.ID == "codex-agents-repo" {
			return compiled.Pattern, true
		}
	}
	for _, compiled := range patterns {
		if compiled.Pattern.ToolID == "codex" && compiled.Pattern.Scope == "repo" && compiled.Pattern.Kind == "instructions" {
			return compiled.Pattern, true
		}
	}
	return Pattern{}, false
}
