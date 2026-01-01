package audit

import (
	"reflect"
	"testing"

	"markdowntown-cli/internal/scan"
)

func TestParseSeverity(t *testing.T) {
	cases := []struct {
		name  string
		value string
		want  Severity
	}{
		{name: "error", value: "error", want: SeverityError},
		{name: "warning", value: " Warning ", want: SeverityWarning},
		{name: "info", value: "INFO", want: SeverityInfo},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ParseSeverity(tc.value)
			if err != nil {
				t.Fatalf("ParseSeverity error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("expected %s, got %s", tc.want, got)
			}
		})
	}

	if _, err := ParseSeverity("nope"); err == nil {
		t.Fatalf("expected error for invalid severity")
	}
}

func TestParseRedactMode(t *testing.T) {
	cases := []struct {
		name  string
		value string
		want  RedactMode
	}{
		{name: "auto", value: "auto", want: RedactAuto},
		{name: "always", value: " ALWAYS ", want: RedactAlways},
		{name: "never", value: "never", want: RedactNever},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ParseRedactMode(tc.value)
			if err != nil {
				t.Fatalf("ParseRedactMode error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("expected %s, got %s", tc.want, got)
			}
		})
	}

	if _, err := ParseRedactMode("nope"); err == nil {
		t.Fatalf("expected error for invalid redaction mode")
	}
}

func TestFilterRules(t *testing.T) {
	rules := []Rule{
		{ID: "MD001", Severity: SeverityError, Run: func(Context) []Issue { return nil }},
		{ID: "MD002", Severity: SeverityWarning, Run: func(Context) []Issue { return nil }},
		{ID: "MD003", Severity: SeverityInfo, Run: func(Context) []Issue { return nil }},
	}

	filtered, err := FilterRules(rules, []string{"MD001, md003"}, []string{"md002"})
	if err != nil {
		t.Fatalf("FilterRules error: %v", err)
	}
	if len(filtered) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(filtered))
	}
	if filtered[0].ID != "MD001" || filtered[1].ID != "MD003" {
		t.Fatalf("unexpected rule order: %#v", filtered)
	}

	if _, err := FilterRules(rules, []string{"MD999"}, nil); err == nil {
		t.Fatalf("expected error for unknown rule id")
	}
}

func TestFilterOutput(t *testing.T) {
	output := scan.Output{
		RepoRoot: "/repo",
		Configs: []scan.ConfigEntry{
			{Path: "/repo/AGENTS.md", Scope: "repo"},
			{Path: "/repo/CLAUDE.md", Scope: "repo"},
		},
		Warnings: []scan.Warning{
			{Path: "/repo/AGENTS.md", Code: "CONFIG_CONFLICT", Message: "conflict"},
			{Path: "", Code: "ERROR", Message: "oops"},
		},
	}

	filtered, err := FilterOutput(output, []string{"AGENTS.md"})
	if err != nil {
		t.Fatalf("FilterOutput error: %v", err)
	}
	if len(filtered.Configs) != 1 || filtered.Configs[0].Path != "/repo/CLAUDE.md" {
		t.Fatalf("unexpected configs after filter: %#v", filtered.Configs)
	}
	if len(filtered.Warnings) != 1 || filtered.Warnings[0].Code != "ERROR" {
		t.Fatalf("unexpected warnings after filter: %#v", filtered.Warnings)
	}

	if _, err := FilterOutput(output, []string{"["}); err == nil {
		t.Fatalf("expected error for invalid glob pattern")
	}
}

func TestBuildSummaryAndShouldFail(t *testing.T) {
	issues := []Issue{
		{RuleID: "MD002", Severity: SeverityWarning},
		{RuleID: "MD001", Severity: SeverityError},
		{RuleID: "MD001", Severity: SeverityError},
		{RuleID: "MD003", Severity: SeverityInfo},
	}

	summary := BuildSummary(issues)
	if summary.IssueCounts.Error != 2 || summary.IssueCounts.Warning != 1 || summary.IssueCounts.Info != 1 {
		t.Fatalf("unexpected counts: %#v", summary.IssueCounts)
	}
	if !reflect.DeepEqual(summary.RulesFired, []string{"MD001", "MD002", "MD003"}) {
		t.Fatalf("unexpected rules fired: %#v", summary.RulesFired)
	}

	if !ShouldFail(issues, SeverityWarning) {
		t.Fatalf("expected failure at warning threshold")
	}
	if ShouldFail([]Issue{{Severity: SeverityInfo}}, SeverityWarning) {
		t.Fatalf("did not expect info to fail warning threshold")
	}
}

func TestBuildScanWarnings(t *testing.T) {
	warnings := []scan.Warning{
		{Path: "/repo/AGENTS.md", Code: "CONFIG_CONFLICT", Message: "conflict"},
		{Path: "/home/user/.config/markdowntown/config.json", Code: "EACCES", Message: "denied"},
	}
	issues := []Issue{{RuleID: "MD001", Severity: SeverityError}}
	redactor := NewRedactor("/repo", "/home/user", "/home/user/.config", RedactAuto)

	output := BuildScanWarnings(warnings, issues, redactor, "/repo")
	if len(output) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(output))
	}
	if output[0].Path != "$XDG_CONFIG_HOME/markdowntown/config.json" {
		t.Fatalf("unexpected redacted path: %s", output[0].Path)
	}
	if output[0].Code != "EACCES" {
		t.Fatalf("unexpected warning code: %s", output[0].Code)
	}
}
