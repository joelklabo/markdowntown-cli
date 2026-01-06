//go:build js && wasm

package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall/js"
	"time"

	"markdowntown-cli/internal/audit"
	scanhash "markdowntown-cli/internal/hash"
	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/suggest"

	"github.com/spf13/afero"
)

type wasmFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type wasmRequest struct {
	RepoRoot       string        `json:"repoRoot"`
	Files          []wasmFile    `json:"files"`
	Registry       scan.Registry `json:"registry"`
	IncludeContent bool          `json:"includeContent"`
}

type wasmResponse struct {
	Ok     bool             `json:"ok"`
	Error  string           `json:"error,omitempty"`
	Output *wasmAuditOutput `json:"output,omitempty"`
}

type wasmAuditOutput struct {
	Scan   scan.Output   `json:"scan"`
	Issues []audit.Issue `json:"issues"`
}

type wasmSuggestRequest struct {
	Client   string                 `json:"client"`
	Explain  bool                   `json:"explain"`
	Refresh  bool                   `json:"refresh"`
	Offline  bool                   `json:"offline"`
	ProxyURL string                 `json:"proxyUrl,omitempty"`
	Registry suggest.SourceRegistry `json:"registry"`
}

type wasmSuggestResponse struct {
	Ok     bool            `json:"ok"`
	Error  string          `json:"error,omitempty"`
	Output *suggest.Report `json:"output,omitempty"`
}

var (
	scanAuditFunc js.Func
	suggestFunc   js.Func
)

// RegisterWasmExports registers the WASM entrypoint on the JS global scope.
func RegisterWasmExports() {
	scanAuditFunc = js.FuncOf(scanAudit)
	js.Global().Set("markdowntownScanAudit", scanAuditFunc)

	suggestFunc = js.FuncOf(markdowntownSuggest)
	js.Global().Set("markdowntownSuggest", suggestFunc)
}

func markdowntownSuggest(_ js.Value, args []js.Value) (result any) {
	defer func() {
		if recovered := recover(); recovered != nil {
			result = marshalResponse(wasmSuggestResponse{Ok: false, Error: fmt.Sprintf("panic: %v", recovered)})
		}
	}()
	if len(args) < 1 {
		return marshalResponse(wasmSuggestResponse{Ok: false, Error: "missing input"})
	}
	input := strings.TrimSpace(args[0].String())
	if input == "" {
		return marshalResponse(wasmSuggestResponse{Ok: false, Error: "empty input"})
	}
	var req wasmSuggestRequest
	if err := json.Unmarshal([]byte(input), &req); err != nil {
		return marshalResponse(wasmSuggestResponse{Ok: false, Error: fmt.Sprintf("invalid input: %v", err)})
	}

	clientID, err := instructions.ParseClient(req.Client)
	if err != nil {
		return marshalResponse(wasmSuggestResponse{Ok: false, Error: fmt.Sprintf("invalid client: %v", err)})
	}

	if os.Getenv("HOME") == "" {
		_ = os.Setenv("HOME", "/")
	}
	if os.Getenv("XDG_CONFIG_HOME") == "" {
		_ = os.Setenv("XDG_CONFIG_HOME", "/.config")
	}

	report := suggest.Report{
		Client:      clientID,
		GeneratedAt: time.Now().UnixMilli(),
	}

	var filtered []suggest.Source
	byID := make(map[string]suggest.Source)
	for _, src := range req.Registry.Sources {
		if strings.EqualFold(src.Client, string(clientID)) {
			filtered = append(filtered, src)
			byID[src.ID] = src
		}
	}

	if len(filtered) == 0 {
		report.Warnings = append(report.Warnings, "no sources available for client in provided registry")
		return marshalResponse(wasmSuggestResponse{Ok: true, Output: &report})
	}

	var bridge suggest.FetchBridge
	if req.ProxyURL != "" {
		bridge = NewProxyFetchBridge(req.ProxyURL)
	}

	fetcher, err := suggest.NewFetcher(suggest.FetcherOptions{
		Allowlist: req.Registry.AllowlistHosts,
		Bridge:    bridge,
	})
	if err != nil {
		return marshalResponse(wasmSuggestResponse{Ok: false, Error: fmt.Sprintf("fetcher init: %v", err)})
	}

	ctx := context.Background()
	var claims []suggest.Claim
	for _, src := range filtered {
		res, err := fetcher.Fetch(ctx, suggest.FetchSource{ID: src.ID, URL: src.URL})
		if err != nil {
			report.Warnings = append(report.Warnings, fmt.Sprintf("fetch %s failed: %v", src.URL, err))
			continue
		}
		if res.Skipped {
			report.Warnings = append(report.Warnings, fmt.Sprintf("fetch %s skipped: %s", src.URL, res.SkipReason))
			continue
		}

		format := "markdown"
		if strings.HasSuffix(strings.ToLower(src.URL), ".html") {
			format = "html"
		}

		doc, err := suggest.NormalizeDocument(string(res.Body), format)
		if err != nil {
			report.Warnings = append(report.Warnings, fmt.Sprintf("normalize %s failed: %v", src.URL, err))
			continue
		}
		snapshotID := "sha256:" + scanhash.SumHex(res.Body)
		claims = append(claims, suggest.ExtractClaims(doc, src, snapshotID)...)
	}

	summary := suggest.GenerateSuggestions(claims, byID)
	report.Suggestions = summary.Suggestions
	report.Conflicts = summary.Conflicts
	report.Omissions = summary.Omissions

	if !req.Explain {
		for i := range report.Suggestions {
			report.Suggestions[i].Proof = suggest.Proof{}
		}
	}

	return marshalResponse(wasmSuggestResponse{Ok: true, Output: &report})
}

