package context //nolint:revive

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/scan"
)

func TestSearchInstructions(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "search-test")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.RemoveAll(tempDir) }()

	// Create some instruction files
	if err := os.WriteFile(filepath.Join(tempDir, "GEMINI.md"), []byte("Hello Gemini\nTypeScript is great"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, "CLAUDE.md"), []byte("Hello Claude\nI like TypeScript"), 0600); err != nil {
		t.Fatal(err)
	}

	registry, _, _ := scan.LoadRegistry()

	results, err := SearchInstructions(tempDir, registry, "TypeScript")
	if err != nil {
		t.Fatalf("SearchInstructions failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("expected 2 results, got %d", len(results))
	}

	foundGemini := false
	foundClaude := false
	for _, r := range results {
		if r.Client == instructions.ClientGemini {
			foundGemini = true
		}
		if r.Client == instructions.ClientClaude {
			foundClaude = true
		}
		if !strings.Contains(strings.ToLower(r.Text), "typescript") {
			t.Errorf("result text doesn't contain query: %s", r.Text)
		}
	}

	if !foundGemini {
		t.Errorf("missing Gemini result")
	}
	if !foundClaude {
		t.Errorf("missing Claude result")
	}
}
