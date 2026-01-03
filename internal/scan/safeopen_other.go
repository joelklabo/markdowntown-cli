//go:build windows

package scan

import "os"

const safeOpenSupported = false

func safeStatPath(path string) (os.FileInfo, error) {
	return os.Stat(path)
}

func safeReadFilePath(path string) ([]byte, error) {
	return os.ReadFile(path)
}
