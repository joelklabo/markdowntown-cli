// Package scan provides registry loading and file matching helpers.
package scan

import "markdowntown-cli/internal/git"

// ApplyGitignore populates gitignored flags for repo-scope entries.
func ApplyGitignore(result Result, repoRoot string) (Result, error) {
	paths := make([]string, 0, len(result.Entries))
	for _, entry := range result.Entries {
		if entry.Scope == "repo" {
			paths = append(paths, entry.Path)
		}
	}
	if len(paths) == 0 {
		return result, nil
	}

	ignored, err := git.CheckIgnore(repoRoot, paths)
	if err != nil {
		return result, err
	}

	for i := range result.Entries {
		if result.Entries[i].Scope != "repo" {
			continue
		}
		result.Entries[i].Gitignored = ignored[result.Entries[i].Path]
	}
	return result, nil
}
