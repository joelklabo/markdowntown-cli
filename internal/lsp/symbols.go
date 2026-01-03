package lsp

import (
	"sort"

	"markdowntown-cli/internal/scan"

	"github.com/spf13/afero"
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

type symbolEntry struct {
	key       string
	rng       protocol.Range
	selection protocol.Range
}

func (s *Server) documentSymbol(_ *glsp.Context, params *protocol.DocumentSymbolParams) (any, error) {
	if params == nil {
		return nil, nil
	}
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return nil, err
	}
	parsed := s.frontmatterForURI(params.TextDocument.URI, path)
	if parsed == nil {
		return nil, nil
	}

	rootRange := frontmatterRootRange(parsed)
	if data, err := afero.ReadFile(s.fs, path); err == nil {
		if blockRange := frontmatterBlockRange(string(data)); blockRange != nil {
			rootRange = *blockRange
		}
	}

	symbols := buildDocumentSymbols(parsed, rootRange)
	if len(symbols) == 0 {
		return nil, nil
	}
	return symbols, nil
}

func buildDocumentSymbols(parsed *scan.ParsedFrontmatter, rootRange protocol.Range) []protocol.DocumentSymbol {
	if parsed == nil {
		return nil
	}
	entries := frontmatterSymbolEntries(parsed)
	if isZeroRange(rootRange) {
		if computed := rangeFromEntries(entries); computed != nil {
			rootRange = *computed
		}
	}

	root := protocol.DocumentSymbol{
		Name:           "Frontmatter",
		Kind:           protocol.SymbolKindObject,
		Range:          rootRange,
		SelectionRange: rootRange,
	}
	if len(entries) == 0 {
		return []protocol.DocumentSymbol{root}
	}

	root.Children = make([]protocol.DocumentSymbol, 0, len(entries))
	for _, entry := range entries {
		root.Children = append(root.Children, protocol.DocumentSymbol{
			Name:           entry.key,
			Kind:           protocol.SymbolKindProperty,
			Range:          entry.rng,
			SelectionRange: entry.selection,
		})
	}
	return []protocol.DocumentSymbol{root}
}

func frontmatterSymbolEntries(parsed *scan.ParsedFrontmatter) []symbolEntry {
	if parsed == nil {
		return nil
	}
	entries := make(map[string]symbolEntry)
	for key, loc := range parsed.Locations {
		keyRange := issueToProtocolRange(&loc)
		selectionRange := frontmatterValueRange(parsed, key)
		entryRange := mergeRange(keyRange, selectionRange)
		if isZeroRange(entryRange) {
			continue
		}
		entries[key] = symbolEntry{key: key, rng: entryRange, selection: selectionRange}
	}
	for key, val := range parsed.Values {
		if _, ok := entries[key]; ok {
			continue
		}
		valueRange := issueToProtocolRange(&val)
		selectionRange := frontmatterValueRange(parsed, key)
		entryRange := mergeRange(valueRange, selectionRange)
		if isZeroRange(entryRange) {
			continue
		}
		entries[key] = symbolEntry{key: key, rng: entryRange, selection: selectionRange}
	}

	ordered := make([]symbolEntry, 0, len(entries))
	for _, entry := range entries {
		ordered = append(ordered, entry)
	}
	sort.Slice(ordered, func(i, j int) bool {
		left := ordered[i]
		right := ordered[j]
		if cmp := comparePosition(left.rng.Start, right.rng.Start); cmp != 0 {
			return cmp < 0
		}
		if cmp := comparePosition(left.rng.End, right.rng.End); cmp != 0 {
			return cmp < 0
		}
		return left.key < right.key
	})
	return ordered
}

func frontmatterRootRange(parsed *scan.ParsedFrontmatter) protocol.Range {
	if parsed == nil || parsed.BlockStartLine <= 0 || parsed.BlockEndLine <= 0 {
		return protocol.Range{}
	}
	endLine := parsed.BlockEndLine
	if endLine < parsed.BlockStartLine {
		endLine = parsed.BlockStartLine
	}
	return protocol.Range{
		Start: protocol.Position{Line: clampToUint32(parsed.BlockStartLine - 1), Character: 0},
		End:   protocol.Position{Line: clampToUint32(endLine - 1), Character: 0},
	}
}

func rangeFromEntries(entries []symbolEntry) *protocol.Range {
	if len(entries) == 0 {
		return nil
	}
	start := entries[0].rng.Start
	end := entries[0].rng.End
	for i := 1; i < len(entries); i++ {
		entry := entries[i]
		if comparePosition(entry.rng.Start, start) < 0 {
			start = entry.rng.Start
		}
		if comparePosition(entry.rng.End, end) > 0 {
			end = entry.rng.End
		}
	}
	return &protocol.Range{Start: start, End: end}
}

func mergeRange(a protocol.Range, b protocol.Range) protocol.Range {
	if isZeroRange(a) {
		return b
	}
	if isZeroRange(b) {
		return a
	}
	start := a.Start
	end := a.End
	if comparePosition(b.Start, start) < 0 {
		start = b.Start
	}
	if comparePosition(b.End, end) > 0 {
		end = b.End
	}
	return protocol.Range{Start: start, End: end}
}

func comparePosition(a protocol.Position, b protocol.Position) int {
	if a.Line < b.Line {
		return -1
	}
	if a.Line > b.Line {
		return 1
	}
	if a.Character < b.Character {
		return -1
	}
	if a.Character > b.Character {
		return 1
	}
	return 0
}

func isZeroRange(r protocol.Range) bool {
	return r.Start.Line == 0 && r.Start.Character == 0 && r.End.Line == 0 && r.End.Character == 0
}
