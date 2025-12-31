// Package suggest provides evidence fetch and parsing helpers.
package suggest

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultUserAgent = "markdowntown-cli"

var (
	// ErrAllowlistMissing signals an empty allowlist.
	ErrAllowlistMissing = errors.New("allowlist hosts required")
	// ErrHostNotAllowlisted signals a host not in the allowlist.
	ErrHostNotAllowlisted = errors.New("host not allowlisted")
	// ErrSchemeNotAllowed signals a non-HTTPS scheme.
	ErrSchemeNotAllowed = errors.New("scheme not allowed")
)

// FetchSource identifies a source to fetch.
type FetchSource struct {
	ID  string
	URL string
}

// FetchResult captures a single fetch response.
type FetchResult struct {
	URL          string
	Status       int
	Body         []byte
	ETag         string
	LastModified string
	FromCache    bool
	NotModified  bool
	Skipped      bool
	SkipReason   string
	Warnings     []string
	Sitemaps     []string
}

// MetadataRecord tracks cache validators for a source.
type MetadataRecord struct {
	ID             string
	URL            string
	ETag           string
	LastModified   string
	LastVerifiedAt int64
}

// MetadataStore persists fetch metadata for reuse.
type MetadataStore interface {
	Get(id, url string) (MetadataRecord, bool)
	Put(record MetadataRecord)
	Save() error
}

// Cache provides cached payloads for 304 responses.
type Cache interface {
	Get(url string) ([]byte, bool)
}

// Fetcher fetches sources with robots and conditional GET handling.
type Fetcher struct {
	client    *http.Client
	userAgent string
	allowlist map[string]struct{}
	store     MetadataStore
	cache     Cache
	now       func() time.Time
	robots    map[string]RobotsRules
}

// FetcherOptions configures a Fetcher.
type FetcherOptions struct {
	Client    *http.Client
	UserAgent string
	Allowlist []string
	Store     MetadataStore
	Cache     Cache
	Now       func() time.Time
}

// NewFetcher constructs a Fetcher with the provided options.
func NewFetcher(opts FetcherOptions) (*Fetcher, error) {
	allowlist := make(map[string]struct{}, len(opts.Allowlist))
	for _, host := range opts.Allowlist {
		trimmed := strings.ToLower(strings.TrimSpace(host))
		if trimmed == "" {
			continue
		}
		allowlist[trimmed] = struct{}{}
	}

	if len(allowlist) == 0 {
		return nil, ErrAllowlistMissing
	}

	client := cloneHTTPClient(opts.Client)
	client.CheckRedirect = allowlistRedirectCheck(client.CheckRedirect, allowlist)

	ua := strings.TrimSpace(opts.UserAgent)
	if ua == "" {
		ua = defaultUserAgent
	}

	now := opts.Now
	if now == nil {
		now = time.Now
	}

	return &Fetcher{
		client:    client,
		userAgent: ua,
		allowlist: allowlist,
		store:     opts.Store,
		cache:     opts.Cache,
		now:       now,
		robots:    map[string]RobotsRules{},
	}, nil
}

