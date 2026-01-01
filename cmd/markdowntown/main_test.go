package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/version"
)

func TestPrintUsage(t *testing.T) {
	var buf bytes.Buffer
	printUsage(&buf)
	if !strings.Contains(buf.String(), "markdowntown scan") {
		t.Fatalf("expected scan usage in output")
	}
}

func TestMainNoArgs(t *testing.T) {
	withArgs(t, []string{"markdowntown"}, func() {
		output := captureStdout(t, func() {
			main()
		})
		if !strings.Contains(output, "markdowntown scan") {
			t.Fatalf("expected usage output")
		}
	})
}

func TestMainVersionArg(t *testing.T) {
	withArgs(t, []string{"markdowntown", "--version"}, func() {
		output := captureStdout(t, func() {
			main()
		})
		if !strings.Contains(output, version.ToolVersion) {
			t.Fatalf("expected version output")
		}
	})
}

func TestMainScanHelpArg(t *testing.T) {
	withArgs(t, []string{"markdowntown", "scan", "--help"}, func() {
		output := captureStdout(t, func() {
			main()
		})
		if !strings.Contains(output, "markdowntown scan") {
			t.Fatalf("expected scan usage output")
		}
	})
}

func TestMainAuditHelpArg(t *testing.T) {
	withArgs(t, []string{"markdowntown", "audit", "--help"}, func() {
		output := captureStdout(t, func() {
			main()
		})
		if !strings.Contains(output, "markdowntown audit") {
			t.Fatalf("expected audit usage output")
		}
	})
}

func TestMainSuggestHelpArg(t *testing.T) {
	withArgs(t, []string{"markdowntown", "suggest", "--help"}, func() {
		output := captureStdout(t, func() {
			main()
		})
		if !strings.Contains(output, "markdowntown suggest") {
			t.Fatalf("expected suggest usage output")
		}
	})
}

func TestMainResolveHelpArg(t *testing.T) {
	withArgs(t, []string{"markdowntown", "resolve", "--help"}, func() {
		output := captureStdout(t, func() {
			main()
		})
		if !strings.Contains(output, "markdowntown resolve") {
			t.Fatalf("expected resolve usage output")
		}
	})
}

func TestMainRegistryValidate(t *testing.T) {
	registry := `{
  "version": "1",
  "patterns": [
    {
      "id": "p1",
      "toolId": "tool-a",
      "toolName": "Tool A",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["AGENTS.md"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "auto",
      "docs": ["https://example.com"]
    }
  ]
}`
	path := filepath.Join(t.TempDir(), "registry.json")
	if err := os.WriteFile(path, []byte(registry), 0o600); err != nil {
		t.Fatalf("write registry: %v", err)
	}
	t.Setenv(scan.RegistryEnvVar, path)

	withArgs(t, []string{"markdowntown", "registry", "validate"}, func() {
		output := captureStdout(t, func() {
			main()
		})
		if !strings.Contains(output, "\"valid\": true") {
			t.Fatalf("expected registry validation output")
		}
	})
}

func TestMainToolsList(t *testing.T) {
	registry := `{
  "version": "1",
  "patterns": [
    {
      "id": "p1",
      "toolId": "tool-a",
      "toolName": "Tool A",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["AGENTS.md"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "auto",
      "docs": ["https://example.com"]
    }
  ]
}`
	path := filepath.Join(t.TempDir(), "registry.json")
	if err := os.WriteFile(path, []byte(registry), 0o600); err != nil {
		t.Fatalf("write registry: %v", err)
	}
	t.Setenv(scan.RegistryEnvVar, path)

	withArgs(t, []string{"markdowntown", "tools", "list"}, func() {
		output := captureStdout(t, func() {
			main()
		})
		if !strings.Contains(output, "\"toolId\": \"tool-a\"") {
			t.Fatalf("expected tools list output")
		}
	})
}

func TestPrintScanUsage(t *testing.T) {
	var buf bytes.Buffer
	printScanUsage(&buf)
	if !strings.Contains(buf.String(), "markdowntown scan") {
		t.Fatalf("expected scan usage in output")
	}
}

