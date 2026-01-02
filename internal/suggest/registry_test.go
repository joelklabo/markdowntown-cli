package suggest

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRegistry(t *testing.T) {
	base := SourceRegistry{
		Version:        "1.0",
		AllowlistHosts: []string{"example.com"},
		Sources: []Source{
			{
				ID:           "example",
				Tier:         "tier-0",
				Client:       "codex",
				URL:          "https://example.com/docs",
				RefreshHours: 24,
			},
		},
	}

	t.Run("valid", func(t *testing.T) {
		if err := ValidateSources(base); err != nil {
			t.Fatalf("expected valid registry, got %v", err)
		}
	})

	t.Run("invalid tier", func(t *testing.T) {
		reg := base
		reg.Sources[0].Tier = "tier-x"
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for invalid tier")
		}
	})

	t.Run("duplicate url", func(t *testing.T) {
		reg := base
		reg.Sources = append(reg.Sources, Source{
			ID:           "dup",
			Tier:         "tier-1",
			Client:       "codex",
			URL:          "https://example.com/docs",
			RefreshHours: 24,
		})
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for duplicate url")
		}
	})

	t.Run("missing version", func(t *testing.T) {
		reg := base
		reg.Version = ""
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for missing version")
		}
	})

	t.Run("invalid allowlist host", func(t *testing.T) {
		reg := base
		reg.AllowlistHosts = []string{"https://example.com"}
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for allowlist host with scheme")
		}
	})

	t.Run("non-https source", func(t *testing.T) {
		reg := base
		reg.Sources[0].URL = "http://example.com/docs"
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for non-https url")
		}
	})

	t.Run("unsafe path", func(t *testing.T) {
		reg := base
		reg.Sources[0].URL = "https://example.com/../secret"
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for unsafe path")
		}
	})
}

func TestResolveSourcesPathOverrideMissing(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.json")
	t.Setenv(SourcesEnvVar, missing)
	if _, err := ResolveSourcesPath(); !errors.Is(err, ErrSourcesPathMissing) {
		t.Fatalf("expected ErrSourcesPathMissing, got %v", err)
	}
}

func TestResolveSourcesPathOverrideOk(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "doc-sources.json")
	if err := os.WriteFile(path, []byte(`{"version":"1","allowlistHosts":["example.com"],"sources":[{"id":"one","tier":"tier-0","client":"codex","url":"https://example.com/docs","refreshHours":24}]}`), 0o600); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(SourcesEnvVar, path)
	got, err := ResolveSourcesPath()
	if err != nil {
		t.Fatalf("ResolveSourcesPath: %v", err)
	}
	if got != path {
		t.Fatalf("expected %s, got %s", path, got)
	}
}

func TestResolveSourcesPathOverrideExpandsHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	path := filepath.Join(home, "docs", "sources.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(`{"version":"1","allowlistHosts":["example.com"],"sources":[{"id":"one","tier":"tier-0","client":"codex","url":"https://example.com/docs","refreshHours":24}]}`), 0o600); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(SourcesEnvVar, filepath.Join("~", "docs", "sources.json"))
	got, err := ResolveSourcesPath()
	if err != nil {
		t.Fatalf("ResolveSourcesPath: %v", err)
	}
	if got != path {
		t.Fatalf("expected %s, got %s", path, got)
	}
}

func TestResolveSourcesPathNotFound(t *testing.T) {
	t.Setenv(SourcesEnvVar, "")
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	etcPath := filepath.Join(SourcesEtcPath, SourcesFile)
	if _, err := os.Stat(etcPath); err == nil {
		t.Skip("system registry present; cannot assert not found")
	}
	if exe, err := os.Executable(); err == nil {
		exePath := filepath.Join(filepath.Dir(exe), SourcesFile)
		if _, err := os.Stat(exePath); err == nil {
			t.Skip("executable-adjacent registry present; cannot assert not found")
		}
	}

	if _, err := ResolveSourcesPath(); !errors.Is(err, ErrSourcesNotFound) {
		t.Fatalf("expected ErrSourcesNotFound, got %v", err)
	}
}

func TestLoadSourcesInvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "doc-sources.json")
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(SourcesEnvVar, path)
	if _, _, err := LoadSources(); err == nil || !strings.Contains(err.Error(), "parse sources") {
		t.Fatalf("expected parse sources error, got %v", err)
	}
}

func TestLoadSourcesSuccess(t *testing.T) {
	path := filepath.Join(t.TempDir(), "doc-sources.json")
	payload := `{
  "version": "1.0",
  "allowlistHosts": ["example.com"],
  "sources": [
    {"id":"codex-doc","tier":"tier-0","client":"codex","url":"https://example.com/codex.md","refreshHours":24}
  ]
}`
	if err := os.WriteFile(path, []byte(payload), 0o600); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(SourcesEnvVar, path)

	reg, gotPath, err := LoadSources()
	if err != nil {
		t.Fatalf("LoadSources: %v", err)
	}
	if gotPath != path {
		t.Fatalf("expected path %s, got %s", path, gotPath)
	}
	if reg.Version != "1.0" || len(reg.Sources) != 1 {
		t.Fatalf("unexpected registry: %#v", reg)
	}
}

