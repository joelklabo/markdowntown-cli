package instructions

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"markdowntown-cli/internal/scan"
)

const (
	claudeFile                  = "CLAUDE.md"
	claudeLocalFile             = "CLAUDE.local.md"
	claudeRulesFolder           = "rules"
	defaultClaudeMaxImportDepth = 3
)

// ClaudeAdapter resolves Claude Code memory and rules.
type ClaudeAdapter struct {
	MaxImportDepth int
}

// Client returns the client identifier.
func (a ClaudeAdapter) Client() Client {
	return ClientClaude
}

// Resolve resolves Claude memory and rules for the target path.
func (a ClaudeAdapter) Resolve(opts ResolveOptions) (Resolution, error) {
	repoRoot, cwd, targetPath, err := normalizeResolvePaths(opts)
	if err != nil {
		return Resolution{}, err
	}

	res := Resolution{
		Client:         ClientClaude,
		RepoRoot:       repoRoot,
		Cwd:            cwd,
		TargetPath:     targetPath,
		OrderGuarantee: OrderDeterministic,
	}

	maxDepth := a.MaxImportDepth
	if maxDepth <= 0 {
		maxDepth = defaultClaudeMaxImportDepth
	}

	targetRel, err := ensureTargetRel(repoRoot, targetPath)
	if err != nil {
		return res, err
	}
	if targetRel != "" {
		targetRel = filepath.ToSlash(targetRel)
	}

	userHome, err := os.UserHomeDir()
	if err == nil {
		userClaude := filepath.Join(userHome, ".claude", claudeFile)
		userFile, err := instructionFileWithScope(userClaude, ScopeUser, ReasonPrimary)
		if err != nil {
			return res, err
		}
		if userFile != nil {
			res.Applied = append(res.Applied, *userFile)
		}

		userRulesDir := filepath.Join(userHome, ".claude", claudeRulesFolder)
		userRules, warnings, err := collectClaudeRules(userRulesDir, targetRel, ScopeUser, maxDepth)
		if err != nil {
			return res, err
		}
		res.Warnings = append(res.Warnings, warnings...)
		res.Applied = append(res.Applied, userRules...)
	}

	targetDir := cwd
	if targetPath != "" {
		targetDir = filepath.Dir(targetPath)
	}

	dirs, err := ancestorDirs(repoRoot, targetDir)
	if err != nil {
		return res, err
	}
	for _, dir := range dirs {
		projectFile, err := instructionFileWithScope(filepath.Join(dir, claudeFile), ScopeRepo, ReasonPrimary)
		if err != nil {
			return res, err
		}
		if projectFile != nil {
			res.Applied = append(res.Applied, *projectFile)
		}
	}

	projectRulesDir := filepath.Join(repoRoot, ".claude", claudeRulesFolder)
	projectRules, warnings, err := collectClaudeRules(projectRulesDir, targetRel, ScopeRepo, maxDepth)
	if err != nil {
		return res, err
	}
	res.Warnings = append(res.Warnings, warnings...)
	res.Applied = append(res.Applied, projectRules...)

	localFile, err := instructionFileWithScope(filepath.Join(repoRoot, claudeLocalFile), ScopeRepo, ReasonPrimary)
	if err != nil {
		return res, err
	}
	if localFile != nil {
		res.Applied = append(res.Applied, *localFile)
		res.Warnings = append(res.Warnings, "CLAUDE.local.md is deprecated; prefer .claude/rules")
	}

	return res, nil
}

func collectClaudeRules(rootDir, targetRel string, scope Scope, maxDepth int) ([]InstructionFile, []string, error) {
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

	visited := make(map[string]struct{})
	var files []InstructionFile
	var warnings []string

	err = filepath.WalkDir(rootDir, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		if !strings.HasSuffix(entry.Name(), ".md") {
			return nil
		}
		items, warns, err := loadClaudeRule(rootDir, path, targetRel, scope, maxDepth, visited, 0)
		if err != nil {
			return err
		}
		warnings = append(warnings, warns...)
		files = append(files, items...)
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	return files, warnings, nil
}

func loadClaudeRule(rootDir, path, targetRel string, scope Scope, maxDepth int, visited map[string]struct{}, depth int) ([]InstructionFile, []string, error) {
	if _, ok := visited[path]; ok {
		return nil, []string{"claude rule import cycle: " + path}, nil
	}
	visited[path] = struct{}{}

	// #nosec G304 -- path comes from validated instruction discovery.
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}

	parsed, ok, err := scan.ParseFrontmatter(content)
	if err != nil {
		return nil, nil, err
	}
	paths := normalizeStringSlice(nil)
	if ok && parsed != nil {
		paths = normalizeStringSlice(parsed.Data["paths"])
	}

	if len(paths) > 0 && !applyToMatches(paths, targetRel) {
		return nil, nil, nil
	}

	file, err := instructionFileWithScope(path, scope, ReasonPrimary)
	if err != nil {
		return nil, nil, err
	}

	var files []InstructionFile
	if file != nil {
		files = append(files, *file)
	}

	imports := extractClaudeImports(string(content))
	var warnings []string
	if depth >= maxDepth {
		if len(imports) > 0 {
			warnings = append(warnings, "claude import depth exceeded at "+path)
		}
		return files, warnings, nil
	}

	for _, imp := range imports {
		resolved := filepath.Clean(filepath.Join(filepath.Dir(path), imp))
		if !strings.HasPrefix(resolved, rootDir) {
			warnings = append(warnings, "claude import outside rules dir: "+imp)
			continue
		}
		items, warns, err := loadClaudeRule(rootDir, resolved, targetRel, scope, maxDepth, visited, depth+1)
		if err != nil {
			return nil, nil, err
		}
		warnings = append(warnings, warns...)
		files = append(files, items...)
	}

	return files, warnings, nil
}

func extractClaudeImports(content string) []string {
	scanner := bufio.NewScanner(strings.NewReader(content))
	var imports []string
	inFence := false

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") {
			inFence = !inFence
			continue
		}
		if inFence {
			continue
		}
		line = stripInlineCode(line)
		idx := strings.Index(line, "@import")
		if idx == -1 {
			continue
		}
		payload := strings.TrimSpace(line[idx+len("@import"):])
		if payload == "" {
			continue
		}
		fields := strings.Fields(payload)
		if len(fields) == 0 {
			continue
		}
		path := strings.Trim(fields[0], "\"'")
		if path != "" {
			imports = append(imports, path)
		}
	}

	return imports
}

func stripInlineCode(line string) string {
	var builder strings.Builder
	inCode := false
	for _, r := range line {
		if r == '`' {
			inCode = !inCode
			continue
		}
		if !inCode {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}
