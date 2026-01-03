package lsp

import (
	"fmt"
	"strings"

	"markdowntown-cli/internal/scan"

	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

// completionHandler handles textDocument/completion requests.
func (s *Server) completion(_ *glsp.Context, params *protocol.CompletionParams) (any, error) {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[params.TextDocument.URI]
	s.cacheMu.Unlock()

	// If no frontmatter or cursor outside frontmatter block, return nil
	if parsed == nil {
		return nil, nil //nolint:nilnil
	}

	line := int(params.Position.Line + 1)
	if line <= parsed.BlockStartLine || line >= parsed.BlockEndLine {
		return nil, nil //nolint:nilnil
	}

	col := int(params.Position.Character + 1)

	// Check if cursor is in a value
	for key, rng := range parsed.Values {
		if isInside(line, col, rng) {
			return suggestValues(key)
		}
	}

	// Check if cursor is in a key (or prefix of a key)
	for _, rng := range parsed.Locations {
		if isInside(line, col, rng) {
			return suggestKeys()
		}
	}

	// If not inside an existing key/value, but in the block, suggest keys
	// This covers typing a new key on a blank line
	return suggestKeys()
}

func isInside(line, col int, rng scan.Range) bool {
	if line < rng.StartLine || line > rng.EndLine {
		return false
	}
	if line == rng.StartLine && col < rng.StartCol {
		return false
	}
	if line == rng.EndLine && col > rng.EndCol {
		return false
	}
	return true
}

func suggestKeys() ([]protocol.CompletionItem, error) {
	keys := []string{"toolId", "scope", "strategy", "applyTo", "excludeAgents"}
	var items []protocol.CompletionItem
	for _, k := range keys {
		k := k
		items = append(items, protocol.CompletionItem{
			Label: k,
			Kind:  ptr(protocol.CompletionItemKindProperty),
		})
	}
	return items, nil
}

func suggestValues(key string) ([]protocol.CompletionItem, error) {
	var items []protocol.CompletionItem

	// Handle array keys like toolId[0]
	if idx := strings.Index(key, "["); idx != -1 {
		key = key[:idx]
	}

	switch key {
	case "toolId":
		registry, _, err := scan.LoadRegistry()
		if err != nil {
			return nil, err
		}
		for _, p := range registry.Patterns {
			p := p
			items = append(items, protocol.CompletionItem{
				Label:      p.ToolID,
				Kind:       ptr(protocol.CompletionItemKindEnumMember),
				Detail:     ptr(p.ToolName),
				Documentation: ptr(fmt.Sprintf("%s\n\nDocs: %s", p.Notes, strings.Join(p.Docs, ", "))),
			})
		}
	case "scope":
		for _, s := range []string{scan.ScopeRepo, scan.ScopeUser} {
			s := s
			items = append(items, protocol.CompletionItem{
				Label: s,
				Kind:  ptr(protocol.CompletionItemKindEnumMember),
			})
		}
	case "strategy":
		for _, s := range []string{"auto", "manual"} {
			s := s
			items = append(items, protocol.CompletionItem{
				Label: s,
				Kind:  ptr(protocol.CompletionItemKindEnumMember),
			})
		}
	}
	return items, nil
}

func ptr[T any](v T) *T {
	return &v
}
