package suggest

import (
	"fmt"
	"os"
	"path/filepath"

	scanhash "markdowntown-cli/internal/hash"
)

const cacheSnapshotsDir = "suggest/snapshots"

// FileCache stores fetched source bodies on disk.
type FileCache struct {
	root string
}

// NewFileCache initializes a cache rooted in XDG data.
func NewFileCache() (*FileCache, error) {
	dataDir, err := DataDir()
	if err != nil {
		return nil, err
	}
	return &FileCache{root: filepath.Join(dataDir, cacheSnapshotsDir)}, nil
}

// Get loads a cached body for the URL.
func (c *FileCache) Get(url string) ([]byte, bool) {
	path := c.pathFor(url)
	// #nosec G304 -- cache path is derived from controlled hash.
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}
	return data, true
}

// Put writes a cached body for the URL.
func (c *FileCache) Put(url string, payload []byte) error {
	path := c.pathFor(url)
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return fmt.Errorf("mkdir cache dir: %w", err)
	}
	return os.WriteFile(path, payload, 0o600)
}

func (c *FileCache) pathFor(url string) string {
	name := scanhash.SumHex([]byte(url)) + ".body"
	return filepath.Join(c.root, name)
}
