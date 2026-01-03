package audit

import (
	"fmt"
	"strings"
)

// RenderMarkdown renders the audit output as deterministic Markdown.
func RenderMarkdown(output Output) string {
	var builder strings.Builder
	builder.WriteString("# markdowntown audit\n\n")

	counts := output.Summary.IssueCounts
	builder.WriteString(fmt.Sprintf("Summary: %d errors, %d warnings, %d info\n", counts.Error, counts.Warning, counts.Info))

	writeSection(&builder, "Errors", SeverityError, output.Issues)
	writeSection(&builder, "Warnings", SeverityWarning, output.Issues)
	writeSection(&builder, "Info", SeverityInfo, output.Issues)

	if !strings.HasSuffix(builder.String(), "\n") {
		builder.WriteString("\n")
	}
	return builder.String()
}

func writeSection(builder *strings.Builder, title string, severity Severity, issues []Issue) {
	sectionIssues := issuesForSeverity(issues, severity)
	if len(sectionIssues) == 0 {
		return
	}

	builder.WriteString("\n")
	builder.WriteString("## " + title + "\n\n")
	for _, issue := range sectionIssues {
		line := fmt.Sprintf("- [%s] %s", issue.RuleID, issueTitle(issue))
		if label := issuePathLabel(issue); label != "" {
			line += ": " + label
		}
		builder.WriteString(line + "\n")

		if issue.Suggestion != "" {
			builder.WriteString("  - Suggestion: " + issue.Suggestion + "\n")
		} else if issue.Message != "" {
			builder.WriteString("  - " + issue.Message + "\n")
		}
	}
}

func issuesForSeverity(issues []Issue, severity Severity) []Issue {
	filtered := make([]Issue, 0, len(issues))
	for _, issue := range issues {
		if issue.Severity == severity {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}

func issueTitle(issue Issue) string {
	if issue.Title != "" {
		return issue.Title
	}
	return issue.Message
}

func issuePathLabel(issue Issue) string {
	if len(issue.Paths) == 0 {
		return ""
	}
	label := issue.Paths[0].Path
	if len(issue.Paths) > 1 {
		label = fmt.Sprintf("%s (+%d more)", label, len(issue.Paths)-1)
	}
	return label
}
