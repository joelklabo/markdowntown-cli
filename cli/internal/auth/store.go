package auth

import (
	"markdowntown-cli/internal/config"
)

// SaveResult describes where auth was stored and any non-fatal warning.
type SaveResult struct {
	Location string
	Warning  error
}

// SaveAuth persists the auth record to disk.
func SaveAuth(record config.AuthRecord) (SaveResult, error) {
	if err := config.SaveAuth(record); err != nil {
		return SaveResult{}, err
	}
	path, err := config.AuthPath()
	if err != nil {
		return SaveResult{Location: "local file"}, nil
	}
	return SaveResult{Location: path}, nil
}

// LoadAuth loads the auth record from disk.
func LoadAuth() (config.AuthRecord, SaveResult, error) {
	path, err := config.AuthPath()
	if err != nil {
		return config.AuthRecord{}, SaveResult{}, err
	}

	record, err := config.LoadAuth()
	if err != nil {
		return config.AuthRecord{}, SaveResult{Location: path}, err
	}

	return record, SaveResult{Location: path}, nil
}
