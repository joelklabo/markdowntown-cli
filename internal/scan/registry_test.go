package scan

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveRegistryPathEnvOverride(t *testing.T) {
	root := t.TempDir()
	override := filepath.Join(root, "registry.json")
	writeRegistryFile(t, override, "{\"version\":\"1\",\"patterns\":[]}")
	t.Setenv(RegistryEnvVar, override)

	path, err := ResolveRegistryPath()
	if err != nil {
		t.Fatalf("ResolveRegistryPath: %v", err)
	}
	if path != override {
		t.Fatalf("expected %s, got %s", override, path)
	}
}

func TestResolveRegistryPathMissing(t *testing.T) {
	t.Setenv(RegistryEnvVar, "")
	xdg := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", xdg)

	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("executable: %v", err)
	}
	binaryPath := filepath.Join(filepath.Dir(exe), RegistryFile)
	if _, err := os.Stat(binaryPath); err == nil {
		t.Skip("registry file exists next to test binary")
	}

	_, err = ResolveRegistryPath()
	if err == nil || !errors.Is(err, ErrRegistryNotFound) {
		t.Fatalf("expected ErrRegistryNotFound, got %v", err)
	}
}

func TestResolveRegistryPathMultiple(t *testing.T) {
	t.Setenv(RegistryEnvVar, "")
	xdg := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", xdg)

	xdgPath := filepath.Join(xdg, RegistrySubdir, RegistryFile)
	writeRegistryFile(t, xdgPath, "{\"version\":\"1\",\"patterns\":[]}")

	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("executable: %v", err)
	}
	binaryPath := filepath.Join(filepath.Dir(exe), RegistryFile)
	if _, err := os.Stat(binaryPath); err == nil {
		t.Skip("registry file exists next to test binary")
	}
	writeRegistryFile(t, binaryPath, "{\"version\":\"1\",\"patterns\":[]}")
	t.Cleanup(func() {
		_ = os.Remove(binaryPath)
	})

	_, err = ResolveRegistryPath()
	if err == nil || !errors.Is(err, ErrMultipleRegistries) {
		t.Fatalf("expected ErrMultipleRegistries, got %v", err)
	}
}

func TestLoadRegistryMalformed(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.json")
	writeRegistryFile(t, path, "{not-json}")
	t.Setenv(RegistryEnvVar, path)

	_, _, err := LoadRegistry()
	if err == nil {
		t.Fatal("expected error for malformed registry")
	}
}

func writeRegistryFile(t *testing.T, path string, data string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
}
