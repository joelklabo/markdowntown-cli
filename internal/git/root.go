package git

import "strings"

// Root returns the repository root for the provided directory.
func Root(dir string) (string, error) {
	stdout, _, _, err := runGit(dir, nil, "rev-parse", "--show-toplevel")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(stdout), nil
}
