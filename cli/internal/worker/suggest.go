package worker

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	scanhash "markdowntown-cli/internal/hash"
	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/suggest"
)

type suggestRunOptions struct {
	Refresh bool
	Offline bool
	Explain bool
}

func (s *Server) runSuggest(ctx context.Context, req SuggestRequest) (SuggestResult, *workerError) {
	clientValue := strings.TrimSpace(req.Client)
	if clientValue == "" {
		clientValue = "codex"
	}
	client, err := parseClient(clientValue)
	if err != nil {
		return SuggestResult{}, newWorkerError(ErrCodeInvalidRequest, err.Error(), 400, nil)
	}

	report, workerErr := buildSuggestReport(ctx, client, suggestRunOptions{
		Refresh: req.Refresh,
		Offline: req.Offline,
		Explain: req.Explain,
	})
	if workerErr != nil {
		return SuggestResult{}, workerErr
	}

	return SuggestResult{Report: report}, nil
}

func buildSuggestReport(ctx context.Context, client instructions.Client, opts suggestRunOptions) (suggest.Report, *workerError) {
	report := suggest.Report{
		Client:      client,
		GeneratedAt: time.Now().UnixMilli(),
	}
	if err := ctx.Err(); err != nil {
		return report, mapContextError(err)
	}

	sources, err := loadSourcesForClient(client)
	if err != nil {
		code := ErrCodeInternal
		if errors.Is(err, suggest.ErrSourcesNotFound) || errors.Is(err, suggest.ErrSourcesPathMissing) {
			code = ErrCodeConfig
		}
		return report, newWorkerError(code, err.Error(), 500, nil)
	}
	if len(sources.sources) == 0 {
		report.Warnings = append(report.Warnings, "no sources available for client")
		return report, nil
	}

	cache := newFileCache(&report)
	if opts.Offline {
		report.Warnings = append(report.Warnings, "offline mode enabled; using cached data only")
		claims := loadClaimsFromCache(&report, sources, cache)
		summary := suggest.GenerateSuggestions(claims, sources.byID)
		report.Suggestions = summary.Suggestions
		report.Conflicts = summary.Conflicts
		report.Omissions = summary.Omissions
		if !opts.Explain {
			for i := range report.Suggestions {
				report.Suggestions[i].Proof = suggest.Proof{}
			}
		}
		return report, nil
	}

	store := newMetadataStore(&report, opts.Refresh)
	fetcher, err := suggest.NewFetcher(suggest.FetcherOptions{Allowlist: sources.allowlist, Store: store, Cache: cache})
	if err != nil {
		return report, newWorkerError(ErrCodeInternal, err.Error(), 500, nil)
	}

	var claims []suggest.Claim
	for _, src := range sources.sources {
		res, err := fetcher.Fetch(ctx, suggest.FetchSource{ID: src.ID, URL: src.URL})
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
				return report, mapContextError(err)
			}
			report.Warnings = append(report.Warnings, fmt.Sprintf("fetch %s failed: %v", src.URL, err))
			continue
		}
		if res.Skipped {
			report.Warnings = append(report.Warnings, fmt.Sprintf("fetch %s skipped: %s", src.URL, res.SkipReason))
			continue
		}
		if len(res.Warnings) > 0 {
			for _, warn := range res.Warnings {
				report.Warnings = append(report.Warnings, fmt.Sprintf("%s: %s", src.URL, warn))
			}
		}
		if len(res.Body) == 0 {
			if res.NotModified {
				report.Warnings = append(report.Warnings, fmt.Sprintf("fetch %s not modified but cache missing", src.URL))
			} else {
				report.Warnings = append(report.Warnings, fmt.Sprintf("fetch %s returned empty body", src.URL))
			}
			continue
		}
		if cache != nil {
			if err := cache.Put(src.URL, res.Body); err != nil {
				report.Warnings = append(report.Warnings, fmt.Sprintf("cache %s write failed: %v", src.URL, err))
			}
		}

		format := formatFromURL(src.URL)
		doc, err := suggest.NormalizeDocument(string(res.Body), format)
		if err != nil {
			report.Warnings = append(report.Warnings, fmt.Sprintf("normalize %s failed: %v", src.URL, err))
			continue
		}
		snapshotID := "sha256:" + scanhash.SumHex(res.Body)
		claims = append(claims, suggest.ExtractClaims(doc, src, snapshotID)...)
	}

	summary := suggest.GenerateSuggestions(claims, sources.byID)
	report.Suggestions = summary.Suggestions
	report.Conflicts = summary.Conflicts
	report.Omissions = summary.Omissions

	if !opts.Explain {
		for i := range report.Suggestions {
			report.Suggestions[i].Proof = suggest.Proof{}
		}
	}

	return report, nil
}

