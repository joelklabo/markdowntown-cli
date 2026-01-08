package config

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestHomeUsesXDGConfigHome(t *testing.T) {
	customPath := "/custom/xdg/config"
	t.Setenv("XDG_CONFIG_HOME", customPath)

	got, err := Home()
	if err != nil {
		t.Fatalf("Home() returned error: %v", err)
	}

	if got != customPath {
		t.Errorf("Home() = %q, want %q", got, customPath)
	}
}

func TestHomeDefaultsToUserConfig(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", "")

	got, err := Home()
	if err != nil {
		t.Fatalf("Home() returned error: %v", err)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("os.UserHomeDir() returned error: %v", err)
	}

	want := filepath.Join(home, ".config")
	if got != want {
		t.Errorf("Home() = %q, want %q", got, want)
	}
}

func TestDirReturnsMarkdowntownSubdir(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	got, err := Dir()
	if err != nil {
		t.Fatalf("Dir() returned error: %v", err)
	}

	want := filepath.Join(tmpDir, "markdowntown")
	if got != want {
		t.Errorf("Dir() = %q, want %q", got, want)
	}
}

func TestAuthPathFormat(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	got, err := AuthPath()
	if err != nil {
		t.Fatalf("AuthPath() returned error: %v", err)
	}

	want := filepath.Join(tmpDir, "markdowntown", "auth.json")
	if got != want {
		t.Errorf("AuthPath() = %q, want %q", got, want)
	}
}

func TestSaveAndLoadAuth(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	now := time.Now().Truncate(time.Second)
	expires := now.Add(24 * time.Hour)

	original := AuthRecord{
		AccessToken: "test-token-12345",
		TokenType:   "Bearer",
		Scopes:      []string{"read", "write"},
		ExpiresAt:   expires,
		CreatedAt:   now,
		BaseURL:     "https://api.example.com",
	}

	if err := SaveAuth(original); err != nil {
		t.Fatalf("SaveAuth() returned error: %v", err)
	}

	// Verify the file was created with correct permissions (Unix only)
	authPath, _ := AuthPath()
	info, err := os.Stat(authPath)
	if err != nil {
		t.Fatalf("auth file not created: %v", err)
	}
	if runtime.GOOS != "windows" {
		if perm := info.Mode().Perm(); perm != 0o600 {
			t.Errorf("auth file permissions = %o, want %o", perm, 0o600)
		}
	}

	loaded, err := LoadAuth()
	if err != nil {
		t.Fatalf("LoadAuth() returned error: %v", err)
	}

	if loaded.AccessToken != original.AccessToken {
		t.Errorf("AccessToken = %q, want %q", loaded.AccessToken, original.AccessToken)
	}
	if loaded.TokenType != original.TokenType {
		t.Errorf("TokenType = %q, want %q", loaded.TokenType, original.TokenType)
	}
	if len(loaded.Scopes) != len(original.Scopes) {
		t.Errorf("Scopes length = %d, want %d", len(loaded.Scopes), len(original.Scopes))
	}
	for i, scope := range loaded.Scopes {
		if scope != original.Scopes[i] {
			t.Errorf("Scopes[%d] = %q, want %q", i, scope, original.Scopes[i])
		}
	}
	if !loaded.ExpiresAt.Equal(original.ExpiresAt) {
		t.Errorf("ExpiresAt = %v, want %v", loaded.ExpiresAt, original.ExpiresAt)
	}
	if !loaded.CreatedAt.Equal(original.CreatedAt) {
		t.Errorf("CreatedAt = %v, want %v", loaded.CreatedAt, original.CreatedAt)
	}
	if loaded.BaseURL != original.BaseURL {
		t.Errorf("BaseURL = %q, want %q", loaded.BaseURL, original.BaseURL)
	}
}

func TestLoadAuthNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	_, err := LoadAuth()
	if err == nil {
		t.Fatal("LoadAuth() expected error, got nil")
	}

	if !errors.Is(err, ErrAuthNotFound) {
		t.Errorf("LoadAuth() error = %v, want %v", err, ErrAuthNotFound)
	}
}
