package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Tabs represents a tab bar component.
type Tabs struct {
	Entries []string
	Active  int
}

// NewTabs creates a new Tabs component.
func NewTabs(entries []string) Tabs {
	return Tabs{
		Entries: entries,
		Active:  0,
	}
}

// View renders the tab bar.
func (t Tabs) View() string {
	var renderedTabs []string

	for i, entry := range t.Entries {
		style := lipgloss.NewStyle().
			Padding(0, 1).
			Border(lipgloss.NormalBorder(), false, false, true, false).
			BorderForeground(lipgloss.Color("240"))

		if i == t.Active {
			style = style.
				Foreground(lipgloss.Color("63")).
				BorderForeground(lipgloss.Color("63")).
				Bold(true)
		}

		display := entry
		if len(display) > 0 {
			display = strings.ToUpper(display[:1]) + display[1:]
		}

		renderedTabs = append(renderedTabs, style.Render(display))
	}

	row := lipgloss.JoinHorizontal(lipgloss.Top, renderedTabs...)
	return row
}
