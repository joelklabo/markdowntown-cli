package suggest

import "markdowntown-cli/internal/instructions"

// SuggestReport captures suggest/audit output.
type SuggestReport struct {
	Client      instructions.Client `json:"client"`
	GeneratedAt int64               `json:"generatedAt"`
	Suggestions []Suggestion        `json:"suggestions,omitempty"`
	Conflicts   []Conflict          `json:"conflicts,omitempty"`
	Omissions   []Omission          `json:"omissions,omitempty"`
	Warnings    []string            `json:"warnings,omitempty"`
}

// ResolveReport captures resolve output.
type ResolveReport struct {
	Client      instructions.Client     `json:"client"`
	GeneratedAt int64                   `json:"generatedAt"`
	Resolution  instructions.Resolution `json:"resolution"`
}