func TestPrintVersion(t *testing.T) {
	var buf bytes.Buffer
	printVersion(&buf)
	output := buf.String()
	if !strings.Contains(output, "markdowntown") {
		t.Fatalf("expected tool name in output")
	}
	if !strings.Contains(output, version.ToolVersion) {
		t.Fatalf("expected tool version in output")
	}
	if !strings.Contains(output, version.SchemaVersion) {
		t.Fatalf("expected schema version in output")
	}
}

func TestRunToolsListOutputsJSON(t *testing.T) {
	registry := `{
  "version": "1",
  "patterns": [
    {
      "id": "p1",
      "toolId": "tool-a",
      "toolName": "Tool A",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["AGENTS.md"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "auto",
      "docs": ["https://example.com"]
    }
  ]
}`
	path := filepath.Join(t.TempDir(), "registry.json")
	if err := os.WriteFile(path, []byte(registry), 0o600); err != nil {
		t.Fatalf("write registry: %v", err)
	}
	t.Setenv(scan.RegistryEnvVar, path)

	output := captureStdout(t, func() {
		if err := runToolsList(); err != nil {
			t.Fatalf("runToolsList: %v", err)
		}
	})

	var summaries []scan.ToolSummary
	if err := json.Unmarshal([]byte(output), &summaries); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(summaries))
	}
}

func TestRunRegistryValidateOutputsJSON(t *testing.T) {
	registry := `{
  "version": "1",
  "patterns": [
    {
      "id": "p1",
      "toolId": "tool-a",
      "toolName": "Tool A",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["AGENTS.md"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "auto",
      "docs": ["https://example.com"]
    }
  ]
}`
	path := filepath.Join(t.TempDir(), "registry.json")
	if err := os.WriteFile(path, []byte(registry), 0o600); err != nil {
		t.Fatalf("write registry: %v", err)
	}
	t.Setenv(scan.RegistryEnvVar, path)

	output := captureStdout(t, func() {
		if err := runRegistryValidate(); err != nil {
			t.Fatalf("runRegistryValidate: %v", err)
		}
	})

	var result scan.ValidationResult
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}
	if !result.Valid {
		t.Fatalf("expected valid registry")
	}
}

func TestRunRegistryRequiresSubcommand(t *testing.T) {
	if err := runRegistry([]string{}); err == nil {
		t.Fatalf("expected error for missing registry subcommand")
	}
}

func TestRunToolsRequiresSubcommand(t *testing.T) {
	if err := runTools([]string{}); err == nil {
		t.Fatalf("expected error for missing tools subcommand")
	}
}

func TestRunRegistryUnknownSubcommand(t *testing.T) {
	if err := runRegistry([]string{"nope"}); err == nil {
		t.Fatalf("expected error for unknown registry subcommand")
	}
}

func TestRunToolsUnknownSubcommand(t *testing.T) {
	if err := runTools([]string{"nope"}); err == nil {
		t.Fatalf("expected error for unknown tools subcommand")
	}
}

func TestPrintAuditUsage(t *testing.T) {
	var buf bytes.Buffer
	printAuditUsage(&buf)
	if !strings.Contains(buf.String(), "markdowntown audit") {
		t.Fatalf("expected audit usage in output")
	}
}

func TestResolveRepoRoot(t *testing.T) {
	repo := t.TempDir()
	initGitRepo(t, repo)
	root, err := resolveRepoRoot(repo)
	if err != nil {
		t.Fatalf("resolveRepoRoot: %v", err)
	}
	expected, err := filepath.EvalSymlinks(repo)
	if err != nil {
		t.Fatalf("eval symlinks: %v", err)
	}
	resolved, err := filepath.EvalSymlinks(root)
	if err != nil {
		t.Fatalf("eval symlinks: %v", err)
	}
	if resolved != expected {
		t.Fatalf("expected repo root %s, got %s", expected, resolved)
	}
}

func TestResolveRepoRootFromCwd(t *testing.T) {
	repo := t.TempDir()
	initGitRepo(t, repo)
	subdir := filepath.Join(repo, "sub")
	if err := os.MkdirAll(subdir, 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(cwd); err != nil {
			t.Fatalf("restore cwd: %v", err)
		}
	})
	if err := os.Chdir(subdir); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	root, err := resolveRepoRoot("")
	if err != nil {
		t.Fatalf("resolveRepoRoot: %v", err)
	}
	expected, err := filepath.EvalSymlinks(repo)
	if err != nil {
		t.Fatalf("eval symlinks: %v", err)
	}
	resolved, err := filepath.EvalSymlinks(root)
	if err != nil {
		t.Fatalf("eval symlinks: %v", err)
	}
	if resolved != expected {
		t.Fatalf("expected repo root %s, got %s", expected, resolved)
	}
}

