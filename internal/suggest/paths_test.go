package suggest

import (
	"os"
	"path/filepath"
	"testing"
)

func TestXDGPaths(t *testing.T) {
	configHome := t.TempDir()
	cacheHome := t.TempDir()
	dataHome := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", configHome)
	t.Setenv("XDG_CACHE_HOME", cacheHome)
	t.Setenv("XDG_DATA_HOME", dataHome)

	configDir, err := ConfigDir()
	if err != nil {
		t.Fatalf("ConfigDir: %v", err)
	}
	if configDir != filepath.Join(configHome, configSubdir) {
		t.Fatalf("unexpected config dir: %s", configDir)
	}

	cacheDir, err := CacheDir()
	if err != nil {
		t.Fatalf("CacheDir: %v", err)
	}
	if cacheDir != filepath.Join(cacheHome, cacheSubdir) {
		t.Fatalf("unexpected cache dir: %s", cacheDir)
	}

	dataDir, err := DataDir()
	if err != nil {
		t.Fatalf("DataDir: %v", err)
	}
	if dataDir != filepath.Join(dataHome, dataSubdir) {
		t.Fatalf("unexpected data dir: %s", dataDir)
	}
}

func TestExpandHome(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("UserHomeDir: %v", err)
	}

	expanded, err := expandHome("~")
	if err != nil {
		t.Fatalf("expandHome: %v", err)
	}
	if expanded != home {
		t.Fatalf("expected home %s, got %s", home, expanded)
	}

	expanded, err = expandHome("~/docs")
	if err != nil {
		t.Fatalf("expandHome: %v", err)
	}
	if expanded != filepath.Join(home, "docs") {
		t.Fatalf("unexpected expanded path: %s", expanded)
	}

	expanded, err = expandHome("relative")
	if err != nil {
		t.Fatalf("expandHome: %v", err)
	}
	if expanded != "relative" {
		t.Fatalf("expected relative path, got %s", expanded)
	}
}
