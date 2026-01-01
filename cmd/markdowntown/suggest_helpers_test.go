package main

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/suggest"
)

func TestParseClient(t *testing.T) {
	cases := []struct {
		input string
		want  instructions.Client
	}{
		{input: "Codex", want: instructions.ClientCodex},
		{input: "copilot", want: instructions.ClientCopilot},
		{input: "vscode", want: instructions.ClientVSCode},
		{input: "claude", want: instructions.ClientClaude},
		{input: "gemini", want: instructions.ClientGemini},
	}
	for _, tc := range cases {
		client, err := parseClient(tc.input)
		if err != nil {
			t.Fatalf("parseClient %s: %v", tc.input, err)
		}
		if client != tc.want {
			t.Fatalf("expected %s, got %s", tc.want, client)
		}
	}

	if _, err := parseClient("nope"); err == nil {
		t.Fatalf("expected error for unknown client")
	}
}

func TestResolveAdapter(t *testing.T) {
	adapter, err := resolveAdapter(instructions.ClientCodex)
	if err != nil {
		t.Fatalf("resolveAdapter: %v", err)
	}
	if _, ok := adapter.(instructions.CodexAdapter); !ok {
		t.Fatalf("expected CodexAdapter, got %T", adapter)
	}

	adapter, err = resolveAdapter(instructions.ClientCopilot)
	if err != nil {
		t.Fatalf("resolveAdapter: %v", err)
	}
	if _, ok := adapter.(instructions.CopilotAdapter); !ok {
		t.Fatalf("expected CopilotAdapter, got %T", adapter)
	}

	adapter, err = resolveAdapter(instructions.ClientVSCode)
	if err != nil {
		t.Fatalf("resolveAdapter: %v", err)
	}
	if _, ok := adapter.(instructions.VSCodeAdapter); !ok {
		t.Fatalf("expected VSCodeAdapter, got %T", adapter)
	}

	adapter, err = resolveAdapter(instructions.ClientClaude)
	if err != nil {
		t.Fatalf("resolveAdapter: %v", err)
	}
	if _, ok := adapter.(instructions.ClaudeAdapter); !ok {
		t.Fatalf("expected ClaudeAdapter, got %T", adapter)
	}

	adapter, err = resolveAdapter(instructions.ClientGemini)
	if err != nil {
		t.Fatalf("resolveAdapter: %v", err)
	}
	if _, ok := adapter.(instructions.GeminiAdapter); !ok {
		t.Fatalf("expected GeminiAdapter, got %T", adapter)
	}

	if _, err := resolveAdapter(instructions.Client("nope")); err == nil {
		t.Fatalf("expected error for unsupported client")
	}
}

func TestFormatFromURL(t *testing.T) {
	if got := formatFromURL("https://example.com/doc.html"); got != "html" {
		t.Fatalf("expected html, got %s", got)
	}
	if got := formatFromURL("https://example.com/doc.md"); got != "markdown" {
		t.Fatalf("expected markdown, got %s", got)
	}
	if got := formatFromURL("https://example.com/doc"); got != "markdown" {
		t.Fatalf("expected markdown default, got %s", got)
	}
}

func TestMultiFlagSet(t *testing.T) {
	flags := multiFlag{}
	if err := flags.Set("beta"); err != nil {
		t.Fatalf("set: %v", err)
	}
	if err := flags.Set("alpha"); err != nil {
		t.Fatalf("set: %v", err)
	}
	if err := flags.Set(""); err != nil {
		t.Fatalf("set: %v", err)
	}
	if flags.String() != "alpha,beta" {
		t.Fatalf("unexpected flags: %s", flags.String())
	}
}

func TestLoadSourcesForClient(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "doc-sources.json")
	payload := `{
  "version": "1.0",
  "allowlistHosts": ["example.com"],
  "sources": [
    {"id":"codex-doc","tier":"tier-0","client":"codex","url":"https://example.com/codex.md","refreshHours":24},
    {"id":"claude-doc","tier":"tier-0","client":"claude","url":"https://example.com/claude.md","refreshHours":24}
  ]
}`
	if err := os.WriteFile(path, []byte(payload), 0o644); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(suggest.SourcesEnvVar, path)

	sources, err := loadSourcesForClient(instructions.ClientCodex)
	if err != nil {
		t.Fatalf("loadSourcesForClient: %v", err)
	}
	if len(sources.sources) != 1 {
		t.Fatalf("expected 1 source, got %d", len(sources.sources))
	}
	if sources.sources[0].ID != "codex-doc" {
		t.Fatalf("unexpected source: %#v", sources.sources[0])
	}
	if len(sources.allowlist) != 1 || sources.allowlist[0] != "example.com" {
		t.Fatalf("unexpected allowlist: %#v", sources.allowlist)
	}
}

