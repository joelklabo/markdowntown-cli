package instructions

import (
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"markdowntown-cli/internal/git"
)

const (
	defaultGeminiFilename = "GEMINI.md"
	geminiDirName         = ".gemini"
	geminiIgnoreFilename  = ".geminiignore"
)

// GeminiAdapter resolves Gemini CLI memory discovery.
type GeminiAdapter struct {
	Filenames []string
}

// Client returns the client identifier.
func (a GeminiAdapter) Client() Client {
	return ClientGemini
}

// Resolve resolves Gemini memory files for the target path.
func (a GeminiAdapter) Resolve(opts ResolveOptions) (Resolution, error) {
	if strings.TrimSpace(opts.RepoRoot) == "" {
		if cwd := strings.TrimSpace(opts.Cwd); cwd != "" {
			if root, err := git.Root(cwd); err == nil {
				opts.RepoRoot = root
			}
		}
	}

	repoRoot, cwd, targetPath, err := normalizeResolvePaths(opts)
	if err != nil {
		return Resolution{}, err
	}

	res := Resolution{
		Client:         ClientGemini,
		RepoRoot:       repoRoot,
		Cwd:            cwd,
		TargetPath:     targetPath,
		OrderGuarantee: OrderDeterministic,
	}

	filenames := normalizeGeminiFilenames(a.Filenames)

	if home, err := os.UserHomeDir(); err == nil {
		userDir := filepath.Join(home, geminiDirName)
		for _, name := range filenames {
			file, err := instructionFileWithScope(filepath.Join(userDir, name), ScopeUser, ReasonPrimary)
			if err != nil {
				return res, err
			}
			if file != nil {
				res.Applied = append(res.Applied, *file)
			}
		}
	}

	dirs, err := ancestorDirs(repoRoot, cwd)
	if err != nil {
		return res, err
	}
	for _, dir := range dirs {
		for _, name := range filenames {
			file, err := instructionFileWithScope(filepath.Join(dir, name), ScopeRepo, ReasonPrimary)
			if err != nil {
				return res, err
			}
			if file != nil {
				res.Applied = append(res.Applied, *file)
			}
		}
	}

	subtree, err := collectGeminiSubtreeFiles(repoRoot, cwd, filenames)
	if err != nil {
		return res, err
	}
	res.Applied = append(res.Applied, subtree...)

	return res, nil
}

func normalizeGeminiFilenames(input []string) []string {
	if len(input) == 0 {
		return []string{defaultGeminiFilename}
	}
	seen := map[string]struct{}{}
	var out []string
	for _, name := range input {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	if len(out) == 0 {
		return []string{defaultGeminiFilename}
	}
	sort.Strings(out)
	return out
}

func collectGeminiSubtreeFiles(repoRoot, cwd string, filenames []string) ([]InstructionFile, error) {
	patterns, err := loadGeminiIgnore(repoRoot)
	if err != nil {
		return nil, err
	}

	var candidates []string
	err = filepath.WalkDir(cwd, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			if entry.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Dir(path) == cwd {
			return nil
		}
		if !matchesGeminiFilename(entry.Name(), filenames) {
			return nil
		}
		candidates = append(candidates, path)
		return nil
	})
	if err != nil {
		return nil, err
	}

	filtered := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		rel, err := filepath.Rel(repoRoot, candidate)
		if err != nil {
			continue
		}
		if geminiIgnoreMatch(rel, patterns) {
			continue
		}
		filtered = append(filtered, candidate)
	}

	if len(filtered) == 0 {
		return nil, nil
	}

	ignored, err := git.CheckIgnore(repoRoot, filtered)
	if err != nil {
		return nil, err
	}

	sort.Strings(filtered)
	var files []InstructionFile
	for _, candidate := range filtered {
		if ignored[candidate] {
			continue
		}
		file, err := instructionFileWithScope(candidate, ScopeRepo, ReasonPrimary)
		if err != nil {
			return nil, err
		}
		if file != nil {
			files = append(files, *file)
		}
	}

	return files, nil
}

func matchesGeminiFilename(name string, filenames []string) bool {
	for _, candidate := range filenames {
		if name == candidate {
			return true
		}
	}
	return false
}

func loadGeminiIgnore(repoRoot string) ([]string, error) {
	path := filepath.Join(repoRoot, geminiIgnoreFilename)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	lines := strings.Split(string(data), "\n")
	var patterns []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		patterns = append(patterns, filepath.ToSlash(trimmed))
	}
	return patterns, nil
}

func geminiIgnoreMatch(relPath string, patterns []string) bool {
	if len(patterns) == 0 {
		return false
	}
	candidate := filepath.ToSlash(relPath)
	for _, pattern := range patterns {
		if pattern == "" {
			continue
		}
		if strings.HasSuffix(pattern, "/") {
			prefix := strings.TrimSuffix(pattern, "/") + "/"
			if strings.HasPrefix(candidate, prefix) {
				return true
			}
			continue
		}
		if strings.ContainsAny(pattern, "*?[") {
			match, err := path.Match(pattern, candidate)
			if err == nil && match {
				return true
			}
			continue
		}
		if candidate == pattern {
			return true
		}
	}
	return false
}