type cacheWriter interface {
	suggest.Cache
	Put(url string, payload []byte) error
}

type metadataWriter struct {
	store     *suggest.MetadataFileStore
	ignoreGet bool
}

func (m *metadataWriter) Get(id, url string) (suggest.MetadataRecord, bool) {
	if m == nil || m.ignoreGet || m.store == nil {
		return suggest.MetadataRecord{}, false
	}
	return m.store.Get(id, url)
}

func (m *metadataWriter) Put(record suggest.MetadataRecord) {
	if m == nil || m.store == nil {
		return
	}
	m.store.Put(record)
}

func (m *metadataWriter) Save() error {
	if m == nil || m.store == nil {
		return nil
	}
	return m.store.Save()
}

func newMetadataStore(report *suggest.Report, refresh bool) suggest.MetadataWriter {
	path, err := suggest.MetadataPath()
	if err != nil {
		report.Warnings = append(report.Warnings, fmt.Sprintf("metadata path failed: %v", err))
		return nil
	}
	store, err := suggest.LoadMetadataStore(path)
	if err != nil {
		report.Warnings = append(report.Warnings, fmt.Sprintf("metadata load failed: %v", err))
		return nil
	}
	return &metadataWriter{store: store, ignoreGet: refresh}
}

func newFileCache(report *suggest.Report) cacheWriter {
	cache, err := suggest.NewFileCache()
	if err != nil {
		report.Warnings = append(report.Warnings, fmt.Sprintf("cache init failed: %v", err))
		return nil
	}
	return cache
}

func loadClaimsFromCache(report *suggest.Report, sources sourcesByClient, cache suggest.Cache) []suggest.Claim {
	if cache == nil {
		report.Warnings = append(report.Warnings, "offline cache unavailable; no cached bodies found")
		return nil
	}

	var claims []suggest.Claim
	for _, src := range sources.sources {
		body, ok := cache.Get(src.URL)
		if !ok {
			report.Warnings = append(report.Warnings, fmt.Sprintf("cache miss for %s", src.URL))
			continue
		}
		format := formatFromURL(src.URL)
		doc, err := suggest.NormalizeDocument(string(body), format)
		if err != nil {
			report.Warnings = append(report.Warnings, fmt.Sprintf("normalize %s failed: %v", src.URL, err))
			continue
		}
		snapshotID := "sha256:" + scanhash.SumHex(body)
		claims = append(claims, suggest.ExtractClaims(doc, src, snapshotID)...)
	}
	return claims
}

type sourcesByClient struct {
	sources   []suggest.Source
	byID      map[string]suggest.Source
	allowlist []string
}

func loadSourcesForClient(client instructions.Client) (sourcesByClient, error) {
	reg, _, err := suggest.LoadSources()
	if err != nil {
		return sourcesByClient{}, err
	}

	var filtered []suggest.Source
	byID := make(map[string]suggest.Source)
	for _, src := range reg.Sources {
		if strings.EqualFold(src.Client, string(client)) {
			filtered = append(filtered, src)
			byID[src.ID] = src
		}
	}

	return sourcesByClient{sources: filtered, byID: byID, allowlist: reg.AllowlistHosts}, nil
}

func formatFromURL(rawURL string) string {
	lower := strings.ToLower(rawURL)
	switch {
	case strings.HasSuffix(lower, ".html"), strings.HasSuffix(lower, ".htm"):
		return "html"
	case strings.HasSuffix(lower, ".md"), strings.HasSuffix(lower, ".markdown"):
		return "markdown"
	default:
		return "markdown"
	}
}

func parseClient(value string) (instructions.Client, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "codex":
		return instructions.ClientCodex, nil
	case "copilot":
		return instructions.ClientCopilot, nil
	case "vscode":
		return instructions.ClientVSCode, nil
	case "claude":
		return instructions.ClientClaude, nil
	case "gemini":
		return instructions.ClientGemini, nil
	default:
		return "", fmt.Errorf("unknown client: %s", value)
	}
}
