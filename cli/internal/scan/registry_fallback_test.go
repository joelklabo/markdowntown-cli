package scan

import (
	"errors"
	"testing"
)

func TestLoadRegistryReturnsDefaultWhenMissing(t *testing.T) {
	// Ensure no registry is found by clearing env and using empty temp dirs
	t.Setenv(RegistryEnvVar, "")
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	// Create a temp dir for HOME to ensure no global config is found
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	// Ensure executable path check doesn't find anything
	// (This is tricky if the test binary has one next to it, but we can't easily move the test binary)
	// We rely on the fact that "go test" usually runs in a temp directory,
	// but if the user has a registry in the source tree next to where the binary might be considered to be, it might fail.
	// However, TestResolveRegistryPathMissing in registry_test.go handles this by skipping.
	// We should probably check if ResolveRegistryPath returns error first.

	_, err := ResolveRegistryPath()
	if err == nil {
		t.Skip("ResolveRegistryPath found a registry, cannot test default fallback")
	}
	if !errors.Is(err, ErrRegistryNotFound) {
		t.Fatalf("unexpected error from ResolveRegistryPath: %v", err)
	}

	reg, path, err := LoadRegistry()
	if err != nil {
		t.Fatalf("LoadRegistry failed: %v", err)
	}
	if path != "(default)" && path != "" { // Implementation detail: I used "(default)"
		t.Errorf("expected default path indicator, got %s", path)
	}
	if len(reg.Patterns) == 0 {
		t.Error("expected default patterns, got none")
	}

	// Verify one of the default patterns exists
	found := false
	for _, p := range reg.Patterns {
		if p.ID == "codex-agents-repo" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected codex-agents-repo pattern in default registry")
	}
}
