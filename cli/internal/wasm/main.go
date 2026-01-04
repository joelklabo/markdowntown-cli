//go:build js && wasm
// +build js,wasm

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall/js"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/engine"
	"markdowntown-cli/internal/scan"

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

var scanAuditFunc js.Func

func main() {
	scanAuditFunc = js.FuncOf(scanAudit)
	js.Global().Set("markdowntownScanAudit", scanAuditFunc)
	select {}
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
	issues := engine.Run(audit.Context{
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

func marshalResponse(resp wasmResponse) any {
	payload, err := json.Marshal(resp)
	if err != nil {
		fallback := fmt.Sprintf("{\"ok\":false,\"error\":%q}", err.Error())
		return fallback
	}
	return string(payload)
}
