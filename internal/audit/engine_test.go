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

func TestNormalizeIssuesTiebreakers(t *testing.T) {
	engine := NewEngine(NewRedactor("/repo", "/home/user", "/home/user/.config", RedactAuto))

	issues := []Issue{
		{
			RuleID:   "MD001",
			Severity: SeverityError,
			Paths:    []Path{{Path: "./b.md", Scope: "repo"}},
			Tools:    []Tool{{ToolID: "beta", Kind: "rules"}},
		},
		{
			RuleID:   "MD001",
			Severity: SeverityError,
			Paths:    []Path{{Path: "./a.md", Scope: "repo"}},
			Tools:    []Tool{{ToolID: "alpha", Kind: "rules"}},
		},
		{
			RuleID:   "MD001",
			Severity: SeverityError,
			Paths:    []Path{{Path: "./a.md", Scope: "repo"}},
			Tools:    []Tool{{ToolID: "alpha", Kind: "config"}},
		},
	}

	engine.NormalizeIssues(issues)

	if issues[0].Paths[0].Path != "./a.md" || issues[0].Tools[0].Kind != "config" {
		t.Fatalf("expected a.md config first, got %#v", issues[0])
	}
	if issues[1].Paths[0].Path != "./a.md" || issues[1].Tools[0].Kind != "rules" {
		t.Fatalf("expected a.md rules second, got %#v", issues[1])
	}
	if issues[2].Paths[0].Path != "./b.md" {
		t.Fatalf("expected b.md last, got %#v", issues[2])
	}
}

func TestPrimaryHelpers(t *testing.T) {
	if primaryPath(nil) != "" {
		t.Fatalf("expected empty primary path")
	}
	if primaryTool(nil) != "" {
		t.Fatalf("expected empty primary tool")
	}
	if primaryKind(nil) != "" {
		t.Fatalf("expected empty primary kind")
	}
}

func TestSortHelpers(t *testing.T) {
	paths := []Path{
		{Path: "./b.md", Scope: "user", PathID: "2"},
		{Path: "./b.md", Scope: "repo", PathID: "1"},
		{Path: "./a.md", Scope: "repo", PathID: "0"},
	}
	sortPaths(paths)
	if paths[0].Path != "./a.md" || paths[1].Scope != "repo" || paths[2].Scope != "user" {
		t.Fatalf("unexpected path order: %#v", paths)
	}

	tools := []Tool{
		{ToolID: "beta", Kind: "rules"},
		{ToolID: "alpha", Kind: "config"},
		{ToolID: "alpha", Kind: "rules"},
	}
	sortTools(tools)
	if tools[0].ToolID != "alpha" || tools[0].Kind != "config" {
		t.Fatalf("unexpected tool order: %#v", tools)
	}
	if tools[2].ToolID != "beta" {
		t.Fatalf("unexpected tool order: %#v", tools)
	}
}

func TestNormalizeIssuesNil(t *testing.T) {
	engine := NewEngine(nil)
	issues := engine.NormalizeIssues(nil)
	if issues == nil || len(issues) != 0 {
		t.Fatalf("expected empty issue slice")
	}
}
