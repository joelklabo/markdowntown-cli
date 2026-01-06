// Package config manages persisted CLI configuration data.
package config

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

const (
	configSubdir     = "markdowntown"
	authFilename     = "auth.json"
	checkpointSubdir = "checkpoints"
)

// ErrAuthNotFound signals that no auth file exists on disk.
var ErrAuthNotFound = errors.New("auth config not found")

// ErrCheckpointNotFound signals that no checkpoint file exists for the repo.
var ErrCheckpointNotFound = errors.New("checkpoint not found")

// AuthRecord stores the CLI auth token and metadata.
type AuthRecord struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type,omitempty"`
	Scopes      []string  `json:"scopes,omitempty"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	BaseURL     string    `json:"base_url,omitempty"`
}

// UploadCheckpoint persists metadata to resume interrupted uploads.
type UploadCheckpoint struct {
	RepoRoot     string   `json:"repoRoot"`
	SnapshotID   string   `json:"snapshotId"`
	ManifestHash string   `json:"manifestHash"`
	MissingBlobs []string `json:"missingBlobs"`
	UploadURL    string   `json:"uploadUrl"`
	UpdatedAt    int64    `json:"updatedAt"`
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

// RemoveAuth deletes the auth file.
func RemoveAuth(path string) error {
	err := os.Remove(path)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrAuthNotFound
		}
		return err
	}
	return nil
}

// SaveCheckpoint persists an upload checkpoint to disk.
func SaveCheckpoint(checkpoint UploadCheckpoint) error {
	path, err := CheckpointPath(checkpoint.RepoRoot)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	checkpoint.UpdatedAt = time.Now().UnixMilli()
	data, err := json.MarshalIndent(checkpoint, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o600)
}

// LoadCheckpoint retrieves an upload checkpoint for a repo.
func LoadCheckpoint(repoRoot string) (UploadCheckpoint, error) {
	path, err := CheckpointPath(repoRoot)
	if err != nil {
		return UploadCheckpoint{}, err
	}

	// #nosec G304 -- path is derived from repo root hash.
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return UploadCheckpoint{}, ErrCheckpointNotFound
		}
		return UploadCheckpoint{}, err
	}

	var checkpoint UploadCheckpoint
	if err := json.Unmarshal(data, &checkpoint); err != nil {
		return UploadCheckpoint{}, err
	}

	return checkpoint, nil
}

// RemoveCheckpoint deletes a checkpoint file.
func RemoveCheckpoint(repoRoot string) error {
	path, err := CheckpointPath(repoRoot)
	if err != nil {
		return err
	}

	err = os.Remove(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// CheckpointPath returns the deterministic path for a repo checkpoint.
func CheckpointPath(repoRoot string) (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}

	abs, err := filepath.Abs(repoRoot)
	if err != nil {
		abs = repoRoot
	}
	sum := sha256.Sum256([]byte(abs))
	name := hex.EncodeToString(sum[:]) + ".json"

	return filepath.Join(dir, checkpointSubdir, name), nil
}
