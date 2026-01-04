//go:build !js

package scan

import (
	"errors"
	"fmt"
)

var errOpenat2Unavailable = errors.New("openat2 unavailable")

type openat2UnavailableError struct {
	cause error
}

func (err openat2UnavailableError) Error() string {
	if err.cause != nil {
		return fmt.Sprintf("%s: %v", errOpenat2Unavailable.Error(), err.cause)
	}
	return errOpenat2Unavailable.Error()
}

func (err openat2UnavailableError) Is(target error) bool {
	return target == errOpenat2Unavailable
}

func (err openat2UnavailableError) Cause() error {
	return err.cause
}

func (err openat2UnavailableError) Unwrap() error {
	return err.cause
}
