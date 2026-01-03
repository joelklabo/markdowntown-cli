package audit

import (
	"strings"
	"testing"
)

func TestRenderMarkdown(t *testing.T) {
	output := Output{
		Summary: Summary{IssueCounts: SeverityCounts{Error: 1, Warning: 1, Info: 0}},
		Issues: []Issue{
			{
				RuleID:     "MD001",
				Severity:   SeverityError,
				Title:      "Conflict",
				Suggestion: "Fix it",
				Paths:      []Path{{Path: "./a.md", Scope: "repo"}},
			},
			{
				RuleID:   "MD002",
				Severity: SeverityWarning,
				Message:  "Needs attention",
				Paths:    []Path{{Path: "./b.md", Scope: "repo"}, {Path: "./c.md", Scope: "repo"}},
			},
		},
	}

	markdown := RenderMarkdown(output)
	if !strings.Contains(markdown, "# markdowntown audit") {
		t.Fatalf("expected heading")
	}
	if !strings.Contains(markdown, "Summary: 1 errors, 1 warnings, 0 info") {
		t.Fatalf("expected summary counts")
	}
	if !strings.Contains(markdown, "## Errors") || !strings.Contains(markdown, "## Warnings") {
		t.Fatalf("expected error and warning sections")
	}
	if strings.Contains(markdown, "## Info") {
		t.Fatalf("did not expect info section")
	}
	if !strings.Contains(markdown, "- [MD001] Conflict: ./a.md") {
		t.Fatalf("expected error line with path")
	}
	if !strings.Contains(markdown, "Suggestion: Fix it") {
		t.Fatalf("expected suggestion line")
	}
	if !strings.Contains(markdown, "- [MD002] Needs attention: ./b.md (+1 more)") {
		t.Fatalf("expected warning line with path count")
	}
}
