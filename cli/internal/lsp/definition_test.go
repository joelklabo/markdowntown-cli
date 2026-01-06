package lsp

import (
	"os"
	"path/filepath"
	"testing"
	"unicode/utf16"
	"unicode/utf8"

	protocol "github.com/tliron/glsp/protocol_3_16"
)

func TestPositionForOffsetUTF16(t *testing.T) {
	// 🚀 is 4 bytes in UTF-8, 2 code units in UTF-16.
	content := []byte("A\n🚀B")

	// 'A' is at (0,0)
	// '\n' is at (0,1)
	// '🚀' is at (1,0)
	// 'B' is at (1,2) in UTF-16

	tests := []struct {
		offset int
		line   uint32
		col    uint32
	}{
		{0, 0, 0},
		{1, 0, 1},
		{2, 1, 0},
		{6, 1, 2}, // After 🚀
		{7, 1, 3}, // After B
	}

	for _, tt := range tests {
		pos := positionForOffset(content, tt.offset)
		if pos.Line != tt.line || pos.Character != tt.col {
			t.Errorf("positionForOffset(content, %d) = (%d,%d), want (%d,%d)", tt.offset, pos.Line, pos.Character, tt.line, tt.col)
		}
	}
}

func TestFindToolIDRangeInRegistryJSON(t *testing.T) {
	wd, _ := os.Getwd()

	t.Run("UTF-16 emoji", func(t *testing.T) {

		path := filepath.Join(wd, "..", "..", "testdata", "registry", "registry-utf16.json")

		content, err := os.ReadFile(path)

		if err != nil {
			t.Fatalf("failed to read registry: %v", err)
		}

		rng := findToolIDRangeInRegistryJSON(content, "🚀-cli")
		if rng == nil {
			t.Fatal("expected range for 🚀-cli")
		}

		// The toolId value in registry-utf16.json is "🚀-cli"
		// We want to verify the characters are correct.
		val := string(content[offsetForPositionTest(content, rng.Start):offsetForPositionTest(content, rng.End)])
		if val != "🚀-cli" {
			t.Errorf("expected 🚀-cli, got %q", val)
		}
	})

	t.Run("Escaped quotes", func(t *testing.T) {
		path := filepath.Join(wd, "..", "..", "testdata", "registry", "registry-escaped.json")
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("failed to read registry: %v", err)
		}

		rng := findToolIDRangeInRegistryJSON(content, "quoted\"tool")
		if rng == nil {
			t.Fatal("expected range for quoted\"tool")
		}

		val := string(content[offsetForPositionTest(content, rng.Start):offsetForPositionTest(content, rng.End)])
		// The raw content will have \"
		if val != `quoted\"tool` {
			t.Errorf("expected quoted\\\"tool, got %q", val)
		}
	})

	t.Run("Unicode escape", func(t *testing.T) {
		path := filepath.Join(wd, "..", "..", "testdata", "registry", "registry-escaped.json")
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("failed to read registry: %v", err)
		}

		// \u1234 is Ethiopia character
		rng := findToolIDRangeInRegistryJSON(content, "uni\u1234tool")
		if rng == nil {
			t.Fatal("expected range for uni\u1234tool")
		}

		val := string(content[offsetForPositionTest(content, rng.Start):offsetForPositionTest(content, rng.End)])
		if val != `uni\u1234tool` {
			t.Errorf("expected uni\\u1234tool, got %q", val)
		}
	})
}

// Minimal offset helper for tests (Inverse of positionForOffset)
func offsetForPositionTest(content []byte, pos protocol.Position) int {
	line := 0
	col := 0
	for i := 0; i < len(content); {
		if uint32(line) == pos.Line && uint32(col) == pos.Character {
			return i
		}

		b := content[i]
		if b == '\n' {
			line++
			col = 0
			i++
			continue
		}

		r, size := utf8.DecodeRune(content[i:])
		width := 1
		if r != utf8.RuneError || size > 1 {
			width = utf16.RuneLen(r)
		}

		if uint32(line) == pos.Line && uint32(col+width) > pos.Character {
			return i
		}

		col += width
		i += size
	}
	return len(content)
}
