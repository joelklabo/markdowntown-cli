package git

import (
	"bytes"
	"errors"
	"fmt"
	"strings"
)

// ErrPatchConflict indicates the patch could not be applied cleanly.
var ErrPatchConflict = errors.New("patch conflict")

// PatchConflictError wraps git apply conflicts with stderr context.
type PatchConflictError struct {
	Message string
}

func (err *PatchConflictError) Error() string {
	if err == nil {
		return "patch conflict"
	}
	if err.Message == "" {
		return "patch conflict"
	}
	return fmt.Sprintf("patch conflict: %s", err.Message)
}

// Is supports errors.Is for conflict detection.
func (err *PatchConflictError) Is(target error) bool {
	return target == ErrPatchConflict
}

// ApplyOptions configures patch application behavior.
type ApplyOptions struct {
	DryRun  bool
	Reverse bool
}

// ApplyPatch applies a unified diff patch in the provided repo root.
func ApplyPatch(repoRoot string, patch []byte, options ApplyOptions) error {
	args := []string{"apply", "--whitespace=nowarn", "--binary"}
	if options.DryRun {
		args = append(args, "--check")
	}
	if options.Reverse {
		args = append(args, "--reverse")
	}

	_, err := runGit(repoRoot, bytes.NewReader(patch), args...)
	if err == nil {
		return nil
	}

	return classifyApplyError(err)
}

// IsClean reports whether the git working tree is clean.
func IsClean(repoRoot string) (bool, error) {
	stdout, err := runGit(repoRoot, nil, "status", "--porcelain")
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(stdout) == "", nil
}

func classifyApplyError(err error) error {
	var cmdErr *commandError
	if errors.As(err, &cmdErr) {
		stderr := strings.ToLower(cmdErr.stderr)
		if strings.Contains(stderr, "patch failed") || strings.Contains(stderr, "does not apply") {
			return &PatchConflictError{Message: cmdErr.stderr}
		}
	}
	return err
}
