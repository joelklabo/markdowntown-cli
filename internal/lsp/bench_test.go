package lsp

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"
)

func BenchmarkDiagnosticsLargeMarkdown(b *testing.B) {
	repoRoot := b.TempDir()
	runGitBench(b, repoRoot, "init")
	setRegistryEnvBench(b)

	fixture := readFixtureBench(b, "testdata/lsp/large.md")
	filePath := filepath.Join(repoRoot, "AGENTS.md")
	if err := os.WriteFile(filePath, fixture, 0o600); err != nil {
		b.Fatalf("write fixture: %v", err)
	}

	s := NewServer("0.1.0")
	s.rootPath = repoRoot

	settings := DefaultSettings()
	caps := DiagnosticCapabilities{RelatedInformation: true, CodeDescription: true, Tags: true}
	uri := pathToURL(filePath)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, registry, err := s.scanForDiagnostics(filePath, repoRoot)
		if err != nil {
			b.Fatalf("scanForDiagnostics: %v", err)
		}
		redactor := audit.NewRedactor(repoRoot, "", "", settings.Diagnostics.RedactPaths)
		auditCtx := audit.Context{
			Scan:     scan.BuildOutput(result, scan.OutputOptions{RepoRoot: repoRoot}),
			Registry: registry,
			Redactor: redactor,
		}
		issues := audit.RunRules(auditCtx, s.rulesForSettings(settings))
		_ = s.diagnosticsForIssues(issues, uri, filePath, repoRoot, settings, caps)
	}
}

func runGitBench(b *testing.B, dir string, args ...string) {
	b.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		b.Fatalf("git %v failed: %v\nOutput: %s", args, err, out)
	}
}

func setRegistryEnvBench(b *testing.B) {
	b.Helper()
	wd, _ := os.Getwd()
	for {
		candidate := filepath.Join(wd, "data", "ai-config-patterns.json")
		if _, err := os.Stat(candidate); err == nil {
			b.Setenv("MARKDOWNTOWN_REGISTRY", candidate)
			return
		}
		parent := filepath.Dir(wd)
		if parent == wd {
			b.Fatal("could not find registry")
		}
		wd = parent
	}
}

func readFixtureBench(b *testing.B, relPath string) []byte {
	b.Helper()
	repoRoot := findRepoRootBench(b)
	// #nosec G304 -- test reads a known fixture within the repo root.
	data, err := os.ReadFile(filepath.Join(repoRoot, relPath))
	if err != nil {
		b.Fatalf("read fixture %s: %v", relPath, err)
	}
	return data
}

func findRepoRootBench(b *testing.B) string {
	b.Helper()
	wd, err := os.Getwd()
	if err != nil {
		b.Fatalf("getwd failed: %v", err)
	}
	for {
		if _, err := os.Stat(filepath.Join(wd, "go.mod")); err == nil {
			return wd
		}
		parent := filepath.Dir(wd)
		if parent == wd {
			b.Fatal("could not find repo root")
		}
		wd = parent
	}
}
