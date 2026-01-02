package git

import (
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
)

// CheckIgnore returns a map of input paths to gitignored status.
func CheckIgnore(repoRoot string, paths []string) (map[string]bool, error) {
	result := make(map[string]bool, len(paths))
	if len(paths) == 0 {
		return result, nil
	}

	filtered, relToOriginal := filterRepoRelative(repoRoot, paths, result)
	if len(filtered) == 0 {
		return result, nil
	}

	stdinStr := strings.Join(filtered, "\x00") + "\x00"
	stdin := strings.NewReader(stdinStr)
	stdout, _, err := runGit(repoRoot, stdin, "check-ignore", "-z", "--stdin")
	if err != nil {
		// git check-ignore returns 1 if no files are ignored.
		// We only swallow the error if it's a clean exit with code 1 from the git process
		// and NO error message on stderr.
		isExit1 := false
		var gerr *commandError
		if errors.As(err, &gerr) {
			_, isExitErr := gerr.cause.(*exec.ExitError)
			if isExitErr && gerr.exitCode == 1 && gerr.stderr == "" {
				isExit1 = true
			}
		}

		if !isExit1 {
			return nil, err
		}
	}

	for _, rel := range strings.Split(stdout, "\x00") {
		if rel == "" {
			continue
		}
		if original, ok := relToOriginal[rel]; ok {
			result[original] = true
		}
	}

	return result, nil
}

func filterRepoRelative(repoRoot string, paths []string, result map[string]bool) ([]string, map[string]string) {
	relative := make([]string, 0, len(paths))
	relToOriginal := make(map[string]string, len(paths))

	for _, path := range paths {
		rel, ok := trimRepoPrefix(repoRoot, path)
		if !ok {
			result[path] = false
			continue
		}
		relative = append(relative, rel)
		relToOriginal[rel] = path
		result[path] = false
	}

	return relative, relToOriginal
}

func trimRepoPrefix(repoRoot string, path string) (string, bool) {
	rel, err := filepath.Rel(repoRoot, path)
	if err != nil {
		return "", false
	}
	if rel == "." {
		return rel, true
	}
	prefix := ".." + string(filepath.Separator)
	if rel == ".." || strings.HasPrefix(rel, prefix) {
		return "", false
	}
	return rel, true
}
