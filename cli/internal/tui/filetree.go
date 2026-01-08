// Package tui provides the terminal user interface for context exploration.
package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// FileTree represents a navigable file tree component.
type FileTree struct {
	repoRoot string
	cursor   int
	items    []treeItem
	expanded map[string]bool
	selected string // Path of the currently selected file

	width   int
	height  int
	focused bool
}

type treeItem struct {
	path     string
	name     string
	isDir    bool
	depth    int
	expanded bool
}

// NewFileTree creates a new FileTree instance rooted at repoRoot.
func NewFileTree(repoRoot string) FileTree {
	ft := FileTree{
		repoRoot: repoRoot,
		expanded: make(map[string]bool),
	}
	ft.expanded[repoRoot] = true
	ft.refreshItems()
	return ft
}

// SetSize updates the component dimensions.
func (m *FileTree) SetSize(w, h int) {
	m.width = w
	m.height = h
}

// Focus enables keyboard interaction.
func (m *FileTree) Focus() {
	m.focused = true
}

// Blur disables keyboard interaction.
func (m *FileTree) Blur() {
	m.focused = false
}

// SelectedPath returns the path of the item under the cursor.
func (m *FileTree) SelectedPath() string {
	if m.cursor >= 0 && m.cursor < len(m.items) {
		return m.items[m.cursor].path
	}
	return ""
}

// Update handles messages and updates the model state.
func (m FileTree) Update(msg tea.Msg) (FileTree, tea.Cmd) {
	if !m.focused {
		return m, nil
	}

	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.items)-1 {
				m.cursor++
			}
		case "enter", "space", "right", "l":
			if m.cursor >= 0 && m.cursor < len(m.items) {
				item := m.items[m.cursor]
				if item.isDir {
					m.expanded[item.path] = !m.expanded[item.path]
					m.refreshItems()
				} else {
					m.selected = item.path
					return m, func() tea.Msg { return FileSelectedMsg{Path: item.path} }
				}
			}
		case "left", "h":
			if m.cursor >= 0 && m.cursor < len(m.items) {
				item := m.items[m.cursor]
				if item.isDir && m.expanded[item.path] {
					m.expanded[item.path] = false
					m.refreshItems()
				}
			}
		}
	}
	return m, nil
}

func (m *FileTree) refreshItems() {
	var items []treeItem

	// Helper to walk
	var walk func(path string, depth int)
	walk = func(path string, depth int) {
		entries, err := os.ReadDir(path)
		if err != nil {
			return
		}

		// Sort: Dirs first, then files
		sort.Slice(entries, func(i, j int) bool {
			if entries[i].IsDir() != entries[j].IsDir() {
				return entries[i].IsDir()
			}
			return entries[i].Name() < entries[j].Name()
		})

		for _, entry := range entries {
			if entry.Name() == ".git" {
				continue
			}
			fullPath := filepath.Join(path, entry.Name())
			isExpanded := m.expanded[fullPath]

			items = append(items, treeItem{
				path:     fullPath,
				name:     entry.Name(),
				isDir:    entry.IsDir(),
				depth:    depth,
				expanded: isExpanded,
			})

			if entry.IsDir() && isExpanded {
				walk(fullPath, depth+1)
			}
		}
	}

	// Start walk from root (but don't add root itself to list, or do?)
	// Usually file trees show contents of root.
	walk(m.repoRoot, 0)

	m.items = items
	// Adjust cursor if out of bounds
	if m.cursor >= len(m.items) {
		m.cursor = len(m.items) - 1
	}
	if m.cursor < 0 && len(m.items) > 0 {
		m.cursor = 0
	}
}

// View renders the component.
func (m FileTree) View() string {
	var s strings.Builder

	// Viewport logic could go here (scroll)
	// For now, naive render of all items, truncated by height

	start := 0
	end := len(m.items)

	// Simple scrolling: keep cursor in view
	if m.cursor >= m.height {
		start = m.cursor - m.height + 1
	}
	if end > start+m.height {
		end = start + m.height
	}

	for i := start; i < end; i++ {
		item := m.items[i]

		prefix := strings.Repeat("  ", item.depth)
		icon := "📄"
		if item.isDir {
			if item.expanded {
				icon = "📂"
			} else {
				icon = "📁"
			}
		}

		line := fmt.Sprintf("%s%s %s", prefix, icon, item.name)

		style := lipgloss.NewStyle()
		if i == m.cursor {
			style = style.Background(lipgloss.Color("63")).Foreground(lipgloss.Color("255"))
			if m.focused {
				line = "> " + line
			} else {
				line = "  " + line
			}
		} else {
			line = "  " + line
		}

		s.WriteString(style.Render(line))
		s.WriteString("\n")
	}

	return s.String()
}

// FileSelectedMsg indicates a file was selected.
type FileSelectedMsg struct {
	Path string
}
