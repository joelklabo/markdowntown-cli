//go:build !windows

package scan

import (
	"io"
	"os"

	"golang.org/x/sys/unix"
)

const safeOpenSupported = true

func safeStatPath(path string) (os.FileInfo, error) {
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_NOFOLLOW, 0)
	if err != nil {
		return nil, err
	}
	file := os.NewFile(uintptr(fd), path)
	defer func() {
		_ = file.Close()
	}()
	return file.Stat()
}

func safeReadFilePath(path string) ([]byte, error) {
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_NOFOLLOW, 0)
	if err != nil {
		return nil, err
	}
	file := os.NewFile(uintptr(fd), path)
	defer func() {
		_ = file.Close()
	}()
	return io.ReadAll(file)
}
