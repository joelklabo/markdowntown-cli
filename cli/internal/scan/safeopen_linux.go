//go:build linux && !js

package scan

import (
	"errors"

	"golang.org/x/sys/unix"
)

var errOpenat2Unavailable = errors.New("openat2 unavailable")

func openAtNoFollowOpenat2(dirfd int, path string) (int, error) {
	how := &unix.OpenHow{
		Flags:   unix.O_RDONLY | unix.O_CLOEXEC,
		Resolve: unix.RESOLVE_NO_SYMLINKS,
	}
	fd, err := unix.Openat2(dirfd, path, how)
	if err != nil {
		if errors.Is(err, unix.ENOSYS) || errors.Is(err, unix.EOPNOTSUPP) || errors.Is(err, unix.EINVAL) || errors.Is(err, unix.EPERM) || errors.Is(err, unix.EACCES) {
			return -1, errOpenat2Unavailable
		}
		return -1, err
	}
	return fd, nil
}
