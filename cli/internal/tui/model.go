package tui

import (
	"fmt"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Start launches the TUI.
func Start(repoRoot string) error {
	p := tea.NewProgram(initialModel(repoRoot), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running program: %v", err)
	}
	return nil
}

type model struct {
	repoRoot string
	width    int
	height   int
	ready    bool

	fileTree    FileTree
	selectedCtx string // Content to display
	loading     bool   // Loading state
}

func initialModel(repoRoot string) model {
	ft := NewFileTree(repoRoot)
	ft.Focus()

	return model{
		repoRoot: repoRoot,
		fileTree: ft,
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

// ContextLoadedMsg indicates that context content has been loaded.
type ContextLoadedMsg struct {
	Path    string
	Content string
}

func fetchContextCmd(path string) tea.Cmd {
	return func() tea.Msg {
		time.Sleep(500 * time.Millisecond) // Simulate delay
		return ContextLoadedMsg{
			Path:    path,
			Content: fmt.Sprintf("# Context for %s\n\n## Gemini\n- Instructions resolved: Yes\n- Ignored: No\n\n## Codex\n- Skills found: 2", path),
		}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "tab":
			// Toggle focus logic here if needed
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true
		m.fileTree.SetSize(m.width/3-2, m.height-2)
	case FileSelectedMsg:
		m.loading = true
		m.selectedCtx = ""
		cmd = fetchContextCmd(msg.Path)
	case ContextLoadedMsg:
		m.loading = false
		m.selectedCtx = msg.Content
	}

	// Handle file tree update
	var subCmd tea.Cmd
	m.fileTree, subCmd = m.fileTree.Update(msg)

	return m, tea.Batch(cmd, subCmd)
}

func (m model) View() string {
	if !m.ready {
		return "Initializing..."
	}

	style := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("63"))

	leftPane := style.
		Width(m.width/3 - 2).
		Height(m.height - 2).
		Render(m.fileTree.View())

	var rightContent string
	switch {
	case m.loading:
		rightContent = "Loading context..."
	case m.selectedCtx != "":
		rightContent = m.selectedCtx
	default:
		rightContent = "Select a file to view context."
	}

	rightPane := style.
		Width((m.width/3)*2 - 2).
		Height(m.height - 2).
		Render(rightContent)

	return lipgloss.JoinHorizontal(lipgloss.Top, leftPane, rightPane)
}
