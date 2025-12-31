package instructions

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/bmatcuk/doublestar/v4"

	"markdowntown-cli/internal/scan"
)

const (
	copilotInstructionsFile = "copilot-instructions.md"
	copilotInstructionsDir  = "instructions"
)

func instructionFile(path string, reason InstructionReason) (*InstructionFile, error) {
	return instructionFileWithScope(path, ScopeRepo, reason)
}

func instructionFileWithScope(path string, scope Scope, reason InstructionReason) (*InstructionFile, error) {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	if info.IsDir() || info.Size() == 0 {
		return nil, nil
	}

	return &InstructionFile{
		Path:          path,
		Scope:         scope,
		Dir:           filepath.Dir(path),
		Reason:        reason,
		Bytes:         info.Size(),
		IncludedBytes: info.Size(),
	}, nil
}

func nearestAncestorFile(startDir, repoRoot, name string, reason InstructionReason) (*InstructionFile, error) {
	dir := startDir
	for {
		candidate := filepath.Join(dir, name)
		file, err := instructionFile(candidate, reason)
		if err != nil {
			return nil, err
		}
		if file != nil {
			return file, nil
		}
		if dir == repoRoot {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return nil, nil
}

func collectInstructionFiles(rootDir, targetRel, agent string) ([]InstructionFile, []string, error) {
	info, err := os.Stat(rootDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, nil
		}
		return nil, nil, err
	}
	if !info.IsDir() {
		return nil, nil, nil
	}

	if targetRel == "" {
		return nil, []string{"applyTo matching skipped; target path missing"}, nil
	}

	var files []InstructionFile
	var warnings []string
	agent = strings.ToLower(strings.TrimSpace(agent))

	err = filepath.WalkDir(rootDir, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		if !strings.HasSuffix(entry.Name(), ".instructions.md") {
			return nil
		}

		applyTo, excludeAgents, err := parseInstructionFrontmatter(path)
		if err != nil {
			return err
		}
		if agentExcluded(agent, excludeAgents) {
			return nil
		}
		if !applyToMatches(applyTo, targetRel) {
			return nil
		}

		file, err := instructionFile(path, ReasonFallback)
		if err != nil {
			return err
		}
		if file != nil {
			files = append(files, *file)
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	return files, warnings, nil
}

func parseInstructionFrontmatter(path string) ([]string, []string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}
	frontmatter, ok, err := scan.ParseFrontmatter(content)
	if err != nil {
		return nil, nil, err
	}
	if !ok {
		return nil, nil, nil
	}

	applyTo := normalizeStringSlice(frontmatter["applyTo"])
	excludeAgent := normalizeStringSlice(frontmatter["excludeAgent"])
	return applyTo, excludeAgent, nil
}

func normalizeStringSlice(value any) []string {
	switch typed := value.(type) {
	case string:
		if strings.TrimSpace(typed) == "" {
			return nil
		}
		return []string{typed}
	case []string:
		return typed
	case []any:
		out := make([]string, 0, len(typed))
		for _, entry := range typed {
			if entry == nil {
				continue
			}
			str, ok := entry.(string)
			if !ok {
				continue
			}
			if strings.TrimSpace(str) == "" {
				continue
			}
			out = append(out, str)
		}
		return out
	default:
		return nil
	}
}

func applyToMatches(patterns []string, targetRel string) bool {
	if targetRel == "" || len(patterns) == 0 {
		return false
	}
	candidate := filepath.ToSlash(targetRel)
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		pattern = strings.TrimPrefix(pattern, "/")
		pattern = filepath.ToSlash(pattern)
		match, err := doublestar.Match(pattern, candidate)
		if err != nil {
			continue
		}
		if match {
			return true
		}
	}
	return false
}

func agentExcluded(agent string, exclude []string) bool {
	if agent == "" || len(exclude) == 0 {
		return false
	}
	agent = strings.ToLower(agent)
	for _, entry := range exclude {
		if strings.ToLower(strings.TrimSpace(entry)) == agent {
			return true
		}
	}
	return false
}

func repoWideCopilotFile(repoRoot string) string {
	return filepath.Join(repoRoot, ".github", copilotInstructionsFile)
}

func instructionDir(repoRoot string) string {
	return filepath.Join(repoRoot, ".github", copilotInstructionsDir)
}

func requiredSettingEnabled(settings map[string]bool, key string) bool {
	if settings == nil {
		return false
	}
	return settings[key]
}

func ensureTargetRel(repoRoot, targetPath string) (string, error) {
	if targetPath == "" {
		return "", nil
	}
	rel, err := filepath.Rel(repoRoot, targetPath)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", ErrRepoRootMismatch
	}
	return rel, nil
}

func collectAgentFiles(repoRoot string) ([]InstructionFile, error) {
	var files []InstructionFile
	err := filepath.WalkDir(repoRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		if entry.Name() != "AGENTS.md" {
			return nil
		}
		file, err := instructionFile(path, ReasonPrimary)
		if err != nil {
			return err
		}
		if file != nil {
			files = append(files, *file)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

func containsPath(paths []string, target string) bool {
	for _, path := range paths {
		if path == target {
			return true
		}
	}
	return false
}

func uniqueSettings(settings []string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, setting := range settings {
		if setting == "" {
			continue
		}
		if _, ok := seen[setting]; ok {
			continue
		}
		seen[setting] = struct{}{}
		out = append(out, setting)
	}
	return out
}

func formatConflictReason(prefix string, paths []string) string {
	if len(paths) == 0 {
		return prefix
	}
	return fmt.Sprintf("%s: %s", prefix, strings.Join(paths, ", "))
}
