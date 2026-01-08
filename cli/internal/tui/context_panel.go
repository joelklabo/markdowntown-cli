package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"markdowntown-cli/internal/instructions"
)

// renderContextDetails formats the Resolution data into a readable string for the TUI.
func renderContextDetails(res *instructions.Resolution) string {
	if res == nil {
		return ""
	}

	var sb strings.Builder

	// Applied Files
	sb.WriteString(lipgloss.NewStyle().Bold(true).Underline(true).Render("Applied Files"))
	sb.WriteString("\n")
	if len(res.Applied) == 0 {
		sb.WriteString("  (None)\n")
	} else {
		for _, file := range res.Applied {
			reasonColor := "240"
			switch file.Reason {
			case instructions.ReasonPrimary:
				reasonColor = "35" // Green-ish
			case instructions.ReasonOverride:
				reasonColor = "166" // Orange-ish
			case instructions.ReasonFallback:
				reasonColor = "63" // Purple-ish
			}

			reason := lipgloss.NewStyle().Foreground(lipgloss.Color(reasonColor)).Render(string(file.Reason))
			scope := lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render(string(file.Scope))

			sb.WriteString(fmt.Sprintf("  • %s [%s] (%s)\n", file.Path, scope, reason))
			if file.Truncated {
				sb.WriteString(fmt.Sprintf("    %s\n", lipgloss.NewStyle().Foreground(lipgloss.Color("160")).Render("⚠️ Truncated to "+formatBytes(file.IncludedBytes))))
			}
		}
	}
	sb.WriteString("\n")

	// Warnings
	if len(res.Warnings) > 0 {
		sb.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("11")).Render("Warnings"))
		sb.WriteString("\n")
		for _, w := range res.Warnings {
			sb.WriteString(fmt.Sprintf("  ⚠️ %s\n", w))
		}
		sb.WriteString("\n")
	}

	// Metadata
	sb.WriteString(lipgloss.NewStyle().Bold(true).Render("Metadata"))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf("  • Repo Root: %s\n", res.RepoRoot))
	if res.CodexHome != "" {
		sb.WriteString(fmt.Sprintf("  • Codex Home: %s\n", res.CodexHome))
	}
	if res.ConfigPath != "" {
		sb.WriteString(fmt.Sprintf("  • Config Path: %s\n", res.ConfigPath))
	}

	return sb.String()
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