func TestReadScanInputFromFile(t *testing.T) {
	output := scan.Output{SchemaVersion: version.SchemaVersion}
	data, err := json.Marshal(output)
	if err != nil {
		t.Fatalf("marshal output: %v", err)
	}
	path := filepath.Join(t.TempDir(), "scan.json")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("write scan: %v", err)
	}

	got, err := readScanInput(path)
	if err != nil {
		t.Fatalf("readScanInput: %v", err)
	}
	if got.SchemaVersion != version.SchemaVersion {
		t.Fatalf("expected schema %s, got %s", version.SchemaVersion, got.SchemaVersion)
	}
}

func TestReadScanInputInvalidSchema(t *testing.T) {
	output := scan.Output{SchemaVersion: "scan-spec-v0"}
	data, err := json.Marshal(output)
	if err != nil {
		t.Fatalf("marshal output: %v", err)
	}
	path := filepath.Join(t.TempDir(), "scan.json")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("write scan: %v", err)
	}

	if _, err := readScanInput(path); err == nil {
		t.Fatalf("expected error for unsupported schema")
	}
}

func TestReadScanInputInvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "scan.json")
	if err := os.WriteFile(path, []byte("{invalid"), 0o600); err != nil {
		t.Fatalf("write scan: %v", err)
	}
	if _, err := readScanInput(path); err == nil {
		t.Fatalf("expected error for invalid json")
	}
}

func TestReadScanInputEmptyStdin(t *testing.T) {
	withStdin(t, "", func() {
		if _, err := readScanInput("-"); err == nil {
			t.Fatalf("expected error for empty stdin")
		}
	})
}

func TestReadScanInputFromStdin(t *testing.T) {
	output := scan.Output{SchemaVersion: version.SchemaVersion}
	data, err := json.Marshal(output)
	if err != nil {
		t.Fatalf("marshal output: %v", err)
	}
	withStdin(t, string(data), func() {
		got, err := readScanInput("-")
		if err != nil {
			t.Fatalf("readScanInput: %v", err)
		}
		if got.SchemaVersion != version.SchemaVersion {
			t.Fatalf("expected schema %s, got %s", version.SchemaVersion, got.SchemaVersion)
		}
	})
}

func TestReadStdinPaths(t *testing.T) {
	withStdin(t, "one\ntwo\n", func() {
		paths, err := readStdinPaths(true)
		if err != nil {
			t.Fatalf("readStdinPaths: %v", err)
		}
		if len(paths) != 2 || paths[0] != "one" || paths[1] != "two" {
			t.Fatalf("unexpected paths: %#v", paths)
		}
	})

	paths, err := readStdinPaths(false)
	if err != nil {
		t.Fatalf("readStdinPaths disabled: %v", err)
	}
	if paths != nil {
		t.Fatalf("expected nil paths when disabled")
	}
}

func TestStringListSet(t *testing.T) {
	var list stringList
	if err := list.Set("alpha, beta"); err != nil {
		t.Fatalf("set list: %v", err)
	}
	if err := list.Set("gamma"); err != nil {
		t.Fatalf("set list: %v", err)
	}
	if got := list.String(); got != "alpha,beta,gamma" {
		t.Fatalf("unexpected list: %s", got)
	}
}

func TestTruncateLeft(t *testing.T) {
	if got := truncateLeft("abcdef", 0); got != "" {
		t.Fatalf("expected empty string, got %q", got)
	}
	if got := truncateLeft("abcdef", 2); got != "ef" {
		t.Fatalf("expected ef, got %q", got)
	}
	if got := truncateLeft("abcdef", 3); got != "def" {
		t.Fatalf("expected def, got %q", got)
	}
	if got := truncateLeft("abcdef", 5); got != "...ef" {
		t.Fatalf("expected ...ef, got %q", got)
	}
}

