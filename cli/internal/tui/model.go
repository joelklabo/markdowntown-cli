package tui

import (
	"context"
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	context_pkg "markdowntown-cli/internal/context"
	"markdowntown-cli/internal/instructions"
)

// Start launches the TUI.
func Start(repoRoot string) error {
	engine := context_pkg.NewEngine()
	p := tea.NewProgram(initialModel(repoRoot, engine), tea.WithAltScreen())
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

	fileTree   FileTree
	engine     context_pkg.Engine
	resolution *context_pkg.UnifiedResolution
	loading    bool  // Loading state
	lastErr    error // Last error encountered
}

func initialModel(repoRoot string, engine context_pkg.Engine) model {
	ft := NewFileTree(repoRoot)
	ft.Focus()

	if engine == nil {
		engine = context_pkg.NewEngine()
	}

	return model{
		repoRoot: repoRoot,
		fileTree: ft,
		engine:   engine,
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

// ContextLoadedMsg indicates that context content has been loaded.
type ContextLoadedMsg struct {
	Path       string
	Resolution *context_pkg.UnifiedResolution
	Error      error
}

func fetchContextCmd(engine context_pkg.Engine, repoRoot, path string) tea.Cmd {
	return func() tea.Msg {
		// We use background context for now as cancellation is not fully wired to TUI yet
		res, err := engine.ResolveContext(context.Background(), context_pkg.ResolveOptions{
			RepoRoot: repoRoot,
			FilePath: path,
			Clients:  instructions.AllClients(),
		})

		if err != nil {
			return ContextLoadedMsg{Path: path, Error: err}
		}

		return ContextLoadedMsg{
			Path:       path,
			Resolution: &res,
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
		m.fileTree.SetSize(max(0, m.width/3-2), max(0, m.height-2))
	case FileSelectedMsg:
		m.loading = true
		m.resolution = nil
		m.lastErr = nil
		cmd = fetchContextCmd(m.engine, m.repoRoot, msg.Path)
	case ContextLoadedMsg:
		m.loading = false
		m.lastErr = msg.Error
		m.resolution = msg.Resolution
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

	if m.width < 40 || m.height < 10 {
		return "Terminal too small."
	}

	style := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("63"))

	// Ensure we don't pass negative values to Width/Height
	leftWidth := max(0, m.width/3-2)
	rightWidth := max(0, (m.width/3)*2-2)
	paneHeight := max(0, m.height-2)

	leftPane := style.
		Width(leftWidth).
		Height(paneHeight).
		Render(m.fileTree.View())

	var rightContent string
	switch {
	case m.loading:
		rightContent = "Loading context..."
	case m.lastErr != nil:
		rightContent = fmt.Sprintf("Error: %v", m.lastErr)
	case m.resolution != nil:
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("# Context for %s\n\n", m.resolution.FilePath))

		// Sort clients for deterministic view
		clients := instructions.AllClients()
		for _, client := range clients {
			res := m.resolution.Results[client]
			clientName := string(client)
			if len(clientName) > 0 {
				clientName = strings.ToUpper(clientName[:1]) + clientName[1:]
			}

			sb.WriteString(fmt.Sprintf("## %s\n", clientName))
			switch {
			case res.Error != nil:
				sb.WriteString(fmt.Sprintf("  ❌ Error: %v\n", res.Error))
			case res.Resolution != nil:
				sb.WriteString(fmt.Sprintf("  ✅ Applied files: %d\n", len(res.Resolution.Applied)))
				if len(res.Resolution.Warnings) > 0 {
					sb.WriteString(fmt.Sprintf("  ⚠️ Warnings: %d\n", len(res.Resolution.Warnings)))
				}
			default:
				sb.WriteString("  (No resolution)\n")
			}
			sb.WriteString("\n")
		}
		rightContent = sb.String()
	default:
		rightContent = "Select a file to view context."
	}

	rightPane := style.
		Width(rightWidth).
		Height(paneHeight).
		Render(rightContent)

	return lipgloss.JoinHorizontal(lipgloss.Top, leftPane, rightPane)
}
