package tui

import (
	"strings"
	"testing"
)

func TestTabs(t *testing.T) {
	entries := []string{"gemini", "claude", "codex"}
	tabs := NewTabs(entries)

	if len(tabs.Entries) != 3 {
		t.Errorf("expected 3 entries, got %d", len(tabs.Entries))
	}

	if tabs.Active != 0 {
		t.Errorf("expected active tab 0, got %d", tabs.Active)
	}

	view := tabs.View()
	if !strings.Contains(view, "Gemini") {
		t.Errorf("view missing Gemini")
	}
	if !strings.Contains(view, "Claude") {
		t.Errorf("view missing Claude")
	}

	tabs.Active = 1
	view = tabs.View()
	// Active tab should have different styling, but hard to test raw lipgloss output easily
	// At least ensure it still contains the text
	if !strings.Contains(view, "Claude") {
		t.Errorf("view missing Claude after switching")
	}
}
