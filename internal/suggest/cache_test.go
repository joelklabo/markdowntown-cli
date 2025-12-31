package suggest

import (
	"testing"
)

func TestFileCacheRoundTrip(t *testing.T) {
	cacheRoot := t.TempDir()
	t.Setenv("XDG_DATA_HOME", cacheRoot)

	cache, err := NewFileCache()
	if err != nil {
		t.Fatalf("new cache: %v", err)
	}

	url := "https://example.com/docs"
	payload := []byte("cached body")
	if err := cache.Put(url, payload); err != nil {
		t.Fatalf("cache put: %v", err)
	}

	got, ok := cache.Get(url)
	if !ok {
		t.Fatalf("expected cache hit")
	}
	if string(got) != string(payload) {
		t.Fatalf("unexpected cache payload: %s", string(got))
	}
}
