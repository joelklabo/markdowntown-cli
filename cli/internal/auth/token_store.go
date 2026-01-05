package auth

import (
	"errors"
	"markdowntown-cli/internal/config"
	"time"
)

// TokenStore defines the interface for managing CLI tokens.
type TokenStore interface {
	Save(token string, expiresAt time.Time, baseURL string) error
	Load() (config.AuthRecord, error)
	Delete() error
}

type fileTokenStore struct{}

// NewFileTokenStore creates a new token store based on the config file.
func NewFileTokenStore() TokenStore {
	return &fileTokenStore{}
}

func (s *fileTokenStore) Save(token string, expiresAt time.Time, baseURL string) error {
	record := config.AuthRecord{
		AccessToken: token,
		ExpiresAt:   expiresAt,
		CreatedAt:   time.Now(),
		BaseURL:     baseURL,
	}
	return config.SaveAuth(record)
}

func (s *fileTokenStore) Load() (config.AuthRecord, error) {
	return config.LoadAuth()
}

func (s *fileTokenStore) Delete() error {
	path, err := config.AuthPath()
	if err != nil {
		return err
	}
	err = config.RemoveAuth(path)
	if err != nil && !errors.Is(err, config.ErrAuthNotFound) {
		return err
	}
	return nil
}
