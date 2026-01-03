package suggest

import (
	"regexp"
	"strings"

	scanhash "markdowntown-cli/internal/hash"
)

// NormativeStrength captures MUST/SHOULD/MAY levels.
type NormativeStrength string

const (
	// StrengthMust indicates a mandatory requirement.
	StrengthMust NormativeStrength = "MUST"
	// StrengthShould indicates a recommended requirement.
	StrengthShould NormativeStrength = "SHOULD"
	// StrengthMay indicates an optional requirement.
	StrengthMay NormativeStrength = "MAY"
	// StrengthInfo indicates an informational statement.
	StrengthInfo NormativeStrength = "INFO"
)

// ProofSpan references a span within a normalized section.
type ProofSpan struct {
	SectionID string `json:"sectionId"`
	Start     int    `json:"start"`
	End       int    `json:"end"`
}

// Proof captures evidence metadata for a claim.
type Proof struct {
	Sources           []string          `json:"sources"`
	SnapshotIDs       []string          `json:"snapshotIds"`
	Spans             []ProofSpan       `json:"spans"`
	NormativeStrength NormativeStrength `json:"normativeStrength"`
	ConflictsWith     []string          `json:"conflictsWith,omitempty"`
}

// Claim represents a normalized, source-backed instruction.
type Claim struct {
	ID         string            `json:"id"`
	SourceID   string            `json:"sourceId"`
	SourceURL  string            `json:"sourceUrl"`
	Client     string            `json:"client"`
	SnapshotID string            `json:"snapshotId"`
	SectionID  string            `json:"sectionId"`
	Text       string            `json:"text"`
	Strength   NormativeStrength `json:"strength"`
	Proof      Proof             `json:"proof"`
}

var normativeRE = regexp.MustCompile(`(?i)\b(must|should|may)\b`)

// ExtractClaims scans a normalized document for explicit normative statements.
func ExtractClaims(doc NormalizedDocument, source Source, snapshotID string) []Claim {
	var claims []Claim
	for _, section := range doc.Sections {
		content := strings.TrimSpace(section.Content)
		if content == "" {
			continue
		}
		lines := strings.Split(section.Content, "\n")
		offset := 0
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed == "" {
				offset += len(line) + 1
				continue
			}
			strength, ok := strengthFromLine(trimmed)
			if !ok {
				offset += len(line) + 1
				continue
			}
			leading := len(line) - len(strings.TrimLeft(line, " \t"))
			start := offset + leading
			end := start + len(trimmed)
			normalized := normalizeClaimText(trimmed)
			claimID := newClaimID(source.ID, snapshotID, section.ID, normalized, strength)
			claims = append(claims, Claim{
				ID:         claimID,
				SourceID:   source.ID,
				SourceURL:  source.URL,
				Client:     source.Client,
				SnapshotID: snapshotID,
				SectionID:  section.ID,
				Text:       trimmed,
				Strength:   strength,
				Proof: Proof{
					Sources:           []string{source.URL},
					SnapshotIDs:       []string{snapshotID},
					Spans:             []ProofSpan{{SectionID: section.ID, Start: start, End: end}},
					NormativeStrength: strength,
				},
			})
			offset += len(line) + 1
		}
	}
	return claims
}

func strengthFromLine(line string) (NormativeStrength, bool) {
	match := normativeRE.FindStringSubmatch(line)
	if match == nil {
		return StrengthInfo, false
	}
	switch strings.ToLower(match[1]) {
	case "must":
		return StrengthMust, true
	case "should":
		return StrengthShould, true
	case "may":
		return StrengthMay, true
	default:
		return StrengthInfo, false
	}
}

func normalizeClaimText(text string) string {
	parts := strings.Fields(text)
	return strings.Join(parts, " ")
}

func newClaimID(sourceID, snapshotID, sectionID, text string, strength NormativeStrength) string {
	base := strings.Join([]string{sourceID, snapshotID, sectionID, string(strength), text}, "|")
	return "claim:sha256:" + scanhash.SumHex([]byte(base))
}
