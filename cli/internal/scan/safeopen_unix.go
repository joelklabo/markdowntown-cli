//go:build !windows && !js

package scan

import (
	"errors"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/sys/unix"
)

const safeOpenSupported = true

var openat2FallbackOnce sync.Once

func safeStatPath(path string) (os.FileInfo, error) {
	file, err := openNoFollowAbsolute(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = file.Close()
	}()
	return file.Stat()
}

func safeReadFilePath(root string, path string) ([]byte, error) {
	if root == "" {
		return nil, fs.ErrInvalid
	}
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return nil, err
	}
	if rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return nil, fs.ErrInvalid
	}
	parts, err := splitPathComponents(rel)
	if err != nil {
		return nil, err
	}
	file, err := openNoFollowRelative(root, parts, path)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = file.Close()
	}()
	return io.ReadAll(file)
}

func openNoFollowAbsolute(path string) (*os.File, error) {
	if !filepath.IsAbs(path) {
		return nil, fs.ErrInvalid
	}
	clean := filepath.Clean(path)
	if clean == string(os.PathSeparator) {
		fd, err := unix.Open(clean, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
		if err != nil {
			return nil, err
		}
		return os.NewFile(uintptr(fd), clean), nil
	}
	relPath := strings.TrimPrefix(clean, string(os.PathSeparator))
	parts, err := splitPathComponents(relPath)
	if err != nil {
		return nil, err
	}
	rootfd, err := unix.Open(string(os.PathSeparator), unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = unix.Close(rootfd)
	}()
	fd, err := openAtNoFollowOpenat2(rootfd, relPath)
	if err == nil {
		return os.NewFile(uintptr(fd), clean), nil
	}
	if !errors.Is(err, errOpenat2Unavailable) {
		return nil, err
	}
	logOpenat2FallbackOnce(string(os.PathSeparator), err)
	fd, err = openAtNoFollow(rootfd, parts)
	if err != nil {
		return nil, err
	}
	if err := verifyFdWithinRoot(rootfd, relPath, fd); err != nil {
		_ = unix.Close(fd)
		return nil, err
	}
	return os.NewFile(uintptr(fd), clean), nil
}

func openNoFollowRelative(root string, parts []string, path string) (*os.File, error) {
	if len(parts) == 0 {
		return nil, fs.ErrInvalid
	}
	rootfd, err := unix.Open(root, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = unix.Close(rootfd)
	}()
	relPath := filepath.Join(parts...)
	fd, err := openAtNoFollowOpenat2(rootfd, relPath)
	if err == nil {
		return os.NewFile(uintptr(fd), path), nil
	}
	if !errors.Is(err, errOpenat2Unavailable) {
		return nil, err
	}
	logOpenat2FallbackOnce(root, err)
	fd, err = openAtNoFollow(rootfd, parts)
	if err != nil {
		return nil, err
	}
	if err := verifyFdWithinRoot(rootfd, relPath, fd); err != nil {
		_ = unix.Close(fd)
		return nil, err
	}
	return os.NewFile(uintptr(fd), path), nil
}

func openAtNoFollow(dirfd int, parts []string) (int, error) {
	fd := dirfd
	if len(parts) == 0 {
		return fd, nil
	}
	for i, part := range parts {
		if part == "" || part == "." || part == ".." {
			return -1, fs.ErrInvalid
		}
		flags := unix.O_RDONLY | unix.O_NOFOLLOW | unix.O_CLOEXEC
		if i < len(parts)-1 {
			flags |= unix.O_DIRECTORY
		}
		nextFD, err := unix.Openat(fd, part, flags, 0)
		if err != nil {
			if fd != dirfd {
				_ = unix.Close(fd)
			}
			return -1, err
		}
		if fd != dirfd {
			_ = unix.Close(fd)
		}
		fd = nextFD
	}
	return fd, nil
}

func verifyFdWithinRoot(rootfd int, relPath string, fd int) error {
	if relPath == "" {
		return fs.ErrInvalid
	}
	var fdStat unix.Stat_t
	if err := unix.Fstat(fd, &fdStat); err != nil {
		return err
	}
	var pathStat unix.Stat_t
	if err := unix.Fstatat(rootfd, relPath, &pathStat, unix.AT_SYMLINK_NOFOLLOW); err != nil {
		return err
	}
	if fdStat.Dev != pathStat.Dev || fdStat.Ino != pathStat.Ino {
		return fs.ErrInvalid
	}
	return nil
}

func logOpenat2FallbackOnce(root string, err error) {
	openat2FallbackOnce.Do(func() {
		cause := err
		var fallbackErr openat2UnavailableError
		if errors.As(err, &fallbackErr) && fallbackErr.cause != nil {
			cause = fallbackErr.cause
		}
		log.Printf("scan: openat2 unavailable; falling back to safe-open verification (verify=true root=%q err=%v)", root, cause)
	})
}

func splitPathComponents(path string) ([]string, error) {
	if path == "" {
		return nil, nil
	}
	parts := strings.Split(path, string(filepath.Separator))
	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return nil, fs.ErrInvalid
		}
	}
	return parts, nil
}
