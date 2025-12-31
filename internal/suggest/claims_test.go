package suggest

import "testing"

func TestClaimsExtract(t *testing.T) {
	doc := NormalizedDocument{
		Sections: []Section{{
			ID:      "intro",
			Heading: "Intro",
			Level:   1,
			Content: "You MUST use pnpm.\nYou should keep docs short.\nMay ignore optional rules.\nNothing here.",
		}},
	}
	source := Source{ID: "codex-docs", Client: "codex", URL: "https://example.com"}
	snapshotID := "sha256:abc123"

	claims := ExtractClaims(doc, source, snapshotID)
	if len(claims) != 3 {
		t.Fatalf("expected 3 claims, got %d", len(claims))
	}

	if claims[0].Strength != StrengthMust {
		t.Fatalf("expected first claim MUST, got %s", claims[0].Strength)
	}
	if claims[1].Strength != StrengthShould {
		t.Fatalf("expected second claim SHOULD, got %s", claims[1].Strength)
	}
	if claims[2].Strength != StrengthMay {
		t.Fatalf("expected third claim MAY, got %s", claims[2].Strength)
	}

	span := claims[0].Proof.Spans[0]
	if span.Start != 0 {
		t.Fatalf("expected span start 0, got %d", span.Start)
	}
	expectedEnd := len("You MUST use pnpm.")
	if span.End != expectedEnd {
		t.Fatalf("expected span end %d, got %d", expectedEnd, span.End)
	}

	if claims[0].Proof.Sources[0] != source.URL {
		t.Fatalf("expected source URL %s, got %s", source.URL, claims[0].Proof.Sources[0])
	}
	if claims[0].Proof.SnapshotIDs[0] != snapshotID {
		t.Fatalf("expected snapshot %s, got %s", snapshotID, claims[0].Proof.SnapshotIDs[0])
	}

	repeat := ExtractClaims(doc, source, snapshotID)
	if claims[0].ID != repeat[0].ID {
		t.Fatalf("expected deterministic claim IDs")
	}
}

func TestClaimsConflicts(t *testing.T) {
	claims := []Claim{
		{
			ID:       "c1",
			Client:   "codex",
			Text:     "You MUST use pnpm.",
			Strength: StrengthMust,
			Proof:    Proof{NormativeStrength: StrengthMust},
		},
		{
			ID:       "c2",
			Client:   "codex",
			Text:     "You MUST use yarn.",
			Strength: StrengthMust,
			Proof:    Proof{NormativeStrength: StrengthMust},
		},
		{
			ID:       "c3",
			Client:   "claude",
			Text:     "You MUST use pnpm.",
			Strength: StrengthMust,
			Proof:    Proof{NormativeStrength: StrengthMust},
		},
		{
			ID:       "c4",
			Client:   "codex",
			Text:     "Enable linting.",
			Strength: StrengthMust,
			Proof:    Proof{NormativeStrength: StrengthMust},
		},
	}

	updated, conflicts := DetectConflicts(claims)
	if len(conflicts) != 1 {
		t.Fatalf("expected 1 conflict, got %d", len(conflicts))
	}

	conflict := conflicts[0]
	if len(conflict.ClaimIDs) != 2 || conflict.ClaimIDs[0] != "c1" || conflict.ClaimIDs[1] != "c2" {
		t.Fatalf("unexpected conflict claim IDs: %v", conflict.ClaimIDs)
	}

	if !contains(updated[0].Proof.ConflictsWith, conflict.ID) {
		t.Fatalf("expected claim c1 to record conflict")
	}
	if !contains(updated[1].Proof.ConflictsWith, conflict.ID) {
		t.Fatalf("expected claim c2 to record conflict")
	}
	if contains(updated[2].Proof.ConflictsWith, conflict.ID) {
		t.Fatalf("did not expect claude claim to conflict with codex")
	}
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
