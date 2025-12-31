// Package hash provides hashing helpers for scan output.
package hash

import (
	"crypto/sha256"
	"encoding/hex"
)

// SumHex returns the hex-encoded SHA256 digest for data.
func SumHex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
