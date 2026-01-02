package scan

import (
	"encoding/json"
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

func TestResolveRegistryPathEnvOverrideMissing(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.json")
	t.Setenv(RegistryEnvVar, missing)

	_, err := ResolveRegistryPath()
	if err == nil || !errors.Is(err, ErrRegistryPathMissing) {
		t.Fatalf("expected ErrRegistryPathMissing, got %v", err)
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

func TestXDGConfigHomeDefault(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", "")
	got, err := xdgConfigHome()
	if err != nil {
		t.Fatalf("xdgConfigHome: %v", err)
	}
	expected := filepath.Join(home, ".config")
	if got != expected {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}

func TestExpandHomeCases(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	got, err := expandHome("~")
	if err != nil {
		t.Fatalf("expandHome: %v", err)
	}
	if got != home {
		t.Fatalf("expected %s, got %s", home, got)
	}

	got, err = expandHome("~/docs")
	if err != nil {
		t.Fatalf("expandHome: %v", err)
	}
	if got != filepath.Join(home, "docs") {
		t.Fatalf("expected expanded path, got %s", got)
	}

	got, err = expandHome("relative")
	if err != nil {
		t.Fatalf("expandHome: %v", err)
	}
	if got != "relative" {
		t.Fatalf("expected relative path, got %s", got)
	}

	got, err = expandHome("~someone/docs")
	if err != nil {
		t.Fatalf("expandHome: %v", err)
	}
	if got != "~someone/docs" {
		t.Fatalf("expected untouched path, got %s", got)
	}
}

func TestExpandXDGConfigHome(t *testing.T) {
	xdg := filepath.Join(t.TempDir(), "config")
	t.Setenv("XDG_CONFIG_HOME", xdg)

	got := expandXDGConfigHome("$XDG_CONFIG_HOME/markdowntown/registry.json")
	expected := filepath.Join(xdg, "markdowntown", "registry.json")
	if got != expected {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}

func TestExpandRegistryPath(t *testing.T) {
	xdg := filepath.Join(t.TempDir(), "config")
	t.Setenv("XDG_CONFIG_HOME", xdg)

	got, err := expandRegistryPath("$XDG_CONFIG_HOME/markdowntown/registry.json")
	if err != nil {
		t.Fatalf("expandRegistryPath: %v", err)
	}
	expected := filepath.Join(xdg, "markdowntown", "registry.json")
	if got != expected {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}

func TestLoadRegistryMalformed(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.json")
	writeRegistryFile(t, path, "{not-json}")
	t.Setenv(RegistryEnvVar, path)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	_, _, err := LoadRegistry()
	if err == nil {
		t.Fatal("expected error for malformed registry")
	}
}

func TestLoadRegistryWithCustomPatterns(t *testing.T) {
	root := t.TempDir()
	registryPath := filepath.Join(root, "registry.json")
	writeRegistryFile(t, registryPath, `{
  "version": "base",
  "patterns": [
    {
      "id": "base-1",
      "toolId": "base",
      "toolName": "Base",
      "kind": "config",
      "scope": "repo",
      "paths": ["base.json"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "automatic",
      "docs": ["https://example.com"]
    }
  ]
}`)
	t.Setenv(RegistryEnvVar, registryPath)

	xdg := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", xdg)
	customPath := filepath.Join(xdg, RegistrySubdir, CustomPatternsFile)
	writeRegistryFile(t, customPath, `{
  "version": "custom",
  "patterns": [
    {
      "id": "base-1",
      "toolId": "override",
      "toolName": "Override",
      "kind": "config",
      "scope": "repo",
      "paths": ["override.json"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "automatic",
      "docs": ["https://example.com"]
    },
    {
      "id": "custom-1",
      "toolId": "custom",
      "toolName": "Custom",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["CUSTOM.md"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "automatic",
      "docs": ["https://example.com"]
    }
  ]
}`)

	reg, _, err := LoadRegistry()
	if err != nil {
		t.Fatalf("LoadRegistry: %v", err)
	}
	if reg.Version != "base" {
		t.Fatalf("expected base version, got %s", reg.Version)
	}
	if len(reg.Patterns) != 2 {
		t.Fatalf("expected 2 patterns, got %d", len(reg.Patterns))
	}
	if reg.Patterns[0].ToolID != "override" {
		t.Fatalf("expected override pattern at index 0, got %s", reg.Patterns[0].ToolID)
	}
	if reg.Patterns[1].ID != "custom-1" {
		t.Fatalf("expected custom pattern appended, got %s", reg.Patterns[1].ID)
	}
}

func TestLoadRegistryCustomPatternsInvalid(t *testing.T) {
	root := t.TempDir()
	registryPath := filepath.Join(root, "registry.json")
	writeRegistryFile(t, registryPath, `{"version":"base","patterns":[]}`)
	t.Setenv(RegistryEnvVar, registryPath)

	xdg := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", xdg)
	customPath := filepath.Join(xdg, RegistrySubdir, CustomPatternsFile)
	writeRegistryFile(t, customPath, `{"version":"custom","patterns":[{"id":"bad"}]}`)

	_, _, err := LoadRegistry()
	if err == nil {
		t.Fatalf("expected error for invalid custom patterns")
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

func loadRegistryFixture(t *testing.T) Registry {
	t.Helper()
	path := filepath.Join("..", "..", "data", "ai-config-patterns.json")
	data, err := ReadRegistryFile(path)
	if err != nil {
		t.Fatalf("read registry fixture: %v", err)
	}

	var reg Registry
	if err := json.Unmarshal(data, &reg); err != nil {
		t.Fatalf("parse registry fixture: %v", err)
	}

	return reg
}
