package auth

import (
	"encoding/json"
	"errors"
	"fmt"

	"markdowntown-cli/internal/config"

	"github.com/zalando/go-keyring"
)

const (
	keyringService = "markdowntown"
	keyringUser    = "cli-token"
)

// StoreResult captures where the auth record was stored.
type StoreResult struct {
	Location string
	Warning  error
}

// SaveAuth stores the auth record in the OS keyring, falling back to disk.
func SaveAuth(record config.AuthRecord) (StoreResult, error) {
	payload, err := json.Marshal(record)
	if err != nil {
		return StoreResult{}, err
	}

	keyringErr := keyring.Set(keyringService, keyringUser, string(payload))
	if keyringErr == nil {
		return StoreResult{Location: "keyring"}, nil
	}

	if fileErr := config.SaveAuth(record); fileErr != nil {
		return StoreResult{}, fmt.Errorf("keyring error: %v; file error: %w", keyringErr, fileErr)
	}
	return StoreResult{Location: "file", Warning: keyringErr}, nil
}

// LoadAuth loads the auth record from keyring or disk.
func LoadAuth() (config.AuthRecord, string, error) {
	secret, err := keyring.Get(keyringService, keyringUser)
	if err == nil {
		var record config.AuthRecord
		if err := json.Unmarshal([]byte(secret), &record); err != nil {
			return config.AuthRecord{}, "keyring", err
		}
		return record, "keyring", nil
	}

	fileRecord, fileErr := config.LoadAuth()
	if fileErr == nil {
		return fileRecord, "file", nil
	}

	if errors.Is(err, keyring.ErrNotFound) && errors.Is(fileErr, config.ErrAuthNotFound) {
		return config.AuthRecord{}, "", config.ErrAuthNotFound
	}

	return config.AuthRecord{}, "", fmt.Errorf("auth lookup failed (keyring: %v; file: %w)", err, fileErr)
}
