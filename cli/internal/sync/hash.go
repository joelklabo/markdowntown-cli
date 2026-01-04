// Package sync provides helpers for CLI sync workflows.
package sync

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
)

// HashFile returns the hex-encoded SHA256 hash of a file's contents.
func HashFile(path string) (hash string, err error) {
	// #nosec G304 -- path is derived from repo traversal.
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer func() {
		if cerr := file.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	hasher := sha256.New()
	if _, err = io.Copy(hasher, file); err != nil {
		return "", err
	}

	hash = hex.EncodeToString(hasher.Sum(nil))
	return hash, err
}
