package instructions

import (
	"path/filepath"
	"strings"
)

const defaultCopilotAgent = "coding-agent"

// CopilotAdapter resolves GitHub Copilot instruction chains.
type CopilotAdapter struct {
	Agent string
}

// Client returns the client identifier.
func (a CopilotAdapter) Client() Client {
	return ClientCopilot
}

// Resolve resolves Copilot instruction files for the target path.
func (a CopilotAdapter) Resolve(opts ResolveOptions) (Resolution, error) {
	repoRoot, cwd, targetPath, err := normalizeResolvePaths(opts)
	if err != nil {
		return Resolution{}, err
	}

	res := Resolution{
		Client:         ClientCopilot,
		RepoRoot:       repoRoot,
		Cwd:            cwd,
		TargetPath:     targetPath,
		OrderGuarantee: OrderDeterministic,
	}

	agent := strings.TrimSpace(a.Agent)
	if agent == "" {
		agent = defaultCopilotAgent
	}

	targetRel, err := ensureTargetRel(repoRoot, targetPath)
	if err != nil {
		return res, err
	}

	repoWidePath := repoWideCopilotFile(repoRoot)
	repoWideFile, err := instructionFile(repoWidePath, ReasonPrimary)
	if err != nil {
		return res, err
	}
	if repoWideFile != nil {
		res.Applied = append(res.Applied, *repoWideFile)
	}

	scopedFiles, warnings, err := collectInstructionFiles(instructionDir(repoRoot), filepath.ToSlash(targetRel), agent)
	if err != nil {
		return res, err
	}
	res.Warnings = append(res.Warnings, warnings...)
	res.Applied = append(res.Applied, scopedFiles...)

	if repoWideFile != nil && len(scopedFiles) > 0 {
		res.OrderGuarantee = OrderUndefined
		paths := []string{repoWideFile.Path}
		for _, file := range scopedFiles {
			paths = append(paths, file.Path)
		}
		res.Conflicts = append(res.Conflicts, Conflict{Reason: "nondeterministic merge between repo-wide and scoped instructions", Paths: paths})
	}

	targetDir := cwd
	if targetPath != "" {
		targetDir = filepath.Dir(targetPath)
	}

	agentFile, err := nearestAncestorFile(targetDir, repoRoot, "AGENTS.md", ReasonPrimary)
	if err != nil {
		return res, err
	}
	if agentFile != nil {
		res.Applied = append(res.Applied, *agentFile)
	}

	claudeFile, err := instructionFile(filepath.Join(repoRoot, "CLAUDE.md"), ReasonPrimary)
	if err != nil {
		return res, err
	}
	if claudeFile != nil {
		res.Applied = append(res.Applied, *claudeFile)
	}

	geminiFile, err := instructionFile(filepath.Join(repoRoot, "GEMINI.md"), ReasonPrimary)
	if err != nil {
		return res, err
	}
	if geminiFile != nil {
		res.Applied = append(res.Applied, *geminiFile)
	}

	return res, nil
}
