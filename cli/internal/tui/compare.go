package tui

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss"
	context_pkg "markdowntown-cli/internal/context"
	"markdowntown-cli/internal/instructions"
)

func renderCompareMode(m model) string {
	var sb strings.Builder

	switch m.compareState {
	case compareSelectingA:
		sb.WriteString(lipgloss.NewStyle().Bold(true).Render("Select first client to compare (1-5):"))
		sb.WriteString("\n\n")
		for i, entry := range m.tabs.Entries {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, entry))
		}
	case compareSelectingB:
		if m.compareA >= len(m.tabs.Entries) {
			return "Error: Invalid selection."
		}
		sb.WriteString(lipgloss.NewStyle().Bold(true).Render(fmt.Sprintf("Comparing: %s vs ...", m.tabs.Entries[m.compareA])))
		sb.WriteString("\n")
		sb.WriteString(lipgloss.NewStyle().Bold(true).Render("Select second client to compare (1-5):"))
		sb.WriteString("\n\n")
		for i, entry := range m.tabs.Entries {
			if i == m.compareA {
				continue
			}
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, entry))
		}
	case compareActive:
		if m.compareA >= len(m.tabs.Entries) || m.compareB >= len(m.tabs.Entries) {
			return "Error: Invalid selection."
		}
		clientA := instructions.Client(m.tabs.Entries[m.compareA])
		clientB := instructions.Client(m.tabs.Entries[m.compareB])

		resA, okA := m.resolution.Results[clientA]
		resB, okB := m.resolution.Results[clientB]

		if !okA || !okB {
			return "Error: Client results not found."
		}

		sb.WriteString(lipgloss.NewStyle().Bold(true).Render(fmt.Sprintf("Comparison: %s vs %s", clientA, clientB)))
		sb.WriteString("\n\n")

		diff := context_pkg.DiffResolutions(resA.Resolution, resB.Resolution)
		sb.WriteString(renderCompareResults(diff, (m.width/3)*2-4))
	}

	return sb.String()
}

func renderCompareResults(diff context_pkg.Diff, width int) string {
	var sb strings.Builder

	colWidth := width / 2

	styleA := lipgloss.NewStyle().Width(colWidth).PaddingRight(2)
	styleB := lipgloss.NewStyle().Width(colWidth)

	headerA := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("63")).Render("Only in A")
	headerB := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("63")).Render("Only in B")

	sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, styleA.Render(headerA), styleB.Render(headerB)))
	sb.WriteString("\n")

	maxRows := max(len(diff.OnlyInA), len(diff.OnlyInB))
	for i := 0; i < maxRows; i++ {
		var valA, valB string
		if i < len(diff.OnlyInA) {
			valA = "• " + filepath.Base(diff.OnlyInA[i].Path)
		}
		if i < len(diff.OnlyInB) {
			valB = "• " + filepath.Base(diff.OnlyInB[i].Path)
		}
		sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, styleA.Render(valA), styleB.Render(valB)))
		sb.WriteString("\n")
	}

	if len(diff.Changed) > 0 {
		sb.WriteString("\n")
		sb.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("166")).Render("Changed (A vs B)"))
		sb.WriteString("\n")
		for _, d := range diff.Changed {
			sb.WriteString(fmt.Sprintf("• %s: ", filepath.Base(d.Path)))
			var changes []string
			if d.Reasons {
				changes = append(changes, fmt.Sprintf("reason (%s vs %s)", d.A.Reason, d.B.Reason))
			}
			if d.Scopes {
				changes = append(changes, fmt.Sprintf("scope (%s vs %s)", d.A.Scope, d.B.Scope))
			}
			if d.Truncated {
				changes = append(changes, fmt.Sprintf("truncated (%v vs %v)", d.A.Truncated, d.B.Truncated))
			}
			sb.WriteString(strings.Join(changes, ", "))
			sb.WriteString("\n")
		}
	}

	if len(diff.Common) > 0 {
		sb.WriteString("\n")
		sb.WriteString(lipgloss.NewStyle().Faint(true).Render(fmt.Sprintf("%d files in common", len(diff.Common))))
		sb.WriteString("\n")
	}

	return sb.String()
}
