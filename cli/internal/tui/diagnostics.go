package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"markdowntown-cli/internal/audit"
)

func renderDiagnostics(issues []audit.Issue) string {
	// UX: Explicitly state if no issues found, rather than silence
	if len(issues) == 0 {
		return lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Italic(true).Render("✓ No configuration issues found.")
	}

	var sb strings.Builder

	sb.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("11")).Render("Diagnostics"))
	sb.WriteString("\n")

	for _, issue := range issues {
		severityColor := "240" // Default gray
		icon := "•"

		switch issue.Severity {
		case audit.SeverityError:
			severityColor = "160" // Red
			icon = "❌"
		case audit.SeverityWarning:
			severityColor = "214" // Orange/Yellow
			icon = "⚠️"
		case audit.SeverityInfo:
			severityColor = "63" // Blue
			icon = "ℹ️"
		}

		titleStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(severityColor)).Bold(true)
		sb.WriteString(fmt.Sprintf("%s %s: %s\n", icon, titleStyle.Render(issue.Title), issue.Message))

		if issue.Suggestion != "" {
			suggestionStyle := lipgloss.NewStyle().Faint(true).Foreground(lipgloss.Color("250"))
			sb.WriteString(fmt.Sprintf("  💡 %s\n", suggestionStyle.Render(issue.Suggestion)))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}
