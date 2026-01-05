package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"markdowntown-cli/internal/auth"
	"markdowntown-cli/internal/config"
)

func TestRunLoginWithTokenFlag(t *testing.T) {
	cfgDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", cfgDir)

	var stdout, stderr bytes.Buffer
	err := runLoginWithIO(&stdout, &stderr, []string{
		"--token", "secret-token",
		"--base-url", "https://example.test",
		"--scopes", "cli:upload,cli:run",
	})
	if err != nil {
		t.Fatalf("runLoginWithIO: %v", err)
	}

	record := readAuthRecord(t, cfgDir)
	if record.AccessToken != "secret-token" {
		t.Fatalf("expected token to be saved")
	}
	if record.BaseURL != "https://example.test" {
		t.Fatalf("expected base url to be saved, got %q", record.BaseURL)
	}
	if record.CreatedAt.IsZero() {
		t.Fatalf("expected createdAt to be set")
	}
	if !record.ExpiresAt.IsZero() {
		t.Fatalf("expected expiresAt to be zero for manual tokens")
	}
	if len(record.Scopes) != 2 || record.Scopes[0] != "cli:upload" || record.Scopes[1] != "cli:run" {
		t.Fatalf("expected scopes to be parsed, got %v", record.Scopes)
	}
	if !strings.Contains(stdout.String(), "Token stored") {
		t.Fatalf("expected success output, got %q", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("expected no stderr output, got %q", stderr.String())
	}
}

func TestRunLoginWithTokenFromStdin(t *testing.T) {
	cfgDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", cfgDir)
	t.Setenv(auth.BaseURLEnvVar, "https://env.example.com")

	withStdin(t, "stdin-token\n", func() {
		var stdout bytes.Buffer
		if err := runLoginWithIO(&stdout, os.Stderr, []string{"--token-stdin"}); err != nil {
			t.Fatalf("runLoginWithIO: %v", err)
		}
	})

	record := readAuthRecord(t, cfgDir)
	if record.AccessToken != "stdin-token" {
		t.Fatalf("expected token from stdin to be saved")
	}
	if record.BaseURL != "https://env.example.com" {
		t.Fatalf("expected base url from env, got %q", record.BaseURL)
	}
}

func TestRunLoginWithEmptyTokenFlag(t *testing.T) {
	err := runLoginWithIO(io.Discard, io.Discard, []string{"--token", ""})
	if err == nil || !strings.Contains(err.Error(), "token must not be empty") {
		t.Fatalf("expected empty token error, got %v", err)
	}
}

func TestRunLoginWithEmptyTokenStdin(t *testing.T) {
	withStdin(t, "\n", func() {
		err := runLoginWithIO(io.Discard, io.Discard, []string{"--token-stdin"})
		if err == nil || !strings.Contains(err.Error(), "no token provided via stdin") {
			t.Fatalf("expected stdin token error, got %v", err)
		}
	})
}

func readAuthRecord(t *testing.T, cfgDir string) config.AuthRecord {
	t.Helper()
	path := filepath.Join(cfgDir, "markdowntown", "auth.json")
	// #nosec G304 -- path is constructed from a temp XDG_CONFIG_HOME in tests.
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read auth file: %v", err)
	}
	var record config.AuthRecord
	if err := json.Unmarshal(data, &record); err != nil {
		t.Fatalf("unmarshal auth: %v", err)
	}
	return record
}
