package tui

import (
	"os"
	"path/filepath"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestFileTree(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "filetree-test")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.RemoveAll(tempDir) }()

	// Create structure
	// tempDir/
	//   file1.md
	//   dir1/
	//     file2.md
	if err := os.WriteFile(filepath.Join(tempDir, "file1.md"), []byte("test"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(tempDir, "dir1"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, "dir1", "file2.md"), []byte("test"), 0600); err != nil {
		t.Fatal(err)
	}

	ft := NewFileTree(tempDir)
	ft.Focus()

	// Need to manually refresh items in test
	msg := ft.RefreshItemsCmd()()
	ft, _ = ft.Update(msg)

	// Initial state: root expanded, should see file1.md and dir1
	if len(ft.items) != 2 {
		t.Errorf("expected 2 items, got %d", len(ft.items))
	}

	// Test navigation
	ft, _ = ft.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("j")})
	if ft.cursor != 1 {
		t.Errorf("expected cursor at 1, got %d", ft.cursor)
	}

	// Test expansion
	// Assuming dir1 is at index 0 (dirs first)
	ft.cursor = 0
	if !ft.items[0].isDir {
		t.Fatalf("expected item 0 to be dir")
	}

	_, cmd := ft.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("l")})
	if cmd != nil {
		ft, _ = ft.Update(cmd())
	}
	if !ft.expanded[ft.items[0].path] {
		t.Errorf("expected dir to be expanded")
	}

	// Now should see file2.md inside dir1
	if len(ft.items) != 3 {
		t.Errorf("expected 3 items after expansion, got %d", len(ft.items))
	}

	// Test selection
	// Find index of a file
	fileIdx := -1
	for i, item := range ft.items {
		if !item.isDir {
			fileIdx = i
			break
		}
	}
	if fileIdx == -1 {
		t.Fatal("no file found in tree")
	}

	ft.cursor = fileIdx
	_, cmd = ft.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("expected command on file selection")
	}
	msg = cmd()
	if selMsg, ok := msg.(FileSelectedMsg); ok {
		if selMsg.Path != ft.items[fileIdx].path {
			t.Errorf("expected path %s, got %s", ft.items[fileIdx].path, selMsg.Path)
		}
	} else {
		t.Errorf("expected FileSelectedMsg, got %T", msg)
	}
}
