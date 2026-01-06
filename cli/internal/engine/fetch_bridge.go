package engine

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"markdowntown-cli/internal/suggest"
)

// FetchBridge defines the interface for fetching external sources.
type FetchBridge interface {
	Fetch(ctx context.Context, url string) ([]byte, error)
}

// NativeFetchBridge implements FetchBridge using the internal suggest fetcher.
type NativeFetchBridge struct {
	fetcher *suggest.Fetcher
}

// NewNativeFetchBridge initializes a bridge with on-disk cache and metadata.
func NewNativeFetchBridge(allowlist []string) (*NativeFetchBridge, error) {
	cache, err := suggest.NewFileCache()
	if err != nil {
		return nil, err
	}

	metadataPath, err := suggest.MetadataPath()
	if err != nil {
		return nil, err
	}
	store, err := suggest.LoadMetadataStore(metadataPath)
	if err != nil {
		return nil, err
	}

	opts := suggest.FetcherOptions{
		Client:    &http.Client{Timeout: 15 * time.Second},
		Allowlist: allowlist,
		Store:     store,
		Cache:     cache,
	}

	fetcher, err := suggest.NewFetcher(opts)
	if err != nil {
		return nil, err
	}

	return &NativeFetchBridge{fetcher: fetcher}, nil
}

// Fetch retrieves a URL using the suggest fetcher infrastructure.
func (b *NativeFetchBridge) Fetch(ctx context.Context, url string) ([]byte, error) {
	source := suggest.FetchSource{ID: "bridge-" + url, URL: url}

	result, err := b.fetcher.Fetch(ctx, source)
	if err != nil {
		return nil, err
	}

	if result.Skipped {
		return nil, fmt.Errorf("skipped: %s", result.SkipReason)
	}

	return result.Body, nil
}

// ProxyFetchBridge implements FetchBridge by routing requests through a proxy URL.
type ProxyFetchBridge struct {
	ProxyBaseURL string
	Client       *http.Client
}

// NewProxyFetchBridge creates a bridge that uses a web proxy.
func NewProxyFetchBridge(proxyBaseURL string) *ProxyFetchBridge {
	return &ProxyFetchBridge{
		ProxyBaseURL: proxyBaseURL,
		Client:       &http.Client{Timeout: 30 * time.Second},
	}
}

// Fetch retrieves a URL via the proxy.
func (b *ProxyFetchBridge) Fetch(ctx context.Context, targetURL string) ([]byte, error) {
	proxyURL := fmt.Sprintf("%s?url=%s", b.ProxyBaseURL, url.QueryEscape(targetURL))

	req, err := http.NewRequestWithContext(ctx, "GET", proxyURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := b.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("proxy fetch failed: %s", resp.Status)
	}

	return io.ReadAll(resp.Body)
}
