package suggest

import "testing"

func TestNewProvenanceRecord(t *testing.T) {
	record := NewProvenanceRecord("s1", "sha256:abc", "https://example.com")
	if record.SuggestionID != "s1" || record.SnapshotID != "sha256:abc" || record.SourceURL != "https://example.com" {
		t.Fatalf("unexpected record: %#v", record)
	}
}
