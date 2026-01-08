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

	fileTree   FileTree
	tabs       Tabs
	engine     context_pkg.Engine
	resolution *context_pkg.UnifiedResolution
	loading    bool  // Loading state
	lastErr    error // Last error encountered

	// Concurrency control
	requestGen uint64
}

func initialModel(repoRoot string) model {
	ft := NewFileTree(repoRoot)
	ft.Focus()

	clients := instructions.AllClients()
	tabEntries := make([]string, len(clients))
	for i, c := range clients {
		tabEntries[i] = string(c)
	}

	return model{
		repoRoot: repoRoot,
		fileTree: ft,
		tabs:     NewTabs(tabEntries),
		engine:   context_pkg.NewEngine(),
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

// ContextLoadedMsg indicates that context content has been loaded.
type ContextLoadedMsg struct {
	Path       string
	Generation uint64 // Validate against current model generation
	Resolution *context_pkg.UnifiedResolution
	Error      error
}

func fetchContextCmd(engine context_pkg.Engine, repoRoot, path string, generation uint64) tea.Cmd {
	return func() tea.Msg {
		// We use background context for now.
		res, err := engine.ResolveContext(context.Background(), context_pkg.ResolveOptions{
			RepoRoot: repoRoot,
			FilePath: path,
			Clients:  instructions.AllClients(),
		})

		if err != nil {
			return ContextLoadedMsg{Path: path, Generation: generation, Error: err}
		}

		return ContextLoadedMsg{
			Path:       path,
			Generation: generation,
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
			m.tabs.Active = (m.tabs.Active + 1) % len(m.tabs.Entries)
		case "1", "2", "3", "4", "5":
			idx := int(msg.String()[0] - '1')
			if idx < len(m.tabs.Entries) {
				m.tabs.Active = idx
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true

		// Ensure non-negative dimensions
		treeWidth := max(0, m.width/3-2)
		treeHeight := max(0, m.height-2)
		m.fileTree.SetSize(treeWidth, treeHeight)
	case FileSelectedMsg:
		// Increment generation to invalidate previous in-flight requests
		m.requestGen++
		m.loading = true
		m.resolution = nil
		m.lastErr = nil
		cmd = fetchContextCmd(m.engine, m.repoRoot, msg.Path, m.requestGen)
	case ContextLoadedMsg:
		// CRITICAL: Only accept response if generations match
		if msg.Generation == m.requestGen {
			m.loading = false
			m.lastErr = msg.Error
			m.resolution = msg.Resolution
		}
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

	// Guard against small terminals
	if m.width < 40 || m.height < 10 {
		return "Terminal too small."
	}

	style := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("63"))

	// Ensure dimensions are safe
	paneHeight := max(0, m.height-2)
	leftWidth := max(0, m.width/3-2)

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
		sb.WriteString(m.tabs.View())
		sb.WriteString("\n\n")

		activeClient := instructions.Client(m.tabs.Entries[m.tabs.Active])
		res, ok := m.resolution.Results[activeClient]

		if !ok {
			sb.WriteString(fmt.Sprintf("No data for %s", activeClient))
		} else {
			if res.Error != nil {
				sb.WriteString(fmt.Sprintf("❌ Error: %v\n", res.Error))
			} else if res.Resolution != nil {
				sb.WriteString(fmt.Sprintf("✅ Applied files: %d\n", len(res.Resolution.Applied)))
				if len(res.Resolution.Warnings) > 0 {
					sb.WriteString(fmt.Sprintf("⚠️ Warnings: %d\n", len(res.Resolution.Warnings)))
				}
			}
		}
		rightContent = sb.String()
	default:
		rightContent = "Select a file to view context."
	}

	rightWidth := max(0, (m.width/3)*2-2)
	rightPane := style.
		Width(rightWidth).
		Height(paneHeight).
		Render(rightContent)

	return lipgloss.JoinHorizontal(lipgloss.Top, leftPane, rightPane)
}
