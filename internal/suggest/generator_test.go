package suggest

import (
	"strings"
	"testing"
)

func TestGeneratorEvidenceGating(t *testing.T) {
	sources := map[string]Source{
		"s1": {ID: "s1", Tier: "tier-1", Client: "codex", URL: "https://tier1.example"},
		"s2": {ID: "s2", Tier: "tier-2", Client: "codex", URL: "https://tier2.example"},
	}
	claims := []Claim{
		{
			ID:       "c1",
			SourceID: "s1",
			Client:   "codex",
			Text:     "Enable caching.",
			Proof: Proof{
				Sources:           []string{"https://tier1.example"},
				SnapshotIDs:       []string{"sha256:one"},
				NormativeStrength: StrengthMust,
			},
		},
		{
			ID:       "c2",
			SourceID: "s2",
			Client:   "codex",
			Text:     "Document usage.",
			Proof: Proof{
				Sources:           []string{"https://tier2.example"},
				SnapshotIDs:       []string{"sha256:two"},
				NormativeStrength: StrengthMust,
			},
		},
		{
			ID:       "c3",
			SourceID: "s1",
			Client:   "codex",
			Text:     "Rotate keys.",
			Proof: Proof{
				Sources:           []string{"https://tier1.example"},
				NormativeStrength: StrengthMust,
			},
		},
	}

	report := GenerateSuggestions(claims, sources)
	if len(report.Suggestions) != 1 {
		t.Fatalf("expected 1 suggestion, got %d", len(report.Suggestions))
	}
	if report.Suggestions[0].Text != "Enable caching." {
		t.Fatalf("unexpected suggestion text: %s", report.Suggestions[0].Text)
	}
	if len(report.Omissions) != 2 {
		t.Fatalf("expected 2 omissions, got %d", len(report.Omissions))
	}

	omissionReasons := map[string]string{}
	for _, omission := range report.Omissions {
		omissionReasons[omission.ClaimID] = omission.Reason
	}
	if omissionReasons["c2"] != "insufficient-evidence" {
		t.Fatalf("expected c2 to be insufficient-evidence, got %s", omissionReasons["c2"])
	}
	if omissionReasons["c3"] != "missing-proof" {
		t.Fatalf("expected c3 to be missing-proof, got %s", omissionReasons["c3"])
	}
}

func TestGeneratorConflictOmission(t *testing.T) {
	sources := map[string]Source{
		"s1": {ID: "s1", Tier: "tier-1", Client: "codex", URL: "https://tier1.example"},
	}
	claims := []Claim{
		{
			ID:       "c1",
			SourceID: "s1",
			Client:   "codex",
			Text:     "You MUST use pnpm.",
			Proof: Proof{
				Sources:           []string{"https://tier1.example"},
				SnapshotIDs:       []string{"sha256:one"},
				NormativeStrength: StrengthMust,
			},
		},
		{
			ID:       "c2",
			SourceID: "s1",
			Client:   "codex",
			Text:     "You MUST use yarn.",
			Proof: Proof{
				Sources:           []string{"https://tier1.example"},
				SnapshotIDs:       []string{"sha256:two"},
				NormativeStrength: StrengthMust,
			},
		},
	}

	report := GenerateSuggestions(claims, sources)
	if len(report.Conflicts) != 1 {
		t.Fatalf("expected 1 conflict, got %d", len(report.Conflicts))
	}
	if len(report.Suggestions) != 0 {
		t.Fatalf("expected 0 suggestions, got %d", len(report.Suggestions))
	}
	if len(report.Omissions) != 2 {
		t.Fatalf("expected 2 omissions, got %d", len(report.Omissions))
	}
	for _, omission := range report.Omissions {
		if omission.Reason != "conflict" {
			t.Fatalf("expected conflict omission, got %s", omission.Reason)
		}
	}
}

func TestGeneratorRenderCodexSuggestions(t *testing.T) {
	report := SuggestionReport{
		Suggestions: []Suggestion{{
			ID:      "s1",
			ClaimID: "c1",
			Client:  "codex",
			Text:    "Enable caching.",
			Sources: []string{"https://tier1.example"},
		}},
	}

	output, err := RenderCodexSuggestions(report)
	if err != nil {
		t.Fatalf("unexpected render error: %v", err)
	}
	if !strings.Contains(output, "Enable caching.") || !strings.Contains(output, "https://tier1.example") {
		t.Fatalf("expected output to include suggestion text and sources")
	}
}
