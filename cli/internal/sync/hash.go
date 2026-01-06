// Package sync provides helpers for CLI sync workflows.
package sync

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

// HashFile returns the hex-encoded SHA256 hash of a file's contents.
func HashFile(path string) (string, error) {
	return HashFileWithLimit(path, 0)
}

// HashFileWithLimit returns the hex-encoded SHA256 hash of a file's contents,
// capped at maxBytes. If maxBytes > 0 and the file is larger, it returns an error.
func HashFileWithLimit(path string, maxBytes int64) (hash string, err error) {
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
	var reader io.Reader = file
	if maxBytes > 0 {
		reader = &io.LimitedReader{R: file, N: maxBytes + 1}
	}

	n, err := io.Copy(hasher, reader)
	if err != nil {
		return "", err
	}

	if maxBytes > 0 && n > maxBytes {
		return "", fmt.Errorf("file exceeds maximum size of %d bytes", maxBytes)
	}

	hash = hex.EncodeToString(hasher.Sum(nil))
	return hash, err
}