func TestBuildSuggestReportOffline(t *testing.T) {
	tmp := t.TempDir()
	sourcesPath := filepath.Join(tmp, "doc-sources.json")
	sourceURL := "https://example.com/docs.md"
	if err := os.WriteFile(sourcesPath, []byte(testSourcesJSON(sourceURL)), 0o644); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(suggest.SourcesEnvVar, sourcesPath)
	t.Setenv("XDG_DATA_HOME", filepath.Join(tmp, "data"))
	t.Setenv("XDG_CACHE_HOME", filepath.Join(tmp, "cache"))

	cache, err := suggest.NewFileCache()
	if err != nil {
		t.Fatalf("cache init: %v", err)
	}
	if err := cache.Put(sourceURL, []byte("You MUST do the thing.")); err != nil {
		t.Fatalf("cache put: %v", err)
	}

	report, err := buildSuggestReport(context.Background(), instructions.ClientCodex, suggestRunOptions{Offline: true})
	if err != nil {
		t.Fatalf("buildSuggestReport: %v", err)
	}
	if len(report.Suggestions) == 0 {
		t.Fatalf("expected suggestions from cache")
	}
	if len(report.Warnings) == 0 {
		t.Fatalf("expected offline warning")
	}
}

func TestBuildSuggestReportNoSources(t *testing.T) {
	tmp := t.TempDir()
	sourcesPath := filepath.Join(tmp, "doc-sources.json")
	if err := os.WriteFile(sourcesPath, []byte(`{"version":"1","allowlistHosts":["example.com"],"sources":[]}`), 0o644); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(suggest.SourcesEnvVar, sourcesPath)

	if _, err := buildSuggestReport(context.Background(), instructions.ClientCodex, suggestRunOptions{Offline: true}); err == nil {
		t.Fatalf("expected error for missing sources registry entries")
	}
}

func TestBuildSuggestReportNoClientSources(t *testing.T) {
	tmp := t.TempDir()
	sourcesPath := filepath.Join(tmp, "doc-sources.json")
	payload := `{
  "version": "1.0",
  "allowlistHosts": ["example.com"],
  "sources": [
    {"id":"claude-doc","tier":"tier-0","client":"claude","url":"https://example.com/claude.md","refreshHours":24}
  ]
}`
	if err := os.WriteFile(sourcesPath, []byte(payload), 0o644); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(suggest.SourcesEnvVar, sourcesPath)

	report, err := buildSuggestReport(context.Background(), instructions.ClientCodex, suggestRunOptions{Offline: true})
	if err != nil {
		t.Fatalf("buildSuggestReport: %v", err)
	}
	if len(report.Warnings) == 0 {
		t.Fatalf("expected warning for missing client sources")
	}
}

func TestBuildSuggestReportOnline(t *testing.T) {
	oldTransport := http.DefaultTransport
	http.DefaultTransport = roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		body := "User-agent: *\nAllow: /\n"
		if req.URL.Path != "/robots.txt" {
			body = "You MUST keep instructions short."
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     http.Header{"Content-Type": []string{"text/plain"}},
		}, nil
	})
	defer func() {
		http.DefaultTransport = oldTransport
	}()

	tmp := t.TempDir()
	sourcesPath := filepath.Join(tmp, "doc-sources.json")
	sourceURL := "https://example.com/docs.md"
	if err := os.WriteFile(sourcesPath, []byte(testSourcesJSON(sourceURL)), 0o644); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv(suggest.SourcesEnvVar, sourcesPath)
	t.Setenv("XDG_DATA_HOME", filepath.Join(tmp, "data"))
	t.Setenv("XDG_CACHE_HOME", filepath.Join(tmp, "cache"))

	report, err := buildSuggestReport(context.Background(), instructions.ClientCodex, suggestRunOptions{Offline: false})
	if err != nil {
		t.Fatalf("buildSuggestReport: %v", err)
	}
	if len(report.Suggestions) == 0 {
		t.Fatalf("expected suggestions from fetch")
	}
}

func TestMetadataWriterLifecycle(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("XDG_CACHE_HOME", filepath.Join(tmp, "cache"))

	path, err := suggest.MetadataPath()
	if err != nil {
		t.Fatalf("MetadataPath: %v", err)
	}
	store := suggest.MetadataStore{
		Version: suggest.MetadataVersion,
		Sources: []suggest.SourceMetadataRecord{
			{ID: "codex", URL: "https://example.com", ETag: "etag"},
		},
	}
	if err := suggest.SaveMetadata(path, store); err != nil {
		t.Fatalf("SaveMetadata: %v", err)
	}

	report := &suggest.SuggestReport{}
	writer := newMetadataStore(report, false)
	meta, ok := writer.(*metadataWriter)
	if !ok {
		t.Fatalf("expected metadataWriter, got %T", writer)
	}
	record, ok := meta.Get("codex", "https://example.com")
	if !ok || record.ETag != "etag" {
		t.Fatalf("expected stored record, got %#v", record)
	}

	meta.Put(suggest.MetadataRecord{ID: "codex", URL: "https://example.com", ETag: "etag2"})
	meta.Put(suggest.MetadataRecord{ID: "extra", URL: "https://example.com/extra"})
	if err := meta.Save(); err != nil {
		t.Fatalf("metadata save: %v", err)
	}

	loaded, err := suggest.LoadMetadata(path)
	if err != nil {
		t.Fatalf("LoadMetadata: %v", err)
	}
	if len(loaded.Sources) != 2 {
		t.Fatalf("expected 2 sources, got %d", len(loaded.Sources))
	}

	writer = newMetadataStore(report, true)
	meta, ok = writer.(*metadataWriter)
	if !ok || !meta.ignoreGet {
		t.Fatalf("expected ignoreGet for refresh")
	}
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (fn roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}
