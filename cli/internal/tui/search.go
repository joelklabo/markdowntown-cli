package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	context_pkg "markdowntown-cli/internal/context"
)

// SearchPanel handles the search UI and results.
type SearchPanel struct {
	textInput textinput.Model
	viewport  viewport.Model
	active    bool
	results   []context_pkg.SearchResult
	loading   bool
	width     int
	height    int
}

// NewSearchPanel creates a new SearchPanel.

func NewSearchPanel() SearchPanel {

	ti := textinput.New()

	ti.Placeholder = "Search instructions..."

	ti.CharLimit = 156

	ti.Width = 40



	vp := viewport.New(40, 10)



	return SearchPanel{

		textInput: ti,

		viewport:  vp,

	}

}



// SetSize updates the panel dimensions.

func (s *SearchPanel) SetSize(w, h int) {

	s.width = w

	s.height = h

	s.textInput.Width = w - 4

	s.viewport.Width = w - 4

	s.viewport.Height = h - 8

}



// Focus enables the search input.
func (s *SearchPanel) Focus() tea.Cmd {
	s.active = true
	s.textInput.Focus()
	return textinput.Blink
}

// Blur disables the search input.
func (s *SearchPanel) Blur() {
	s.active = false
	s.textInput.Blur()
}

// Update handles messages for the search panel.
func (s SearchPanel) Update(msg tea.Msg) (SearchPanel, tea.Cmd) {
	if !s.active {
		return s, nil
	}

	var cmds []tea.Cmd
	var cmd tea.Cmd

	s.textInput, cmd = s.textInput.Update(msg)
	cmds = append(cmds, cmd)

	s.viewport, cmd = s.viewport.Update(msg)
	cmds = append(cmds, cmd)

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			s.Blur()
			return s, nil
		case "enter":
			query := s.textInput.Value()
			if query != "" {
				s.loading = true
				s.viewport.SetContent("Searching...")
				return s, func() tea.Msg {
					return SearchRequestMsg{Query: query}
				}
			}
		}
	case SearchResultsMsg:
		s.loading = false
		s.results = msg.Results
		s.refreshViewport()
	}

	return s, tea.Batch(cmds...)
}

func (s *SearchPanel) refreshViewport() {
	var sb strings.Builder
	if len(s.results) > 0 {
		for _, r := range s.results {
			clientStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("63")).Bold(true)
			sb.WriteString(fmt.Sprintf("%s %s:%d\n", clientStyle.Render(string(r.Client)), r.Path, r.Line))
			sb.WriteString(fmt.Sprintf("  %s\n\n", lipgloss.NewStyle().Faint(true).Render(r.Text)))
		}
	} else if s.textInput.Value() != "" {
		sb.WriteString("No results found.")
	}
	s.viewport.SetContent(sb.String())
}

// View renders the search panel.
func (s SearchPanel) View() string {
	if !s.active {
		return ""
	}

	var sb strings.Builder
	sb.WriteString(lipgloss.NewStyle().Bold(true).Render("Search Instructions"))
	sb.WriteString("\n")
	sb.WriteString(s.textInput.View())
	sb.WriteString("\n\n")
	sb.WriteString(s.viewport.View())

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("63")).
		Padding(1, 2).
		Render(sb.String())
}

// SearchRequestMsg indicates a search was requested.
type SearchRequestMsg struct {
	Query string
}

// SearchResultsMsg indicates search results are available.
type SearchResultsMsg struct {
	Results []context_pkg.SearchResult
}
