package audit

import "testing"

func TestNormalizeIssuesOrdering(t *testing.T) {
	engine := NewEngine(NewRedactor("/repo", "/home/user", "/home/user/.config", RedactAuto))

	issues := []Issue{
		{
			RuleID:   "MD010",
			Severity: SeverityWarning,
			Paths:    []Path{{Path: "./b.md", Scope: "repo"}},
		},
		{
			RuleID:   "MD001",
			Severity: SeverityError,
			Paths:    []Path{{Path: "./a.md", Scope: "repo"}},
		},
		{
			RuleID:   "MD002",
			Severity: SeverityInfo,
			Paths:    []Path{{Path: "./c.md", Scope: "repo"}},
		},
	}

	engine.NormalizeIssues(issues)

	if issues[0].Severity != SeverityError {
		t.Fatalf("expected error severity first")
	}
	if issues[1].Severity != SeverityWarning {
		t.Fatalf("expected warning severity second")
	}
	if issues[2].Severity != SeverityInfo {
		t.Fatalf("expected info severity third")
	}
}

func TestFingerprintIssueDeterministic(t *testing.T) {
	issue := Issue{
		RuleID:   "MD004",
		Severity: SeverityWarning,
		Paths: []Path{
			{Path: "./b.md", Scope: "repo"},
			{Path: "./a.md", Scope: "repo"},
		},
		Tools: []Tool{
			{ToolID: "beta", Kind: "config"},
			{ToolID: "alpha", Kind: "config"},
		},
		Evidence: map[string]any{
			"warning": "empty",
			"size":    0,
		},
	}

	fingerprint1 := FingerprintIssue(issue)
	fingerprint2 := FingerprintIssue(issue)
	if fingerprint1 != fingerprint2 {
		t.Fatalf("expected stable fingerprint")
	}

	engine := NewEngine(NewRedactor("/repo", "/home/user", "/home/user/.config", RedactAuto))
	engine.NormalizeIssues([]Issue{issue})
	fingerprint3 := FingerprintIssue(issue)
	if fingerprint1 != fingerprint3 {
		t.Fatalf("expected fingerprint unaffected by normalization")
	}
}