// Fetch retrieves a source, honoring robots.txt and conditional headers.
func (f *Fetcher) Fetch(ctx context.Context, source FetchSource) (FetchResult, error) {
	parsed, err := url.Parse(source.URL)
	if err != nil {
		return FetchResult{}, err
	}

	if strings.ToLower(parsed.Scheme) != "https" {
		return FetchResult{}, fmt.Errorf("%w: %s", ErrSchemeNotAllowed, parsed.Scheme)
	}

	host := strings.ToLower(parsed.Hostname())
	if host == "" {
		return FetchResult{}, fmt.Errorf("missing host for %s", source.URL)
	}
	if _, ok := f.allowlist[host]; !ok {
		return FetchResult{}, fmt.Errorf("%w: %s", ErrHostNotAllowlisted, host)
	}

	robotsRules, robotsInfo := f.robotsRules(ctx, parsed)
	result := FetchResult{URL: source.URL, Warnings: robotsInfo.Warnings, Sitemaps: robotsInfo.Sitemaps}
	if !robotsRules.Allows(parsed.Path) {
		result.Skipped = true
		result.SkipReason = "robots disallow"
		return result, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source.URL, nil)
	if err != nil {
		return result, err
	}
	req.Header.Set("User-Agent", f.userAgent)

	if f.store != nil {
		if rec, ok := f.store.Get(source.ID, source.URL); ok {
			if rec.ETag != "" {
				req.Header.Set("If-None-Match", rec.ETag)
			}
			if rec.LastModified != "" {
				req.Header.Set("If-Modified-Since", rec.LastModified)
			}
		}
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()

	result.Status = resp.StatusCode
	result.ETag = strings.TrimSpace(resp.Header.Get("ETag"))
	result.LastModified = strings.TrimSpace(resp.Header.Get("Last-Modified"))

	if resp.StatusCode == http.StatusNotModified {
		result.NotModified = true
		if f.cache != nil {
			if cached, ok := f.cache.Get(source.URL); ok {
				result.Body = cached
				result.FromCache = true
			}
		}
		f.updateMetadata(source, result)
		return result, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, err
	}
	result.Body = body

	f.updateMetadata(source, result)
	return result, nil
}

func (f *Fetcher) updateMetadata(source FetchSource, result FetchResult) {
	if f.store == nil {
		return
	}
	record := MetadataRecord{
		ID:             source.ID,
		URL:            source.URL,
		ETag:           result.ETag,
		LastModified:   result.LastModified,
		LastVerifiedAt: f.now().UnixMilli(),
	}
	f.store.Put(record)
	_ = f.store.Save()
}

type robotsInfo struct {
	Warnings []string
	Sitemaps []string
}

func (f *Fetcher) robotsRules(ctx context.Context, parsed *url.URL) (RobotsRules, robotsInfo) {
	host := strings.ToLower(parsed.Hostname())
	if rules, ok := f.robots[host]; ok {
		return rules, robotsInfo{}
	}

	info := robotsInfo{}
	robotsURL := &url.URL{Scheme: parsed.Scheme, Host: parsed.Host, Path: "/robots.txt"}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, robotsURL.String(), nil)
	if err != nil {
		info.Warnings = append(info.Warnings, fmt.Sprintf("robots request build failed: %v", err))
		rules := RobotsRules{}
		f.robots[host] = rules
		return rules, info
	}
	req.Header.Set("User-Agent", f.userAgent)

	resp, err := f.client.Do(req)
	if err != nil {
		info.Warnings = append(info.Warnings, fmt.Sprintf("robots fetch failed: %v", err))
		rules := RobotsRules{}
		f.robots[host] = rules
		return rules, info
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		info.Warnings = append(info.Warnings, fmt.Sprintf("robots status %d", resp.StatusCode))
		rules := RobotsRules{}
		f.robots[host] = rules
		return rules, info
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		info.Warnings = append(info.Warnings, fmt.Sprintf("robots read failed: %v", err))
		rules := RobotsRules{}
		f.robots[host] = rules
		return rules, info
	}

	parsedRobots := ParseRobots(data)
	rules := parsedRobots.RulesFor(f.userAgent)
	info.Sitemaps = append([]string(nil), parsedRobots.Sitemaps...)
	f.robots[host] = rules
	return rules, info
}

func cloneHTTPClient(base *http.Client) *http.Client {
	if base == nil {
		return &http.Client{Timeout: 15 * time.Second}
	}
	clone := *base
	return &clone
}

func allowlistRedirectCheck(existing func(*http.Request, []*http.Request) error, allowlist map[string]struct{}) func(*http.Request, []*http.Request) error {
	return func(req *http.Request, via []*http.Request) error {
		if strings.ToLower(req.URL.Scheme) != "https" {
			return fmt.Errorf("redirect scheme not allowed: %s", req.URL.Scheme)
		}
		host := strings.ToLower(req.URL.Hostname())
		if _, ok := allowlist[host]; !ok {
			return fmt.Errorf("redirect host not allowlisted: %s", host)
		}
		if existing != nil {
			return existing(req, via)
		}
		if len(via) >= 10 {
			return errors.New("stopped after 10 redirects")
		}
		return nil
	}
}