func TestTerminalWidth(t *testing.T) {
	t.Setenv("COLUMNS", "120")
	if got := terminalWidth(); got != 120 {
		t.Fatalf("expected 120, got %d", got)
	}

	t.Setenv("COLUMNS", "0")
	if got := terminalWidth(); got != 80 {
		t.Fatalf("expected fallback 80, got %d", got)
	}
}

func TestElapsedMs(t *testing.T) {
	start := time.Now()
	if got := elapsedMs(start, start.Add(-time.Second)); got != 0 {
		t.Fatalf("expected 0 for negative duration, got %d", got)
	}
	if got := elapsedMs(start, start.Add(2*time.Millisecond)); got != 2 {
		t.Fatalf("expected 2, got %d", got)
	}
}

func TestRunAuditInvalidFormat(t *testing.T) {
	err := runAudit([]string{"--format", "xml"})
	var cliErr *cliError
	if !errors.As(err, &cliErr) {
		t.Fatalf("expected cliError, got %v", err)
	}
	if cliErr.code != 2 {
		t.Fatalf("expected exit code 2, got %d", cliErr.code)
	}
	if cliErr.Error() == "" {
		t.Fatalf("expected error message")
	}
}

func TestRunAuditHelp(t *testing.T) {
	output := captureStdout(t, func() {
		if err := runAudit([]string{"--help"}); err != nil {
			t.Fatalf("runAudit help: %v", err)
		}
	})
	if !strings.Contains(output, "markdowntown audit") {
		t.Fatalf("expected audit usage output")
	}
}

func TestRunAuditInputConflict(t *testing.T) {
	err := runAudit([]string{"--input", "scan.json", "--repo", "repo"})
	if err == nil {
		t.Fatalf("expected error for input conflict")
	}
}

func TestRunSuggestHelp(t *testing.T) {
	output := captureStdout(t, func() {
		if err := runSuggest([]string{"--help"}); err != nil {
			t.Fatalf("runSuggest help: %v", err)
		}
	})
	if !strings.Contains(output, "markdowntown suggest") {
		t.Fatalf("expected suggest usage")
	}
}

func TestRunResolveHelp(t *testing.T) {
	output := captureStdout(t, func() {
		if err := runResolve([]string{"--help"}); err != nil {
			t.Fatalf("runResolve help: %v", err)
		}
	})
	if !strings.Contains(output, "markdowntown resolve") {
		t.Fatalf("expected resolve usage")
	}
}

func TestNewCLIError(t *testing.T) {
	if err := newCLIError(nil, 1); err != nil {
		t.Fatalf("expected nil error for nil input")
	}
	wrapped := newCLIError(errors.New("boom"), 2)
	if wrapped == nil {
		t.Fatalf("expected wrapped error")
	}
}

func TestProgressReporterDisabled(t *testing.T) {
	write, finish := progressReporter(false)
	if write != nil {
		t.Fatalf("expected nil writer when disabled")
	}
	finish()
}

func TestProgressReporterEnabled(t *testing.T) {
	devNull, err := os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	if err != nil {
		t.Skipf("dev null unavailable: %v", err)
	}
	t.Cleanup(func() {
		if err := devNull.Close(); err != nil {
			t.Fatalf("close dev null: %v", err)
		}
	})

	oldStdout := os.Stdout
	os.Stdout = devNull
	defer func() { os.Stdout = oldStdout }()

	write, finish := progressReporter(true)
	if write == nil {
		t.Skip("stdout not treated as terminal")
	}
	write("/repo/path")
	finish()
}

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	os.Stdout = w

	fn()
	_ = w.Close()
	os.Stdout = old

	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read output: %v", err)
	}
	return string(data)
}

func withStdin(t *testing.T, input string, fn func()) {
	t.Helper()
	old := os.Stdin
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	if _, err := w.Write([]byte(input)); err != nil {
		t.Fatalf("write stdin: %v", err)
	}
	_ = w.Close()
	os.Stdin = r
	defer func() {
		os.Stdin = old
	}()
	fn()
}

func withArgs(t *testing.T, args []string, fn func()) {
	t.Helper()
	old := os.Args
	os.Args = args
	defer func() {
		os.Args = old
	}()
	fn()
}
