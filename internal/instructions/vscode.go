package instructions

import (
	"path/filepath"
)

const (
	vsCodeInstructionSetting = "github.copilot.chat.codeGeneration.useInstructionFiles"
	vsCodeAgentSetting       = "chat.useAgentsMdFile"
	vsCodeNestedAgentSetting = "chat.useNestedAgentsMdFiles"
)

// VSCodeAdapter resolves VS Code Copilot instruction files.
type VSCodeAdapter struct{}

// Client returns the client identifier.
func (VSCodeAdapter) Client() Client {
	return ClientVSCode
}

// Resolve resolves VS Code instruction files for the target path.
func (VSCodeAdapter) Resolve(opts ResolveOptions) (Resolution, error) {
	repoRoot, cwd, targetPath, err := normalizeResolvePaths(opts)
	if err != nil {
		return Resolution{}, err
	}

	res := Resolution{
		Client:         ClientVSCode,
		RepoRoot:       repoRoot,
		Cwd:            cwd,
		TargetPath:     targetPath,
		OrderGuarantee: OrderUndefined,
	}

	settings := opts.Settings
	targetRel, err := ensureTargetRel(repoRoot, targetPath)
	if err != nil {
		return res, err
	}

	instructionFilesEnabled := requiredSettingEnabled(settings, vsCodeInstructionSetting)
	if !instructionFilesEnabled {
		res.SettingsRequired = append(res.SettingsRequired, vsCodeInstructionSetting)
	}

	if instructionFilesEnabled {
		repoWideFile, err := instructionFile(repoWideCopilotFile(repoRoot), ReasonPrimary)
		if err != nil {
			return res, err
		}
		if repoWideFile != nil {
			res.Applied = append(res.Applied, *repoWideFile)
		}

		scopedFiles, warnings, err := collectInstructionFiles(instructionDir(repoRoot), filepath.ToSlash(targetRel), "")
		if err != nil {
			return res, err
		}
		res.Warnings = append(res.Warnings, warnings...)
		res.Applied = append(res.Applied, scopedFiles...)
	}

	agentsEnabled := requiredSettingEnabled(settings, vsCodeAgentSetting)
	if !agentsEnabled {
		res.SettingsRequired = append(res.SettingsRequired, vsCodeAgentSetting)
	}

	if agentsEnabled {
		rootAgent, err := instructionFile(filepath.Join(repoRoot, "AGENTS.md"), ReasonPrimary)
		if err != nil {
			return res, err
		}
		if rootAgent != nil {
			res.Applied = append(res.Applied, *rootAgent)
		}
	}

	nestedEnabled := requiredSettingEnabled(settings, vsCodeNestedAgentSetting)
	if !nestedEnabled {
		res.SettingsRequired = append(res.SettingsRequired, vsCodeNestedAgentSetting)
	}

	if nestedEnabled {
		nestedAgents, err := collectAgentFiles(repoRoot)
		if err != nil {
			return res, err
		}
		for _, agent := range nestedAgents {
			if agentsEnabled && agent.Path == filepath.Join(repoRoot, "AGENTS.md") {
				continue
			}
			res.Applied = append(res.Applied, agent)
		}
	}

	res.SettingsRequired = uniqueSettings(res.SettingsRequired)

	if len(res.Applied) > 1 {
		var paths []string
		for _, file := range res.Applied {
			paths = append(paths, file.Path)
		}
		res.Conflicts = append(res.Conflicts, Conflict{Reason: "instruction order undefined across VS Code instruction types", Paths: paths})
	}

	return res, nil
}
