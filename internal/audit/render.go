package audit

import (
	"fmt"
	"io"
	"strings"
)

// RenderMarkdown renders audit output as Markdown.
func RenderMarkdown(w io.Writer, output Output) error {
	if _, err := fmt.Fprintln(w, "# markdowntown audit"); err != nil {
		return err
	}
	if _, err := fmt.Fprintln(w); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "Summary: %d error(s), %d warn(s), %d info\n\n", output.Summary.Error, output.Summary.Warn, output.Summary.Info); err != nil {
		return err
	}

	if err := renderSeveritySection(w, "Errors", SeverityError, output.Issues); err != nil {
		return err
	}
	if err := renderSeveritySection(w, "Warnings", SeverityWarn, output.Issues); err != nil {
		return err
	}
	if err := renderSeveritySection(w, "Info", SeverityInfo, output.Issues); err != nil {
		return err
	}

	return nil
}

func renderSeveritySection(w io.Writer, title string, severity Severity, issues []Issue) error {
	section := filterIssues(issues, severity)
	if len(section) == 0 {
		return nil
	}
	if _, err := fmt.Fprintf(w, "## %s\n", title); err != nil {
		return err
	}
	for _, issue := range section {
		line := fmt.Sprintf("- [%s] %s", issue.RuleID, issue.Title)
		if len(issue.Paths) > 0 {
			line += ": " + strings.Join(issue.Paths, ", ")
		}
		if _, err := fmt.Fprintln(w, line); err != nil {
			return err
		}
		if issue.Suggestion != "" {
			if _, err := fmt.Fprintf(w, "  - Suggestion: %s\n", issue.Suggestion); err != nil {
				return err
			}
		}
		if issue.Message != "" {
			if _, err := fmt.Fprintf(w, "  - Details: %s\n", issue.Message); err != nil {
				return err
			}
		}
	}
	if _, err := fmt.Fprintln(w); err != nil {
		return err
	}
	return nil
}

func filterIssues(issues []Issue, severity Severity) []Issue {
	filtered := make([]Issue, 0, len(issues))
	for _, issue := range issues {
		if issue.Severity == severity {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}