func TestValidateSourcesAdditionalCases(t *testing.T) {
	base := SourceRegistry{
		Version:        "1.0",
		AllowlistHosts: []string{"example.com"},
		Sources: []Source{
			{
				ID:           "example",
				Tier:         "tier-0",
				Client:       "codex",
				URL:          "https://example.com/docs",
				RefreshHours: 24,
			},
		},
	}

	cases := []struct {
		name string
		mod  func(reg *SourceRegistry)
	}{
		{
			name: "missing allowlist",
			mod:  func(reg *SourceRegistry) { reg.AllowlistHosts = nil },
		},
		{
			name: "empty allowlist entry",
			mod:  func(reg *SourceRegistry) { reg.AllowlistHosts = []string{""} },
		},
		{
			name: "allowlist host contains path",
			mod:  func(reg *SourceRegistry) { reg.AllowlistHosts = []string{"example.com/path"} },
		},
		{
			name: "duplicate source id",
			mod: func(reg *SourceRegistry) {
				reg.Sources = append(reg.Sources, Source{
					ID:           "example",
					Tier:         "tier-1",
					Client:       "codex",
					URL:          "https://example.com/other",
					RefreshHours: 24,
				})
			},
		},
		{
			name: "missing client",
			mod:  func(reg *SourceRegistry) { reg.Sources[0].Client = "" },
		},
		{
			name: "missing url",
			mod:  func(reg *SourceRegistry) { reg.Sources[0].URL = "" },
		},
		{
			name: "invalid url",
			mod:  func(reg *SourceRegistry) { reg.Sources[0].URL = "https://%zz" },
		},
		{
			name: "host not allowlisted",
			mod:  func(reg *SourceRegistry) { reg.Sources[0].URL = "https://other.com/docs" },
		},
		{
			name: "missing host",
			mod:  func(reg *SourceRegistry) { reg.Sources[0].URL = "https:///docs" },
		},
		{
			name: "unsafe path with backslash",
			mod:  func(reg *SourceRegistry) { reg.Sources[0].URL = "https://example.com/dir\\file" },
		},
		{
			name: "missing refresh hours",
			mod:  func(reg *SourceRegistry) { reg.Sources[0].RefreshHours = 0 },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			reg := base
			tc.mod(&reg)
			if err := ValidateSources(reg); err == nil {
				t.Fatalf("expected error")
			}
		})
	}
}

func TestResolveSourcesPathMultiple(t *testing.T) {
	dir := t.TempDir()
	configHome := filepath.Join(dir, "config")
	t.Setenv("XDG_CONFIG_HOME", configHome)
	t.Setenv(SourcesEnvVar, "")

	configPath := filepath.Join(configHome, SourcesSubdir, SourcesFile)
	if err := os.MkdirAll(filepath.Dir(configPath), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	exe, err := os.Executable()
	if err != nil {
		t.Skip("executable not available")
	}
	exePath := filepath.Join(filepath.Dir(exe), SourcesFile)
	if err := os.WriteFile(exePath, []byte("{}"), 0o600); err != nil {
		t.Skip("unable to write adjacent registry")
	}
	t.Cleanup(func() {
		_ = os.Remove(exePath)
	})

	if _, err := ResolveSourcesPath(); !errors.Is(err, ErrMultipleSources) {
		t.Fatalf("expected ErrMultipleSources, got %v", err)
	}
}

func TestResolveSourcesPathSkipsDirectoryCandidate(t *testing.T) {
	dir := t.TempDir()
	configHome := filepath.Join(dir, "config")
	t.Setenv("XDG_CONFIG_HOME", configHome)
	t.Setenv(SourcesEnvVar, "")

	configPath := filepath.Join(configHome, SourcesSubdir, SourcesFile)
	if err := os.MkdirAll(configPath, 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	etcPath := filepath.Join(SourcesEtcPath, SourcesFile)
	if _, err := os.Stat(etcPath); err == nil {
		t.Skip("system registry present; cannot assert not found")
	}
	if exe, err := os.Executable(); err == nil {
		exePath := filepath.Join(filepath.Dir(exe), SourcesFile)
		if _, err := os.Stat(exePath); err == nil {
			t.Skip("executable-adjacent registry present; cannot assert not found")
		}
	}

	if _, err := ResolveSourcesPath(); !errors.Is(err, ErrSourcesNotFound) {
		t.Fatalf("expected ErrSourcesNotFound, got %v", err)
	}
}
