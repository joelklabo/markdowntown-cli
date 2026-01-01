package suggest

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveSourcesPathOverride(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sources.json")
	if err := os.WriteFile(path, []byte(`{"version":"1","allowlistHosts":["example.com"],"sources":[]}`), 0o644); err != nil {
		t.Fatalf("write sources: %v", err)
	}

	t.Setenv(SourcesEnvVar, path)
	resolved, err := ResolveSourcesPath()
	if err != nil {
		t.Fatalf("ResolveSourcesPath: %v", err)
	}
	if resolved != path {
		t.Fatalf("expected %s, got %s", path, resolved)
	}
}

func TestResolveSourcesPathMissingOverride(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "missing.json")
	t.Setenv(SourcesEnvVar, path)

	_, err := ResolveSourcesPath()
	if !errors.Is(err, ErrSourcesPathMissing) {
		t.Fatalf("expected ErrSourcesPathMissing, got %v", err)
	}
}

func TestResolveSourcesPathConfigHome(t *testing.T) {
	configHome := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", configHome)
	t.Setenv(SourcesEnvVar, "")

	path := filepath.Join(configHome, SourcesSubdir, SourcesFile)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(`{"version":"1","allowlistHosts":["example.com"],"sources":[]}`), 0o644); err != nil {
		t.Fatalf("write sources: %v", err)
	}

	resolved, err := ResolveSourcesPath()
	if err != nil {
		t.Fatalf("ResolveSourcesPath: %v", err)
	}
	if resolved != path {
		t.Fatalf("expected %s, got %s", path, resolved)
	}
}

func TestLoadSources(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sources.json")
	payload := `{
  "version": "1",
  "allowlistHosts": ["example.com"],
  "sources": [
    {"id":"codex-doc","tier":"tier-0","client":"codex","url":"https://example.com/docs","refreshHours":24}
  ]
}`
	if err := os.WriteFile(path, []byte(payload), 0o644); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(SourcesEnvVar, path)

	reg, resolved, err := LoadSources()
	if err != nil {
		t.Fatalf("LoadSources: %v", err)
	}
	if resolved != path {
		t.Fatalf("expected %s, got %s", path, resolved)
	}
	if len(reg.Sources) != 1 {
		t.Fatalf("expected 1 source, got %d", len(reg.Sources))
	}
}
