// Package config manages persisted CLI configuration data.
package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

const (
	configSubdir = "markdowntown"
	authFilename = "auth.json"
)

// ErrAuthNotFound signals that no auth file exists on disk.
var ErrAuthNotFound = errors.New("auth config not found")

// AuthRecord stores the CLI auth token and metadata.
type AuthRecord struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type,omitempty"`
	Scopes      []string  `json:"scopes,omitempty"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	BaseURL     string    `json:"base_url,omitempty"`
}

// Home returns the base XDG config directory.
func Home() (string, error) {
	if path := os.Getenv("XDG_CONFIG_HOME"); path != "" {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config"), nil
}

// Dir returns the markdowntown config directory.
func Dir() (string, error) {
	home, err := Home()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, configSubdir), nil
}

// AuthPath returns the path to the auth config file.
func AuthPath() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, authFilename), nil
}

// SaveAuth writes auth data to disk with 0600 permissions.
func SaveAuth(record AuthRecord) error {
	path, err := AuthPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	data, err := json.Marshal(record)
	if err != nil {
		return err
	}

	if err := os.WriteFile(path, data, 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

// LoadAuth reads the auth file from disk.
func LoadAuth() (AuthRecord, error) {
	path, err := AuthPath()
	if err != nil {
		return AuthRecord{}, err
	}

	// #nosec G304 -- path is derived from XDG config or user home.
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return AuthRecord{}, ErrAuthNotFound
		}
		return AuthRecord{}, err
	}

	var record AuthRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return AuthRecord{}, err
	}

	return record, nil
}
