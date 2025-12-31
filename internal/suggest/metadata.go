package suggest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

const (
	// MetadataVersion is the schema version for metadata storage.
	MetadataVersion = "1.0"
	// MetadataFile is the filename for persisted metadata.
	MetadataFile = "metadata.json"
)

// MetadataStore tracks fetch state for sources.
type MetadataStore struct {
	Version   string                 `json:"version"`
	UpdatedAt int64                  `json:"updatedAt"`
	Sources   []SourceMetadataRecord `json:"sources"`
}

// SourceMetadataRecord stores metadata for a single source.
type SourceMetadataRecord struct {
	ID             string `json:"id"`
	URL            string `json:"url"`
	ETag           string `json:"etag,omitempty"`
	LastModified   string `json:"lastModified,omitempty"`
	LastVerifiedAt int64  `json:"lastVerifiedAt,omitempty"`
	Hash           string `json:"hash,omitempty"`
}

// MetadataPath resolves the metadata file location in cache.
func MetadataPath() (string, error) {
	cacheDir, err := CacheDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(cacheDir, "suggest", MetadataFile), nil
}

// LoadMetadata reads metadata from disk. Missing files return an empty store.
func LoadMetadata(path string) (MetadataStore, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return MetadataStore{Version: MetadataVersion, Sources: []SourceMetadataRecord{}}, nil
		}
		return MetadataStore{}, err
	}
	if len(data) == 0 {
		return MetadataStore{Version: MetadataVersion, Sources: []SourceMetadataRecord{}}, nil
	}

	var store MetadataStore
	if err := json.Unmarshal(data, &store); err != nil {
		return MetadataStore{}, err
	}
	if store.Version == "" {
		store.Version = MetadataVersion
	}
	store.Sources = sortedMetadata(store.Sources)
	return store, nil
}

// SaveMetadata writes metadata to disk with deterministic ordering.
func SaveMetadata(path string, store MetadataStore) error {
	if store.Version == "" {
		store.Version = MetadataVersion
	}
	store.UpdatedAt = time.Now().UnixMilli()
	store.Sources = sortedMetadata(store.Sources)

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir metadata dir: %w", err)
	}

	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o644)
}

func sortedMetadata(records []SourceMetadataRecord) []SourceMetadataRecord {
	clone := append([]SourceMetadataRecord(nil), records...)
	sort.Slice(clone, func(i, j int) bool {
		if clone[i].ID == clone[j].ID {
			return clone[i].URL < clone[j].URL
		}
		return clone[i].ID < clone[j].ID
	})
	return clone
}
