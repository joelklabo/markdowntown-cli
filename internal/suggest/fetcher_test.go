package suggest

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"testing"
	"time"
)

type memoryStore struct {
	records map[string]MetadataRecord
	saves   int
}

func (m *memoryStore) Get(id, url string) (MetadataRecord, bool) {
	if m.records == nil {
		return MetadataRecord{}, false
	}
	rec, ok := m.records[id+"|"+url]
	return rec, ok
}

func (m *memoryStore) Put(record MetadataRecord) {
	if m.records == nil {
		m.records = make(map[string]MetadataRecord)
	}
	m.records[record.ID+"|"+record.URL] = record
}

func (m *memoryStore) Save() error {
	m.saves++
	return nil
}

type memoryCache struct {
	payloads map[string][]byte
}

func (m memoryCache) Get(url string) ([]byte, bool) {
	payload, ok := m.payloads[url]
	return payload, ok
}

func TestFetcherBlocksRobots(t *testing.T) {
	var server *httptest.Server
	server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/robots.txt" {
			_, _ = w.Write([]byte("User-agent: *\nDisallow: /blocked\nSitemap: " + server.URL + "/sitemap.xml\n"))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	t.Cleanup(server.Close)

	parsed, _ := url.Parse(server.URL)
	fetcher, err := NewFetcher(FetcherOptions{Allowlist: []string{parsed.Hostname()}, Client: server.Client()})
	if err != nil {
		t.Fatalf("new fetcher: %v", err)
	}

	result, err := fetcher.Fetch(context.Background(), FetchSource{ID: "src", URL: server.URL + "/blocked/page"})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}

	if !result.Skipped {
		t.Fatalf("expected skipped fetch")
	}
	if result.SkipReason != "robots disallow" {
		t.Fatalf("unexpected skip reason: %s", result.SkipReason)
	}

	expectedSitemaps := []string{server.URL + "/sitemap.xml"}
	if !reflect.DeepEqual(result.Sitemaps, expectedSitemaps) {
		t.Fatalf("unexpected sitemaps: %v", result.Sitemaps)
	}
}

func TestFetcherConditionalGETUsesCache(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/robots.txt" {
			_, _ = w.Write([]byte("User-agent: *\nAllow: /\n"))
			return
		}
		if r.URL.Path == "/doc" {
			if r.Header.Get("If-None-Match") == "etag-1" {
				w.WriteHeader(http.StatusNotModified)
				return
			}
			w.Header().Set("ETag", "etag-1")
			_, _ = w.Write([]byte("fresh"))
			return
		}
	}))
	t.Cleanup(server.Close)

	parsed, _ := url.Parse(server.URL)
	store := &memoryStore{}
	store.Put(MetadataRecord{ID: "src", URL: server.URL + "/doc", ETag: "etag-1"})
	cache := memoryCache{payloads: map[string][]byte{server.URL + "/doc": []byte("cached")}}

	fetcher, err := NewFetcher(FetcherOptions{
		Allowlist: []string{parsed.Hostname()},
		Client:    server.Client(),
		Store:     store,
		Cache:     cache,
		Now:       func() time.Time { return time.Unix(1, 0) },
	})
	if err != nil {
		t.Fatalf("new fetcher: %v", err)
	}

	result, err := fetcher.Fetch(context.Background(), FetchSource{ID: "src", URL: server.URL + "/doc"})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}

	if !result.NotModified {
		t.Fatalf("expected not modified response")
	}
	if !result.FromCache || string(result.Body) != "cached" {
		t.Fatalf("expected cached body, got %q", string(result.Body))
	}

	rec, ok := store.Get("src", server.URL+"/doc")
	if !ok {
		t.Fatalf("expected metadata record")
	}
	if rec.LastVerifiedAt == 0 {
		t.Fatalf("expected last verified timestamp")
	}
}

func TestFetcherRejectsUnknownHost(t *testing.T) {
	fetcher, err := NewFetcher(FetcherOptions{Allowlist: []string{"example.com"}})
	if err != nil {
		t.Fatalf("new fetcher: %v", err)
	}

	_, err = fetcher.Fetch(context.Background(), FetchSource{ID: "src", URL: "https://not-allowed.example/doc"})
	if err == nil {
		t.Fatalf("expected error for host not allowlisted")
	}
	if !strings.Contains(err.Error(), ErrHostNotAllowlisted.Error()) {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestFetcherSecurityRejectsHTTP(t *testing.T) {
	fetcher, err := NewFetcher(FetcherOptions{Allowlist: []string{"localhost"}})
	if err != nil {
		t.Fatalf("new fetcher: %v", err)
	}

	_, err = fetcher.Fetch(context.Background(), FetchSource{ID: "src", URL: "http://localhost/doc"})
	if err == nil {
		t.Fatalf("expected error for non-https scheme")
	}
	if !strings.Contains(err.Error(), ErrSchemeNotAllowed.Error()) {
		t.Fatalf("unexpected error: %v", err)
	}
}
