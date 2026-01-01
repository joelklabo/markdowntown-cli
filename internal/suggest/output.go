package suggest

import (
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
)

// WriteSuggestReport renders suggest or audit output in JSON or Markdown.
func WriteSuggestReport(w io.Writer, format string, report Report) error {
	switch normalizeFormat(format) {
	case "json":
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		enc.SetEscapeHTML(false)
		return enc.Encode(report)
	case "md":
		payload, err := renderSuggestMarkdown(report)
		if err != nil {
			return err
		}
		_, err = fmt.Fprint(w, payload)
		return err
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}
}

// WriteResolveReport renders resolve output in JSON or Markdown.
func WriteResolveReport(w io.Writer, format string, report ResolveReport) error {
	switch normalizeFormat(format) {
	case "json":
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		enc.SetEscapeHTML(false)
		return enc.Encode(report)
	case "md":
		payload := renderResolveMarkdown(report)
		_, err := fmt.Fprint(w, payload)
		return err
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}
}

func normalizeFormat(format string) string {
	trimmed := strings.ToLower(strings.TrimSpace(format))
	switch trimmed {
	case "markdown", "md":
		return "md"
	case "json", "":
		return "json"
	default:
		return trimmed
	}
}

func renderSuggestMarkdown(report Report) (string, error) {
	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("# Suggestions (%s)\n\n", report.Client))

	if len(report.Suggestions) > 0 {
		sorted := append([]Suggestion(nil), report.Suggestions...)
		sort.Slice(sorted, func(i, j int) bool { return sorted[i].ID < sorted[j].ID })
		if strings.EqualFold(string(report.Client), "codex") {
			tempReport := SuggestionReport{Suggestions: sorted}
			payload, err := RenderCodexSuggestions(tempReport)
			if err != nil {
				return "", err
			}
			builder.WriteString(payload)
			if !strings.HasSuffix(payload, "\n") {
				builder.WriteString("\n")
			}
		} else {
			for _, suggestion := range sorted {
				builder.WriteString(fmt.Sprintf("- %s\n", suggestion.Text))
				if len(suggestion.Sources) > 0 {
					builder.WriteString(fmt.Sprintf("  - Sources: %s\n", strings.Join(suggestion.Sources, ", ")))
				}
			}
		}
	} else {
		builder.WriteString("_No suggestions available._\n")
	}

	appendAuditSections(&builder, report)
	return builder.String(), nil
}

func renderResolveMarkdown(report ResolveReport) string {
	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("# Resolve (%s)\n\n", report.Client))

	if len(report.Resolution.Applied) == 0 {
		builder.WriteString("_No instruction files applied._\n")
		return builder.String()
	}

	builder.WriteString("## Applied Files\n")
	for _, file := range report.Resolution.Applied {
		builder.WriteString(fmt.Sprintf("- %s (%s, %s)\n", file.Path, file.Scope, file.Reason))
	}

	if len(report.Resolution.Conflicts) > 0 {
		builder.WriteString("\n## Conflicts\n")
		for _, conflict := range report.Resolution.Conflicts {
			fmt.Fprintf(&builder, "- %s\n", conflict.Reason)
			for _, path := range conflict.Paths {
				fmt.Fprintf(&builder, "  - %s\n", path)
			}
		}
	}

	if len(report.Resolution.SettingsRequired) > 0 {
		builder.WriteString("\n## Settings Required\n")
		for _, setting := range report.Resolution.SettingsRequired {
			fmt.Fprintf(&builder, "- %s\n", setting)
		}
	}

	return builder.String()
}

func appendAuditSections(builder *strings.Builder, report Report) {
	if len(report.Conflicts) > 0 {
		builder.WriteString("\n## Conflicts\n")
		for _, conflict := range report.Conflicts {
			fmt.Fprintf(builder, "- %s\n", conflict.Reason)
			for _, claimID := range conflict.ClaimIDs {
				fmt.Fprintf(builder, "  - %s\n", claimID)
			}
		}
	}

	if len(report.Omissions) > 0 {
		builder.WriteString("\n## Omissions\n")
		for _, omission := range report.Omissions {
			fmt.Fprintf(builder, "- %s: %s\n", omission.ClaimID, omission.Reason)
		}
	}

	if len(report.Warnings) > 0 {
		builder.WriteString("\n## Warnings\n")
		for _, warning := range report.Warnings {
			fmt.Fprintf(builder, "- %s\n", warning)
		}
	}
}
