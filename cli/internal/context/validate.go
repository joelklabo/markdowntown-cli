package context //nolint:revive

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/scan"

	"github.com/spf13/afero"
)

// ValidateResolution runs audit rules on the instruction files in a resolution.
func ValidateResolution(res *instructions.Resolution, registry scan.Registry) ([]audit.Issue, error) {
	if res == nil || len(res.Applied) == 0 {
		return nil, nil
	}

	// 1. Security & Logic: Pre-calculate absolute paths and validate boundaries
	// We allow paths inside the RepoRoot.
	paths := make([]string, 0, len(res.Applied))
	appliedPaths := make(map[string]bool)

	absRepoRoot, err := filepath.Abs(res.RepoRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve absolute repo root: %w", err)
	}

	for _, f := range res.Applied {
		absPath, err := filepath.Abs(f.Path)
		if err != nil {
			// Skip invalid paths
			continue
		}

		// Security Check: Path Containment
		// Verify the path is within the repo root to prevent arbitrary file reads
		rel, err := filepath.Rel(absRepoRoot, absPath)
		if err != nil || strings.HasPrefix(rel, "..") || strings.HasPrefix(rel, "/") {
			// Path is outside repo root.
			// NOTE: If we support global config/user config, explicitly allow those roots here.
			continue
		}

		paths = append(paths, absPath)
		appliedPaths[filepath.ToSlash(absPath)] = true
	}

	if len(paths) == 0 {
		return nil, nil
	}

	// Run a targeted scan on these files
	scanRes, err := scan.Scan(scan.Options{
		RepoRoot:       res.RepoRoot,
		StdinPaths:     paths,
		Registry:       registry,
		IncludeContent: false, // Metadata only for audit
		Fs:             afero.NewOsFs(),
	})
	if err != nil {
		return nil, err
	}

	// Wrap in scan.Output
	scanOutput := scan.Output{
		RepoRoot:        res.RepoRoot,
		RegistryVersion: registry.Version,
		Configs:         scanRes.Entries,
		Warnings:        scanRes.Warnings,
	}

	// Run audit rules
	homeDir, _ := os.UserHomeDir()
	xdgConfigHome := os.Getenv("XDG_CONFIG_HOME")
	if xdgConfigHome == "" && homeDir != "" {
		xdgConfigHome = filepath.Join(homeDir, ".config")
	}

	// 2. Privacy: Use RedactAuto instead of RedactNever
	redactor := audit.NewRedactor(res.RepoRoot, homeDir, xdgConfigHome, audit.RedactAuto)
	auditCtx := audit.Context{
		Scan:     scanOutput,
		Registry: registry,
		Redactor: redactor,
	}

	rules := audit.DefaultRules()
	issues := audit.RunRules(auditCtx, rules)

	// Filter issues to only those relevant to the applied files
	var filtered []audit.Issue
	for _, issue := range issues {
		for _, p := range issue.Paths {
			match := false

			// Try as absolute
			if abs, err := filepath.Abs(p.Path); err == nil {
				if appliedPaths[filepath.ToSlash(abs)] {
					match = true
				}
			}

			// Try as relative to repo
			if !match {
				joined := filepath.Join(res.RepoRoot, p.Path)
				if abs, err := filepath.Abs(joined); err == nil {
					if appliedPaths[filepath.ToSlash(abs)] {
						match = true
					}
				}
			}

			if match {
				filtered = append(filtered, issue)
				break
			}
		}
	}

	return filtered, nil
}
