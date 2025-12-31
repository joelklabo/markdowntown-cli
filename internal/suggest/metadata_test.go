package suggest

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMetadataLoadMissing(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing.json")
	store, err := LoadMetadata(path)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if store.Version == "" {
		t.Fatal("expected version to be set")
	}
	if len(store.Sources) != 0 {
		t.Fatalf("expected empty sources, got %d", len(store.Sources))
	}
}

func TestMetadataSaveLoad(t *testing.T) {
	path := filepath.Join(t.TempDir(), "metadata.json")
	store := MetadataStore{
		Sources: []SourceMetadataRecord{
			{ID: "b", URL: "https://example.com/b"},
			{ID: "a", URL: "https://example.com/a"},
		},
	}

	if err := SaveMetadata(path, store); err != nil {
		t.Fatalf("save failed: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("metadata file missing: %v", err)
	}

	loaded, err := LoadMetadata(path)
	if err != nil {
		t.Fatalf("load failed: %v", err)
	}
	if len(loaded.Sources) != 2 {
		t.Fatalf("expected 2 sources, got %d", len(loaded.Sources))
	}
	if loaded.Sources[0].ID != "a" {
		t.Fatalf("expected sorted sources, got %s", loaded.Sources[0].ID)
	}
}

func TestMetadataPathUsesXDG(t *testing.T) {
	cache := t.TempDir()
	t.Setenv("XDG_CACHE_HOME", cache)
	path, err := MetadataPath()
	if err != nil {
		t.Fatalf("metadata path: %v", err)
	}
	expectedSuffix := filepath.Join("markdowntown", "suggest", MetadataFile)
	if !strings.HasSuffix(path, expectedSuffix) {
		t.Fatalf("expected metadata path to end with %s, got %s", expectedSuffix, path)
	}
}

func TestMetadataLoadInvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "metadata.json")
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
		t.Fatalf("write metadata: %v", err)
	}
	if _, err := LoadMetadata(path); err == nil {
		t.Fatalf("expected error for invalid json")
	}
}

func TestMetadataFileStoreGetPut(t *testing.T) {
	path := filepath.Join(t.TempDir(), "metadata.json")
	store, err := LoadMetadataStore(path)
	if err != nil {
		t.Fatalf("load store: %v", err)
	}

	record := MetadataRecord{
		ID:             "src",
		URL:            "https://example.com/docs",
		ETag:           "etag-1",
		LastModified:   "now",
		LastVerifiedAt: 123,
	}
	store.Put(record)
	if err := store.Save(); err != nil {
		t.Fatalf("save store: %v", err)
	}

	loaded, err := LoadMetadataStore(path)
	if err != nil {
		t.Fatalf("reload store: %v", err)
	}
	got, ok := loaded.Get(record.ID, record.URL)
	if !ok {
		t.Fatalf("expected record")
	}
	if got.ETag != record.ETag {
		t.Fatalf("unexpected etag: %s", got.ETag)
	}
	if got.LastVerifiedAt != record.LastVerifiedAt {
		t.Fatalf("unexpected last verified: %d", got.LastVerifiedAt)
	}
}
