package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"time"

	scanhash "markdowntown-cli/internal/hash"
	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/suggest"
)

const suggestUsage = `markdowntown suggest

Usage:
  markdowntown suggest [flags]

Flags:
  --client <codex|copilot|vscode|claude|gemini>  Client target (default codex)
  --format <json|md>                             Output format (default json)
  --json                                         Alias for --format json
  --refresh                                      Force refresh of sources
  --offline                                      Do not fetch; use cached data only
  --explain                                      Include proof objects in output
  -h, --help                                     Show help
`

const resolveUsage = `markdowntown resolve

Usage:
  markdowntown resolve [flags]

Flags:
  --client <codex|copilot|vscode|claude|gemini>  Client target (default codex)
  --format <json|md>                             Output format (default json)
  --json                                         Alias for --format json
  --repo <path>                                  Repo root (defaults to git root)
  --path <file>                                  Target file path
  --setting <key>                                Enable settings flag (repeatable)
  -h, --help                                     Show help
`

const auditUsage = `markdowntown audit

Usage:
  markdowntown audit [flags]

Flags:
  --client <codex|copilot|vscode|claude|gemini>  Client target (default codex)
  --format <json|md>                             Output format (default json)
  --json                                         Alias for --format json
  --refresh                                      Force refresh of sources
  --offline                                      Do not fetch; use cached data only
  --explain                                      Include proof objects in output
  -h, --help                                     Show help
`

func runSuggest(args []string) error {
	return runSuggestWithIO(os.Stdout, os.Stderr, args)
}

func runResolve(args []string) error {
	return runResolveWithIO(os.Stdout, os.Stderr, args)
}

func runAudit(args []string) error {
	return runAuditWithIO(os.Stdout, os.Stderr, args)
}

func runSuggestWithIO(stdout, stderr io.Writer, args []string) error {
	flags := flag.NewFlagSet("suggest", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var client string
	var format string
	var refresh bool
	var offline bool
	var explain bool
	var jsonOut bool
	var help bool

	flags.StringVar(&client, "client", "codex", "client target")
	flags.StringVar(&format, "format", "json", "output format")
	flags.BoolVar(&jsonOut, "json", false, "output json")
	flags.BoolVar(&refresh, "refresh", false, "refresh sources")
	flags.BoolVar(&offline, "offline", false, "offline mode")
	flags.BoolVar(&explain, "explain", false, "include proof objects")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}
	if help {
		_, _ = fmt.Fprint(stdout, suggestUsage)
		return nil
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}

	if jsonOut {
		format = "json"
	}

	clientID, err := parseClient(client)
	if err != nil {
		return err
	}

	report, err := buildSuggestReport(context.Background(), clientID, suggestRunOptions{
		Refresh: refresh,
		Offline: offline,
		Explain: explain,
	})
	if err != nil {
		return err
	}

	return suggest.WriteSuggestReport(stdout, format, report)
}

func runAuditWithIO(stdout, stderr io.Writer, args []string) error {
	flags := flag.NewFlagSet("audit", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var client string
	var format string
	var refresh bool
	var offline bool
	var explain bool
	var jsonOut bool
	var help bool

	flags.StringVar(&client, "client", "codex", "client target")
	flags.StringVar(&format, "format", "json", "output format")
	flags.BoolVar(&jsonOut, "json", false, "output json")
	flags.BoolVar(&refresh, "refresh", false, "refresh sources")
	flags.BoolVar(&offline, "offline", false, "offline mode")
	flags.BoolVar(&explain, "explain", false, "include proof objects")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}
	if help {
		_, _ = fmt.Fprint(stdout, auditUsage)
		return nil
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}

	if jsonOut {
		format = "json"
	}

	clientID, err := parseClient(client)
	if err != nil {
		return err
	}

	report, err := buildSuggestReport(context.Background(), clientID, suggestRunOptions{
		Refresh: refresh,
		Offline: offline,
		Explain: explain,
	})
	if err != nil {
		return err
	}
	report.Suggestions = nil

	return suggest.WriteSuggestReport(stdout, format, report)
}

