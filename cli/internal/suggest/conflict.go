package suggest

import (
	"sort"
	"strings"
	"unicode"

	scanhash "markdowntown-cli/internal/hash"
)

// Conflict captures overlapping claims that cannot be reconciled.
type Conflict struct {
	ID       string   `json:"id"`
	Client   string   `json:"client"`
	ClaimIDs []string `json:"claimIds"`
	Reason   string   `json:"reason"`
	Tokens   []string `json:"tokens,omitempty"`
}

var stopwords = map[string]struct{}{
	"a": {}, "an": {}, "and": {}, "are": {}, "as": {}, "at": {}, "be": {},
	"by": {}, "can": {}, "could": {}, "for": {}, "from": {}, "in": {},
	"is": {}, "it": {}, "may": {}, "might": {}, "must": {}, "no": {},
	"not": {}, "of": {}, "on": {}, "or": {}, "our": {}, "should": {},
	"shall": {}, "that": {}, "the": {}, "their": {}, "these": {}, "this": {},
	"those": {}, "to": {}, "we": {}, "will": {}, "with": {}, "would": {},
	"you": {}, "your": {},
}

// DetectConflicts compares claims within the same client scope and annotates conflicts.
func DetectConflicts(input []Claim) ([]Claim, []Conflict) {
	claims := append([]Claim(nil), input...)
	tokenSets := make([]map[string]struct{}, len(claims))
	for i, claim := range claims {
		tokenSets[i] = tokenSet(claimTokens(claim.Text))
	}

	seen := make(map[string]struct{})
	var conflicts []Conflict

	for i := 0; i < len(claims); i++ {
		for j := i + 1; j < len(claims); j++ {
			if claims[i].Client == "" || claims[j].Client == "" {
				continue
			}
			if claims[i].Client != claims[j].Client {
				continue
			}
			if claims[i].Text == claims[j].Text && claims[i].Strength == claims[j].Strength {
				continue
			}
			intersection := intersectTokens(tokenSets[i], tokenSets[j])
			if len(intersection) == 0 {
				continue
			}

			claimIDs := []string{claims[i].ID, claims[j].ID}
			sort.Strings(claimIDs)
			key := claims[i].Client + "|" + strings.Join(claimIDs, "|")
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}

			conflictID := newConflictID(claims[i].Client, claimIDs)
			conflicts = append(conflicts, Conflict{
				ID:       conflictID,
				Client:   claims[i].Client,
				ClaimIDs: claimIDs,
				Reason:   "overlapping tokens in same client scope",
				Tokens:   intersection,
			})

			claims[i].Proof.ConflictsWith = appendUnique(claims[i].Proof.ConflictsWith, conflictID)
			claims[j].Proof.ConflictsWith = appendUnique(claims[j].Proof.ConflictsWith, conflictID)
		}
	}

	sort.Slice(conflicts, func(i, j int) bool {
		return conflicts[i].ID < conflicts[j].ID
	})

	return claims, conflicts
}

func claimTokens(text string) []string {
	lower := strings.ToLower(text)
	parts := strings.FieldsFunc(lower, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})

	seen := make(map[string]struct{})
	var tokens []string
	for _, part := range parts {
		if part == "" {
			continue
		}
		if len(part) < 2 {
			continue
		}
		if _, drop := stopwords[part]; drop {
			continue
		}
		if _, exists := seen[part]; exists {
			continue
		}
		seen[part] = struct{}{}
		tokens = append(tokens, part)
	}

	sort.Strings(tokens)
	return tokens
}

func tokenSet(tokens []string) map[string]struct{} {
	set := make(map[string]struct{}, len(tokens))
	for _, token := range tokens {
		set[token] = struct{}{}
	}
	return set
}

func intersectTokens(a, b map[string]struct{}) []string {
	var intersection []string
	for token := range a {
		if _, ok := b[token]; ok {
			intersection = append(intersection, token)
		}
	}
	sort.Strings(intersection)
	return intersection
}

func newConflictID(client string, claimIDs []string) string {
	payload := client + "|" + strings.Join(claimIDs, "|")
	return "conflict:sha256:" + scanhash.SumHex([]byte(payload))
}

func appendUnique(items []string, value string) []string {
	for _, item := range items {
		if item == value {
			return items
		}
	}
	return append(items, value)
}
