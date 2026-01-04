//go:build !windows && !js

package scan

import (
	"errors"
	"syscall"
)

var errMkfifoUnsupported = errors.New("mkfifo unsupported")

func mkfifo(path string, mode uint32) error {
	return syscall.Mkfifo(path, mode)
}
