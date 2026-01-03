package lsp

import (
	"path/filepath"
	"testing"

	"markdowntown-cli/internal/scan"

	"github.com/spf13/afero"
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

func TestCompletion(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	s.rootPath = repoRoot
	s.fs = afero.NewCopyOnWriteFs(afero.NewOsFs(), s.overlay)
	setRegistryEnv(t)

	tests := []struct {
		name     string
		content  string
		line     int
		char     int
		wantKind protocol.CompletionItemKind
		want     []string
	}{
		{
			name: "Suggest Keys",
			content: `---
toolId: foo

---
`,
			line:     2, // Blank line
			char:     0,
			wantKind: protocol.CompletionItemKindProperty,
			want:     []string{"toolId", "scope"},
		},
		{
			name: "Suggest Values (toolId)",
			content: `---
toolId: g
---
`,
			line:     1, // toolId: g
			char:     9, // After 'g'
			wantKind: protocol.CompletionItemKindEnumMember,
			want:     []string{"gemini-cli"}, // From test registry
		},
		{
			name: "Suggest Values (scope)",
			content: `---
scope: r
---
`,
			line:     1,
			char:     8,
			wantKind: protocol.CompletionItemKindEnumMember,
			want:     []string{scan.ScopeRepo, scan.ScopeUser},
		},
		{
			name: "Outside Block",
			content: `---
key: val
---
# Content`,
			line: 4, // In content
			char: 0,
			want: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uri := "file://" + filepath.Join(repoRoot, "test.md")
			_ = s.didOpen(nil, &protocol.DidOpenTextDocumentParams{
				TextDocument: protocol.TextDocumentItem{
					URI:  uri,
					Text: tt.content,
				},
			})

			res, err := s.completion(&glsp.Context{}, &protocol.CompletionParams{
				TextDocumentPositionParams: protocol.TextDocumentPositionParams{
					TextDocument: protocol.TextDocumentIdentifier{URI: uri},
					Position:     protocol.Position{Line: uint32(tt.line), Character: uint32(tt.char)},
				},
			})
			if err != nil {
				t.Fatalf("completion error: %v", err)
			}

			if tt.want == nil {
				if res != nil {
					t.Errorf("expected nil result, got %v", res)
				}
				return
			}

			items, ok := res.([]protocol.CompletionItem)
			if !ok {
				t.Fatalf("expected []CompletionItem, got %T", res)
			}

			if len(items) == 0 {
				t.Fatal("expected items, got none")
			}

			// Check if at least one wanted item is present
			found := false
			for _, want := range tt.want {
				for _, item := range items {
					if item.Label == want {
						found = true
						if item.Kind != nil && *item.Kind != tt.wantKind {
							t.Errorf("item %s: expected kind %v, got %v", want, tt.wantKind, *item.Kind)
						}
						break
					}
				}
			}
			if !found {
				t.Errorf("expected suggestions %v, got %v", tt.want, items)
			}
		})
	}
}
