package scan

import (
	"fmt"
	"os"
	"os/exec"
)

// CloneToTemp clones a git repository to a temporary directory.
// It returns the temporary directory path, a cleanup function, and any error.
func CloneToTemp(url string, ref string) (string, func(), error) {
	tempDir, err := os.MkdirTemp("", "markdowntown-remote-")
	if err != nil {
		return "", nil, fmt.Errorf("failed to create temp dir: %w", err)
	}

	cleanup := func() {
		_ = os.RemoveAll(tempDir)
	}

	// Shallow clone to save time/bandwidth
	args := []string{"clone", "--depth", "1", url, tempDir}
	if ref != "" {
		args = []string{"clone", "--depth", "1", "--branch", ref, url, tempDir}
	}

	cmd := exec.Command("git", args...) //nolint:gosec // trusted git arguments
	// Prevent git from asking for credentials
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	if output, err := cmd.CombinedOutput(); err != nil {
		cleanup() // Clean up empty/partial dir
		return "", nil, fmt.Errorf("git clone failed: %w\n%s", err, string(output))
	}

	return tempDir, cleanup, nil
}