func scanAudit(_ js.Value, args []js.Value) (result any) {
	defer func() {
		if recovered := recover(); recovered != nil {
			result = marshalResponse(wasmResponse{Ok: false, Error: fmt.Sprintf("panic: %v", recovered)})
		}
	}()
	if len(args) < 1 {
		return marshalResponse(wasmResponse{Ok: false, Error: "missing input"})
	}
	input := strings.TrimSpace(args[0].String())
	if input == "" {
		return marshalResponse(wasmResponse{Ok: false, Error: "empty input"})
	}
	var req wasmRequest
	if err := json.Unmarshal([]byte(input), &req); err != nil {
		return marshalResponse(wasmResponse{Ok: false, Error: fmt.Sprintf("invalid input: %v", err)})
	}
	if len(req.Registry.Patterns) == 0 {
		return marshalResponse(wasmResponse{Ok: false, Error: "registry patterns required"})
	}

	if os.Getenv("HOME") == "" {
		_ = os.Setenv("HOME", "/")
	}
	if os.Getenv("XDG_CONFIG_HOME") == "" {
		_ = os.Setenv("XDG_CONFIG_HOME", "/.config")
	}

	repoRoot := strings.TrimSpace(req.RepoRoot)
	if repoRoot == "" {
		repoRoot = "/repo"
	}
	repoRoot = filepath.Clean(repoRoot)

	mem := afero.NewMemMapFs()
	if err := mem.MkdirAll(repoRoot, 0o755); err != nil {
		return marshalResponse(wasmResponse{Ok: false, Error: fmt.Sprintf("create repo root: %v", err)})
	}
	for _, file := range req.Files {
		path := strings.TrimSpace(file.Path)
		if path == "" {
			continue
		}
		path = filepath.Clean(path)
		if !strings.HasPrefix(path, repoRoot) {
			path = filepath.Join(repoRoot, path)
		}
		if err := mem.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return marshalResponse(wasmResponse{Ok: false, Error: fmt.Sprintf("create dir for %s: %v", path, err)})
		}
		if err := afero.WriteFile(mem, path, []byte(file.Content), 0o600); err != nil {
			return marshalResponse(wasmResponse{Ok: false, Error: fmt.Sprintf("write file %s: %v", path, err)})
		}
	}

	scanResult, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		RepoOnly:       true,
		IncludeContent: req.IncludeContent,
		Registry:       req.Registry,
		Fs:             mem,
		ScanWorkers:    1,
	})
	if err != nil {
		return marshalResponse(wasmResponse{Ok: false, Error: fmt.Sprintf("scan failed: %v", err)})
	}

	output := scan.BuildOutput(scanResult, scan.OutputOptions{RepoRoot: repoRoot})
	redactor := audit.NewRedactor(repoRoot, "", "", audit.RedactNever)
	issues := Run(audit.Context{
		Scan:     output,
		Registry: req.Registry,
		Redactor: redactor,
	}, audit.DefaultRules())

	return marshalResponse(wasmResponse{
		Ok: true,
		Output: &wasmAuditOutput{
			Scan:   output,
			Issues: issues,
		},
	})
}

func marshalResponse(resp any) any {
	payload, err := json.Marshal(resp)
	if err != nil {
		fallback := fmt.Sprintf("{\"ok\":false,\"error\":%q}", err.Error())
		return fallback
	}
	return string(payload)
}
