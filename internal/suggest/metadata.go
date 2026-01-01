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

// MetadataFileStore implements MetadataWriter with on-disk persistence.
type MetadataFileStore struct {
	path  string
	store MetadataStore
}

// LoadMetadataStore loads metadata and prepares a file-backed store.
func LoadMetadataStore(path string) (*MetadataFileStore, error) {
	store, err := LoadMetadata(path)
	if err != nil {
		return nil, err
	}
	return &MetadataFileStore{path: path, store: store}, nil
}

// Get returns the stored metadata for a source.
func (m *MetadataFileStore) Get(id, url string) (MetadataRecord, bool) {
	for _, rec := range m.store.Sources {
		if rec.ID == id && rec.URL == url {
			return MetadataRecord{
				ID:             rec.ID,
				URL:            rec.URL,
				ETag:           rec.ETag,
				LastModified:   rec.LastModified,
				LastVerifiedAt: rec.LastVerifiedAt,
			}, true
		}
	}
	return MetadataRecord{}, false
}

// Put updates a stored metadata record.
func (m *MetadataFileStore) Put(record MetadataRecord) {
	for i, rec := range m.store.Sources {
		if rec.ID == record.ID && rec.URL == record.URL {
			m.store.Sources[i].ETag = record.ETag
			m.store.Sources[i].LastModified = record.LastModified
			m.store.Sources[i].LastVerifiedAt = record.LastVerifiedAt
			return
		}
	}
	m.store.Sources = append(m.store.Sources, SourceMetadataRecord{
		ID:             record.ID,
		URL:            record.URL,
		ETag:           record.ETag,
		LastModified:   record.LastModified,
		LastVerifiedAt: record.LastVerifiedAt,
	})
}

// Save persists metadata to disk.
func (m *MetadataFileStore) Save() error {
	return SaveMetadata(m.path, m.store)
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
	// #nosec G304 -- metadata path is controlled by cache/config helpers.
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

	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return fmt.Errorf("mkdir metadata dir: %w", err)
	}

	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o600)
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
