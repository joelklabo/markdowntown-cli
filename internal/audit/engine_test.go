package audit

import (
	"testing"
	"time"

	"markdowntown-cli/internal/scan"
)

type staticRule struct {
	id     string
	issues []Issue
}

func (r staticRule) ID() string {
	return r.id
}

func (r staticRule) Apply(ctx Context) ([]Issue, error) {
	return append([]Issue(nil), r.issues...), nil
}

func TestEngineEmptyInput(t *testing.T) {
	fixed := time.Unix(1, 0)
	engine := Engine{Now: func() time.Time { return fixed }}
	out, err := engine.Run(scan.Output{
		SchemaVersion:   "1.0",
		RegistryVersion: "1.0",
		ToolVersion:     "0.1.0",
		ScanStartedAt:   10,
		GeneratedAt:     20,
		RepoRoot:        "/repo",
		Scans: []scan.Root{
			{Root: "/repo"},
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(out.Issues) != 0 {
		t.Fatalf("expected zero issues, got %d", len(out.Issues))
	}
	if out.SchemaVersion != SchemaVersion {
		t.Fatalf("expected schema %q, got %q", SchemaVersion, out.SchemaVersion)
	}
	if out.Summary.Total != 0 || out.Summary.Error != 0 || out.Summary.Warn != 0 || out.Summary.Info != 0 {
		t.Fatalf("unexpected summary: %+v", out.Summary)
	}
	if out.Input.RepoRoot != "/repo" {
		t.Fatalf("expected repo root, got %q", out.Input.RepoRoot)
	}
	if out.AuditStartedAt != fixed.UnixMilli() || out.GeneratedAt != fixed.UnixMilli() {
		t.Fatalf("unexpected timestamps: %d %d", out.AuditStartedAt, out.GeneratedAt)
	}
}

func TestEngineOrdering(t *testing.T) {
	engine := Engine{
		Rules: []Rule{
			staticRule{
				id: "B",
				issues: []Issue{
					{
						RuleID:   "B",
						Severity: SeverityWarn,
						Title:    "warn",
						Paths:    []string{"b"},
						Tools:    []string{"tool-b"},
					},
				},
			},
			staticRule{
				id: "A",
				issues: []Issue{
					{
						RuleID:   "A",
						Severity: SeverityError,
						Title:    "error-1",
						Paths:    []string{"z", "a"},
						Tools:    []string{"tool-b", "tool-a"},
					},
					{
						RuleID:   "A",
						Severity: SeverityError,
						Title:    "error-2",
						Paths:    []string{"b"},
						Tools:    []string{"tool-c"},
					},
					{
						RuleID:   "A",
						Severity: SeverityInfo,
						Title:    "info",
						Paths:    nil,
					},
				},
			},
		},
	}

	out, err := engine.Run(scan.Output{
		SchemaVersion:   "1.0",
		RegistryVersion: "1.0",
		ToolVersion:     "0.1.0",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Issues) != 4 {
		t.Fatalf("expected 4 issues, got %d", len(out.Issues))
	}
	if out.Issues[0].Severity != SeverityError || out.Issues[0].RuleID != "A" || out.Issues[0].Paths[0] != "a" {
		t.Fatalf("unexpected first issue: %+v", out.Issues[0])
	}
	if out.Issues[1].Severity != SeverityError || out.Issues[1].Paths[0] != "b" {
		t.Fatalf("unexpected second issue: %+v", out.Issues[1])
	}
	if out.Issues[2].Severity != SeverityWarn || out.Issues[2].RuleID != "B" {
		t.Fatalf("unexpected third issue: %+v", out.Issues[2])
	}
	if out.Issues[3].Severity != SeverityInfo || out.Issues[3].RuleID != "A" {
		t.Fatalf("unexpected fourth issue: %+v", out.Issues[3])
	}
	if out.Summary.Total != 4 || out.Summary.Error != 2 || out.Summary.Warn != 1 || out.Summary.Info != 1 {
		t.Fatalf("unexpected summary: %+v", out.Summary)
	}
}

func TestEngineMissingRegistry(t *testing.T) {
	engine := Engine{}
	_, err := engine.Run(scan.Output{SchemaVersion: "1.0", ToolVersion: "0.1.0"})
	if err == nil {
		t.Fatalf("expected error for missing registry version")
	}
}
