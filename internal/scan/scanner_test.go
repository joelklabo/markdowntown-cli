package scan

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestScanWarnsOnPermissionDeniedDir(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("permission bits are unreliable on Windows")
	}

	root := copyFixture(t, "security")
	restricted := filepath.Join(root, "restricted")
	if err := os.Mkdir(restricted, 0o700); err != nil {
		t.Fatalf("mkdir restricted: %v", err)
	}
	if err := os.Chmod(restricted, 0); err != nil {
		t.Fatalf("chmod restricted: %v", err)
	}
	t.Cleanup(func() {
		// #nosec G302 -- directory needs execute bit for cleanup.
		_ = os.Chmod(restricted, 0o700)
	})
	if _, err := os.ReadDir(restricted); err == nil {
		t.Skip("unable to simulate permission denied on this system")
	}

	result, err := Scan(Options{
		RepoRoot: root,
		Registry: testRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if !hasWarning(result.Warnings, restricted, "EACCES") {
		t.Fatalf("expected EACCES warning for %s", restricted)
	}
}

func TestScanWarnsOnCircularSymlink(t *testing.T) {
	root := copyFixture(t, "security")
	loopDir := filepath.Join(root, "loop")
	if err := os.Mkdir(loopDir, 0o700); err != nil {
		t.Fatalf("mkdir loop: %v", err)
	}
	linkPath := filepath.Join(loopDir, "self")
	if err := os.Symlink(loopDir, linkPath); err != nil {
		if errors.Is(err, fs.ErrPermission) {
			t.Skip("symlinks not permitted")
		}
		t.Fatalf("symlink: %v", err)
	}

	result, err := Scan(Options{
		RepoRoot: root,
		Registry: testRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if !hasWarningContains(result.Warnings, filepath.Join("loop", "self"), "CIRCULAR_SYMLINK") {
		t.Fatalf("expected CIRCULAR_SYMLINK warning for %s (warnings: %#v)", linkPath, result.Warnings)
	}
}

func hasWarning(warnings []Warning, path string, code string) bool {
	for _, warning := range warnings {
		if warning.Code == code && warning.Path == path {
			return true
		}
	}
	return false
}

func hasWarningContains(warnings []Warning, pathFragment string, code string) bool {
	for _, warning := range warnings {
		if warning.Code == code && strings.Contains(warning.Path, pathFragment) {
			return true
		}
	}
	return false
}

func testRegistry() Registry {
	return Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "test",
				ToolID:       "test",
				ToolName:     "Test",
				Kind:         "config",
				Scope:        "repo",
				Paths:        []string{"README.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}
}

func copyFixture(t *testing.T, name string) string {
	root := t.TempDir()
	src := filepath.Join("..", "..", "testdata", "repos", name)
	if err := copyDir(src, root); err != nil {
		t.Fatalf("copy fixture: %v", err)
	}
	return root
}

func copyDir(src string, dest string) error {
	return filepath.WalkDir(src, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		target := filepath.Join(dest, rel)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o700)
		}
		// #nosec G304 -- copying fixture files during tests.
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o600)
	})
}