func runResolveWithIO(stdout, stderr io.Writer, args []string) error {
	flags := flag.NewFlagSet("resolve", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var client string
	var format string
	var repoPath string
	var targetPath string
	var jsonOut bool
	var help bool
	settings := multiFlag{}

	flags.StringVar(&client, "client", "codex", "client target")
	flags.StringVar(&format, "format", "json", "output format")
	flags.StringVar(&repoPath, "repo", "", "repo root")
	flags.StringVar(&targetPath, "path", "", "target path")
	flags.Var(&settings, "setting", "enable setting")
	flags.BoolVar(&jsonOut, "json", false, "output json")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}
	if help {
		_, _ = fmt.Fprint(stdout, resolveUsage)
		return nil
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}

	if jsonOut {
		format = "json"
	}

	clientID, err := parseClient(client)
	if err != nil {
		return err
	}

	adapter, err := resolveAdapter(clientID)
	if err != nil {
		return err
	}

	repoRoot, err := resolveRepoRoot(repoPath)
	if err != nil {
		return err
	}

	cwd, err := os.Getwd()
	if err != nil {
		return err
	}

	settingsMap := make(map[string]bool, len(settings))
	for _, key := range settings {
		settingsMap[key] = true
	}

	resolution, err := adapter.Resolve(instructions.ResolveOptions{
		RepoRoot:   repoRoot,
		Cwd:        cwd,
		TargetPath: targetPath,
		Settings:   settingsMap,
	})
	if err != nil {
		return err
	}

	report := suggest.ResolveReport{
		Client:      clientID,
		GeneratedAt: time.Now().UnixMilli(),
		Resolution:  resolution,
	}

	return suggest.WriteResolveReport(stdout, format, report)
}

type suggestRunOptions struct {
	Refresh bool
	Offline bool
	Explain bool
}

func buildSuggestReport(ctx context.Context, client instructions.Client, opts suggestRunOptions) (suggest.SuggestReport, error) {
	report := suggest.SuggestReport{
		Client:      client,
		GeneratedAt: time.Now().UnixMilli(),
	}

	sources, err := loadSourcesForClient(client)
	if err != nil {
		return report, err
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
		return report, err
	}

	var claims []suggest.Claim
	for _, src := range sources.sources {
		res, err := fetcher.Fetch(ctx, suggest.FetchSource{ID: src.ID, URL: src.URL})
		if err != nil {
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

func (m metadataWriter) Get(id, url string) (suggest.MetadataRecord, bool) {
	if m.store == nil || m.ignoreGet {
		return suggest.MetadataRecord{}, false
	}
	return m.store.Get(id, url)
}

func (m metadataWriter) Put(record suggest.MetadataRecord) {
	if m.store == nil {
		return
	}
	m.store.Put(record)
}

func (m metadataWriter) Save() error {
	if m.store == nil {
		return nil
	}
	return m.store.Save()
}

func newMetadataStore(report *suggest.SuggestReport, refresh bool) suggest.MetadataWriter {
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
	return metadataWriter{store: store, ignoreGet: refresh}
}

func newFileCache(report *suggest.SuggestReport) cacheWriter {
	cache, err := suggest.NewFileCache()
	if err != nil {
		report.Warnings = append(report.Warnings, fmt.Sprintf("cache init failed: %v", err))
		return nil
	}
	return cache
}

func loadClaimsFromCache(report *suggest.SuggestReport, sources sourcesByClient, cache suggest.Cache) []suggest.Claim {
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

func resolveAdapter(client instructions.Client) (instructions.Adapter, error) {
	switch client {
	case instructions.ClientCodex:
		return instructions.CodexAdapter{}, nil
	case instructions.ClientCopilot:
		return instructions.CopilotAdapter{}, nil
	case instructions.ClientVSCode:
		return instructions.VSCodeAdapter{}, nil
	case instructions.ClientClaude:
		return instructions.ClaudeAdapter{}, nil
	case instructions.ClientGemini:
		return instructions.GeminiAdapter{}, nil
	default:
		return nil, errors.New("unsupported client")
	}
}

type multiFlag []string

func (m *multiFlag) String() string {
	return strings.Join(*m, ",")
}

func (m *multiFlag) Set(value string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	*m = append(*m, trimmed)
	sort.Strings(*m)
	return nil
}
