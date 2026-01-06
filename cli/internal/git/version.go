package git

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// Minimum required git version.
// git apply --binary was added in 1.5.0.
// git check-ignore --stdin was added in 1.8.3.
const (
	minMajor = 1
	minMinor = 8
	minPatch = 3
)

// ErrGitTooOld indicates the git version is below the minimum required.
var ErrGitTooOld = errors.New("git version too old")

// ValidateGitVersion checks if git is installed and meets the minimum version requirement.
func ValidateGitVersion() error {
	stdout, err := runGit("", nil, "version")
	if err != nil {
		if errors.Is(err, ErrGitNotFound) {
			return fmt.Errorf("%w: please install git", ErrGitNotFound)
		}
		return fmt.Errorf("failed to check git version: %w", err)
	}

	versionStr := strings.TrimPrefix(strings.TrimSpace(stdout), "git version ")
	major, minor, patch, err := parseGitVersion(versionStr)
	if err != nil {
		// If we can't parse it, but git version command worked, it might be a weird version string.
		// We'll warn but maybe not fail if it looks reasonably new?
		// For now, let's be strict if it doesn't match expected format.
		return fmt.Errorf("failed to parse git version %q: %w", versionStr, err)
	}

	if major < minMajor || (major == minMajor && minor < minMinor) || (major == minMajor && minor == minMinor && patch < minPatch) {
		return fmt.Errorf("%w: found %d.%d.%d, require >= %d.%d.%d (supports --binary and check-ignore --stdin)", ErrGitTooOld, major, minor, patch, minMajor, minMinor, minPatch)
	}

	return nil
}

func parseGitVersion(v string) (int, int, int, error) {
	// git version 2.47.1
	// sometimes has suffixes like .windows.1
	parts := strings.Split(v, ".")
	if len(parts) < 2 {
		return 0, 0, 0, fmt.Errorf("invalid version format")
	}

	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, 0, err
	}

	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, 0, err
	}

	patch := 0
	if len(parts) >= 3 {
		// Handle suffixes like 2.47.1.windows.1
		patchStr := parts[2]
		if idx := strings.IndexAny(patchStr, " \t\n\r-"); idx != -1 {
			patchStr = patchStr[:idx]
		}
		patch, _ = strconv.Atoi(patchStr)
	}

	return major, minor, patch, nil
}
