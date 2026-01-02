package scan

import (
	"testing"
)

func TestParseFrontmatterLocations(t *testing.T) {
	content := []byte(`---
toolId: my-tool
scope: repo
settings:
  nested: true
  list:
    - one
    - two
---
# Content
`)

	parsed, ok, err := ParseFrontmatter(content)
	if err != nil {
		t.Fatalf("ParseFrontmatter error: %v", err)
	}
	if !ok {
		t.Fatal("expected ok=true")
	}
	if parsed == nil {
		t.Fatal("expected non-nil parsed result")
	}

	// Line numbers are 1-indexed.
	// --- is line 1
	// toolId: my-tool is line 2
	// scope: repo is line 3
	// settings: is line 4
	//   nested: true is line 5
	//   list: is line 6
	//     - one is line 7
	//     - two is line 8

	tests := []struct {
		key       string
		line      int
		col       int
		useValues bool
	}{
		{"toolId", 2, 1, false},
		{"scope", 3, 1, false},
		{"settings", 4, 1, false},
		{"settings.nested", 5, 3, false},
		{"settings.list", 6, 3, false},
		{"settings.list[0]", 7, 7, true},
		{"settings.list[1]", 8, 7, true},
	}

	for _, tt := range tests {
		locs := parsed.Locations
		if tt.useValues {
			locs = parsed.Values
		}
		loc, found := locs[tt.key]
		if !found {
			t.Errorf("key %q not found in locations", tt.key)
			continue
		}
		if loc.StartLine != tt.line {
			t.Errorf("key %q: expected line %d, got %d", tt.key, tt.line, loc.StartLine)
		}
		if loc.StartCol != tt.col {
			t.Errorf("key %q: expected col %d, got %d", tt.key, tt.col, loc.StartCol)
		}
	}

	// Verify Data map
	if parsed.Data["toolId"] != "my-tool" {
		t.Errorf("expected toolId my-tool, got %v", parsed.Data["toolId"])
	}
	settings := parsed.Data["settings"].(map[string]any)
	if settings["nested"] != true {
		t.Errorf("expected settings.nested true, got %v", settings["nested"])
	}
}

func TestParseFrontmatterEmpty(t *testing.T) {
	content := []byte(`---
---
`)
	parsed, ok, err := ParseFrontmatter(content)
	if err != nil {
		t.Fatalf("ParseFrontmatter error: %v", err)
	}
	if !ok {
		t.Fatal("expected ok=true")
	}
	if len(parsed.Data) != 0 {
		t.Errorf("expected empty data, got %v", parsed.Data)
	}
}

func TestParseFrontmatterNoDelimiter(t *testing.T) {
	content := []byte(`# No frontmatter
`)
	parsed, ok, err := ParseFrontmatter(content)
	if err != nil {
		t.Fatalf("ParseFrontmatter error: %v", err)
	}
	if ok {
		t.Fatal("expected ok=false")
	}
	if parsed != nil {
		t.Fatal("expected nil parsed result")
	}
}
