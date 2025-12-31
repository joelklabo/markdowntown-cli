package suggest

// ProvenanceRecord links a suggestion to a snapshot.
type ProvenanceRecord struct {
	SuggestionID string `json:"suggestionId"`
	SnapshotID   string `json:"snapshotId"`
	SourceURL    string `json:"sourceUrl"`
}

// ProvenanceStore captures provenance links for audit output.
type ProvenanceStore struct {
	Version string             `json:"version"`
	Records []ProvenanceRecord `json:"records"`
}

// NewProvenanceRecord constructs a provenance link.
func NewProvenanceRecord(suggestionID, snapshotID, sourceURL string) ProvenanceRecord {
	return ProvenanceRecord{
		SuggestionID: suggestionID,
		SnapshotID:   snapshotID,
		SourceURL:    sourceURL,
	}
}
