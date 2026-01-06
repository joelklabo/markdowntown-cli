//go:build !linux && !windows && !js

package scan

func openAtNoFollowOpenat2(_ int, _ string) (int, error) {
	return -1, openat2UnavailableError{cause: nil}
}
