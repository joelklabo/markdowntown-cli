// Package git wraps common git command helpers.
package git

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

// ErrGitNotFound indicates git is not available on PATH.
var ErrGitNotFound = errors.New("git not found")

type commandError struct {
	command  string
	exitCode int
	stderr   string
	cause    error
}

func (err *commandError) Error() string {
	if err.stderr == "" {
		return fmt.Sprintf("git %s failed with exit code %d", err.command, err.exitCode)
	}
	return fmt.Sprintf("git %s failed with exit code %d: %s", err.command, err.exitCode, err.stderr)
}

func (err *commandError) Unwrap() error {
	return err.cause
}

func runGit(dir string, stdin io.Reader, args ...string) (string, int, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Stdin = stdin

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	out := stdout.String()
	errOut := strings.TrimSpace(stderr.String())

	if err == nil {
		return out, 0, nil
	}

	if errors.Is(err, exec.ErrNotFound) {
		return out, 127, ErrGitNotFound
	}

	exitCode := 1
	if exitErr, ok := err.(*exec.ExitError); ok {
		exitCode = exitErr.ExitCode()
	}

	return out, exitCode, &commandError{
		command:  strings.Join(args, " "),
		exitCode: exitCode,
		stderr:   errOut,
		cause:    err,
	}
}
