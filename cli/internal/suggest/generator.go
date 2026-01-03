package suggest

import (
	"bytes"
	"embed"
	"sort"
	"strings"
	"text/template"

	scanhash "markdowntown-cli/internal/hash"
)

//go:embed templates/codex.md
var codexTemplateFS embed.FS

// Suggestion represents a Codex-focused suggestion with evidence.
type Suggestion struct {
	ID      string   `json:"id"`
	ClaimID string   `json:"claimId"`
	Client  string   `json:"client"`
	Text    string   `json:"text"`
	Sources []string `json:"sources"`
	Proof   Proof    `json:"proof"`
}

// Omission records why a claim was not suggested.
type Omission struct {
	ClaimID string `json:"claimId"`
	Reason  string `json:"reason"`
}

// SuggestionReport captures suggestions and audit metadata.
type SuggestionReport struct {
	Suggestions []Suggestion `json:"suggestions"`
	Conflicts   []Conflict   `json:"conflicts"`
	Omissions   []Omission   `json:"omissions"`
}

// GenerateSuggestions builds Codex suggestions from validated claims.
func GenerateSuggestions(claims []Claim, sources map[string]Source) SuggestionReport {
	updated, conflicts := DetectConflicts(claims)

	var suggestions []Suggestion
	var omissions []Omission

	for _, claim := range updated {
		reason := omissionReason(claim, sources)
		if reason != "" {
			omissions = append(omissions, Omission{ClaimID: claim.ID, Reason: reason})
			continue
		}
		suggestions = append(suggestions, Suggestion{
			ID:      suggestionID(claim),
			ClaimID: claim.ID,
			Client:  claim.Client,
			Text:    claim.Text,
			Sources: uniqueSorted(claim.Proof.Sources),
			Proof:   claim.Proof,
		})
	}

	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].ID < suggestions[j].ID
	})
	if len(omissions) > 0 {
		sort.Slice(omissions, func(i, j int) bool {
			if omissions[i].ClaimID == omissions[j].ClaimID {
				return omissions[i].Reason < omissions[j].Reason
			}
			return omissions[i].ClaimID < omissions[j].ClaimID
		})
	}

	return SuggestionReport{Suggestions: suggestions, Conflicts: conflicts, Omissions: omissions}
}

// RenderCodexSuggestions applies the Codex markdown template to a report.
func RenderCodexSuggestions(report SuggestionReport) (string, error) {
	data, err := codexTemplateFS.ReadFile("templates/codex.md")
	if err != nil {
		return "", err
	}
	tmpl, err := template.New("codex").Funcs(template.FuncMap{
		"join": strings.Join,
	}).Parse(string(data))
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, report); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func omissionReason(claim Claim, sources map[string]Source) string {
	if len(claim.Proof.ConflictsWith) > 0 {
		return "conflict"
	}
	if claim.SourceID == "" {
		return "missing-source"
	}
	source, ok := sources[claim.SourceID]
	if !ok {
		return "missing-source"
	}
	if !tierAllowsSuggestions(source.Tier) {
		return "insufficient-evidence"
	}
	if len(claim.Proof.Sources) == 0 || len(claim.Proof.SnapshotIDs) == 0 {
		return "missing-proof"
	}
	return ""
}

func tierAllowsSuggestions(tier string) bool {
	switch strings.ToLower(strings.TrimSpace(tier)) {
	case "tier-0", "tier-1":
		return true
	default:
		return false
	}
}

func suggestionID(claim Claim) string {
	return "suggest:sha256:" + scanhash.SumHex([]byte(claim.ID))
}

func uniqueSorted(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	var out []string
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}
