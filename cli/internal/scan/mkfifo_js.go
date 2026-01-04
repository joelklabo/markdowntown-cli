//go:build js

package scan

import "errors"

var errMkfifoUnsupported = errors.New("mkfifo unsupported")

func mkfifo(_ string, _ uint32) error {
	return errMkfifoUnsupported
}
