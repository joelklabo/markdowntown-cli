//go:build !linux && !js

package scan

import "errors"

var errOpenat2Unavailable = errors.New("openat2 unavailable")

func openAtNoFollowOpenat2(_ int, _ string) (int, error) {
	return -1, errOpenat2Unavailable
}
