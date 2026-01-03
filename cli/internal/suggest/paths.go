package suggest

import (
	"os"
	"path/filepath"
)

const (
	configSubdir = "markdowntown"
	cacheSubdir  = "markdowntown"
	dataSubdir   = "markdowntown"
)

// ConfigDir returns the XDG config directory for suggest data.
func ConfigDir() (string, error) {
	home, err := xdgConfigHome()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, configSubdir), nil
}

// CacheDir returns the XDG cache directory for suggest data.
func CacheDir() (string, error) {
	home, err := xdgCacheHome()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, cacheSubdir), nil
}

// DataDir returns the XDG data directory for suggest data.
func DataDir() (string, error) {
	home, err := xdgDataHome()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, dataSubdir), nil
}

func xdgConfigHome() (string, error) {
	if path := os.Getenv("XDG_CONFIG_HOME"); path != "" {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config"), nil
}

func xdgCacheHome() (string, error) {
	if path := os.Getenv("XDG_CACHE_HOME"); path != "" {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".cache"), nil
}

func xdgDataHome() (string, error) {
	if path := os.Getenv("XDG_DATA_HOME"); path != "" {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".local", "share"), nil
}

func expandHome(path string) (string, error) {
	if path == "" {
		return path, nil
	}
	if path[0] != '~' {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	if path == "~" {
		return home, nil
	}
	if len(path) > 1 && (path[1] == '/' || path[1] == '\\') {
		return filepath.Join(home, path[2:]), nil
	}

	return path, nil
}
