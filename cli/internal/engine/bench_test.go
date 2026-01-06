package engine

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"markdowntown-cli/internal/audit"
	scanhash "markdowntown-cli/internal/hash"
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/suggest"

	"github.com/spf13/afero"
)

func BenchmarkNativeEngineScanAudit(b *testing.B) {
	repoRoot := b.TempDir()
	fs := afero.NewOsFs()

	// Create a representative fixture
	agentsPath := filepath.Join(repoRoot, "AGENTS.md")
	if err := os.WriteFile(agentsPath, []byte("---\ntoolId: claude-3-opus\n---\n# Test\nYou MUST follow instructions."), 0o600); err != nil {
		b.Fatalf("write AGENTS.md: %v", err)
	}

	registry := scan.Registry{
		Version: "1.0",
		Patterns: []scan.Pattern{
			{
				ID:       "agents-md",
				ToolID:   "codex",
				ToolName: "Codex",
				Kind:     "instructions",
				Scope:    "repo",
				Paths:    []string{"AGENTS.md"},
				Type:     "glob",
			},
		},
	}

	opts := scan.Options{
		RepoRoot:    repoRoot,
		RepoOnly:    true,
		Registry:    registry,
		Fs:          fs,
		ScanWorkers: 1,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := scan.Scan(opts)
		if err != nil {
			b.Fatalf("scan failed: %v", err)
		}

		output := scan.BuildOutput(result, scan.OutputOptions{RepoRoot: repoRoot})
		redactor := audit.NewRedactor(repoRoot, "", "", audit.RedactNever)
		_ = Run(audit.Context{
			Scan:     output,
			Registry: registry,
			Redactor: redactor,
		}, audit.DefaultRules())
	}
}

func BenchmarkNativeEngineRunRules(b *testing.B) {
	repoRoot := "/repo"
	registry := scan.Registry{
		Version: "1.0",
		Patterns: []scan.Pattern{
			{
				ID: "p1",
			},
		},
	}
	output := scan.Output{
		RepoRoot: repoRoot,
		Configs: []scan.ConfigEntry{
			{
				Path:  "/repo/AGENTS.md",
				Scope: "repo",
				Tools: []scan.ToolEntry{
					{ToolID: "codex"},
				},
			},
		},
	}
	redactor := audit.NewRedactor(repoRoot, "", "", audit.RedactNever)
	ctx := audit.Context{
		Scan:     output,
		Registry: registry,
		Redactor: redactor,
	}
	rules := audit.DefaultRules()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Run(ctx, rules)
	}
}

func BenchmarkNativeEngineRunWithContext(b *testing.B) {
	repoRoot := "/repo"
	registry := scan.Registry{
		Version: "1.0",
	}
	output := scan.Output{
		RepoRoot: repoRoot,
	}
	redactor := audit.NewRedactor(repoRoot, "", "", audit.RedactNever)
	ctx := audit.Context{
		Scan:     output,
		Registry: registry,
		Redactor: redactor,
	}
	rules := audit.DefaultRules()
	goCtx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = RunWithContext(goCtx, ctx, rules)
	}
}

func BenchmarkNativeEngineSuggest(b *testing.B) {
	sourcesRegistry := suggest.SourceRegistry{
		Version:        "1.0",
		AllowlistHosts: []string{"example.com"},
		Sources: []suggest.Source{
			{
				ID:           "s1",
				Client:       "codex",
				Tier:         "tier-0",
				URL:          "https://example.com/docs.md",
				RefreshHours: 24,
			},
		},
	}
	sourcesByID := make(map[string]suggest.Source)
	for _, s := range sourcesRegistry.Sources {
		sourcesByID[s.ID] = s
	}
	content := "You MUST do the thing."
	doc, _ := suggest.NormalizeDocument(content, "markdown")
	snapshotID := "sha256:" + scanhash.SumHex([]byte(content))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		claims := suggest.ExtractClaims(doc, sourcesByID["s1"], snapshotID)
		_ = suggest.GenerateSuggestions(claims, sourcesByID)
	}
}
