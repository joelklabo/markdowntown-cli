package auth

import (
	"errors"
	"markdowntown-cli/internal/config"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestFileTokenStoreSaveAndLoad(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("HOME", tempDir)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(tempDir, ".config"))

	store := NewFileTokenStore()

	token := "test-token-123"
	expiresAt := time.Now().Add(24 * time.Hour)
	baseURL := "https://markdowntown.app"

	if err := store.Save(token, expiresAt, baseURL); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	record, err := store.Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if record.AccessToken != token {
		t.Errorf("expected token %q, got %q", token, record.AccessToken)
	}
	if record.BaseURL != baseURL {
		t.Errorf("expected baseURL %q, got %q", baseURL, record.BaseURL)
	}
	if record.ExpiresAt.Unix() != expiresAt.Unix() {
		t.Errorf("expected expiresAt %v, got %v", expiresAt, record.ExpiresAt)
	}
}

func TestFileTokenStoreLoadMissing(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("HOME", tempDir)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(tempDir, ".config"))

	store := NewFileTokenStore()

	_, err := store.Load()
	if err == nil {
		t.Fatal("expected error when loading missing token")
	}
	if !errors.Is(err, config.ErrAuthNotFound) {
		t.Errorf("expected ErrAuthNotFound, got %v", err)
	}
}

func TestFileTokenStoreDelete(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("HOME", tempDir)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(tempDir, ".config"))

	store := NewFileTokenStore()

	token := "test-token-456"
	expiresAt := time.Now().Add(24 * time.Hour)
	baseURL := "https://markdowntown.app"

	if err := store.Save(token, expiresAt, baseURL); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	if err := store.Delete(); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	_, err := store.Load()
	if err == nil {
		t.Fatal("expected error after delete")
	}
	if !errors.Is(err, config.ErrAuthNotFound) {
		t.Errorf("expected ErrAuthNotFound after delete, got %v", err)
	}
}

func TestFileTokenStoreDeleteMissing(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("HOME", tempDir)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(tempDir, ".config"))

	store := NewFileTokenStore()

	// Delete should succeed even if no token exists
	if err := store.Delete(); err != nil {
		t.Fatalf("Delete of missing token failed: %v", err)
	}
}

func TestFileTokenStoreFilePermissionError(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("skipping test when running as root")
	}

	tempDir := t.TempDir()

	// Test if the filesystem actually enforces permission checks
	testDir := filepath.Join(tempDir, "perm-test")
	if err := os.MkdirAll(testDir, 0o750); err != nil {
		t.Fatalf("failed to create test dir: %v", err)
	}
	// #nosec G302 -- setting directory permissions for test.
	if err := os.Chmod(testDir, 0o555); err != nil {
		t.Fatalf("failed to set read-only: %v", err)
	}
	testFile := filepath.Join(testDir, "testfile")
	// #nosec G306 -- test file permissions
	if err := os.WriteFile(testFile, []byte("test"), 0o644); err == nil {
		// Filesystem doesn't enforce permissions (e.g., some CI environments)
		// #nosec G302 -- restoring directory permissions for test.
		_ = os.Chmod(testDir, 0o750)
		t.Skip("filesystem does not enforce permission checks")
	}
	// #nosec G302 -- restoring directory permissions for test.
	_ = os.Chmod(testDir, 0o750)

	t.Setenv("HOME", tempDir)
	configDir := filepath.Join(tempDir, ".config", "markdowntown")
	if err := os.MkdirAll(configDir, 0o750); err != nil {
		t.Fatalf("failed to create config dir: %v", err)
	}

	// Create read-only directory
	// #nosec G302 -- setting directory permissions for test.
	if err := os.Chmod(configDir, 0o555); err != nil {
		t.Fatalf("failed to set read-only: %v", err)
	}
	t.Cleanup(func() {
		// #nosec G302 -- restoring directory permissions for test.
		_ = os.Chmod(configDir, 0o750)
	})

	store := NewFileTokenStore()

	token := "test-token-789"
	expiresAt := time.Now().Add(24 * time.Hour)
	baseURL := "https://markdowntown.app"

	err := store.Save(token, expiresAt, baseURL)
	if err == nil {
		t.Fatal("expected error when saving to read-only directory")
	}
}
