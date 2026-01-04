//go:build js

package scan

import "os"

const safeOpenSupported = false

func safeStatPath(path string) (os.FileInfo, error) {
	return os.Stat(path)
}

func safeReadFilePath(_ string, path string) ([]byte, error) {
	return os.ReadFile(path)
}
