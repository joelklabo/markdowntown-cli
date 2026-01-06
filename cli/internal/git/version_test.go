package git

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestParseGitVersion(t *testing.T) {
	tests := []struct {
		v     string
		major int
		minor int
		patch int
		err   bool
	}{
		{"2.47.1", 2, 47, 1, false},
		{"1.8.3", 1, 8, 3, false},
		{"2.47.1.windows.1", 2, 47, 1, false},
		{"2.47", 2, 47, 0, false},
		{"git version 2.47.1", 0, 0, 0, true}, // expected pure version string
		{"invalid", 0, 0, 0, true},
	}

	for _, tt := range tests {
		major, minor, patch, err := parseGitVersion(tt.v)
		if (err != nil) != tt.err {
			t.Errorf("parseGitVersion(%q) error = %v, wantErr %v", tt.v, err, tt.err)
			continue
		}
		if !tt.err {
			if major != tt.major || minor != tt.minor || patch != tt.patch {
				t.Errorf("parseGitVersion(%q) = %d.%d.%d, want %d.%d.%d", tt.v, major, minor, patch, tt.major, tt.minor, tt.patch)
			}
		}
	}
}

func TestValidateGitVersionReal(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	if err := ValidateGitVersion(); err != nil {
		t.Errorf("ValidateGitVersion() failed on current system: %v", err)
	}
}

func TestValidateGitVersionNotFound(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	err := ValidateGitVersion()
	if !errors.Is(err, ErrGitNotFound) {
		t.Fatalf("expected ErrGitNotFound, got %v", err)
	}
}

func TestValidateGitVersionTooOld(t *testing.T) {
	// Mock a "git" binary that returns an old version
	binDir := t.TempDir()
	gitBin := filepath.Join(binDir, "git")
	if runtime.GOOS == "windows" {
		gitBin += ".exe"
	}

	// Simple shell script or go binary to echo old version
	// Let's use a small Go source and compile it for the test if we wanted to be robust,
	// but writing a script is easier if we can assume a shell.
	// Actually, we can just use a helper that echoes.

	content := ""
	if runtime.GOOS == "windows" {
		content = "@echo off\nif \"%1\"==\"version\" echo git version 1.7.0\n"
		gitBin = filepath.Join(binDir, "git.bat")
	} else {
		content = "#!/bin/sh\nif [ \"$1\" = \"version\" ]; then echo \"git version 1.7.0\"; fi\n"
	}

	if err := os.WriteFile(gitBin, []byte(content), 0600); err != nil {
		t.Fatalf("failed to write mock git: %v", err)
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(gitBin, 0755); err != nil {
			t.Fatalf("failed to chmod mock git: %v", err)
		}
	}

	oldPath := os.Getenv("PATH")
	t.Setenv("PATH", binDir+string(os.PathListSeparator)+oldPath)

	err := ValidateGitVersion()
	if !errors.Is(err, ErrGitTooOld) {
		t.Fatalf("expected ErrGitTooOld, got %v", err)
	}
}
