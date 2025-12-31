package suggest

import (
	"bytes"
	"fmt"
	"strings"
	"testing"
	"time"

	scanhash "markdowntown-cli/internal/hash"
)

func TestWARCWriter(t *testing.T) {
	buf := &bytes.Buffer{}
	writer := NewWARCWriter(buf)

	payload := []byte("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nhello")
	info, err := writer.WriteResponse("https://example.com/docs", payload)
	if err != nil {
		t.Fatalf("write response: %v", err)
	}

	output := buf.String()
	if !strings.Contains(output, "WARC/1.1") {
		t.Fatalf("missing WARC header")
	}
	if !strings.Contains(output, "WARC-Type: response") {
		t.Fatalf("missing response type")
	}
	expectedLength := fmt.Sprintf("Content-Length: %d", len(payload))
	if !strings.Contains(output, expectedLength) {
		t.Fatalf("expected content length header")
	}
	if info.RecordID == "" {
		t.Fatalf("expected record id")
	}
	if info.Offset != 0 {
		t.Fatalf("expected offset 0, got %d", info.Offset)
	}
	if info.Length == 0 {
		t.Fatalf("expected non-zero length")
	}
}

func TestWARCIndex(t *testing.T) {
	payload := []byte("content")
	info := RecordInfo{RecordID: "rec-1", Offset: 10, Length: 42}
	entry := NewSnapshotIndexEntry("https://example.com", time.Unix(5, 0), payload, info)

	expectedHash := scanhash.SumHex(payload)
	if entry.Hash != expectedHash {
		t.Fatalf("expected hash %s, got %s", expectedHash, entry.Hash)
	}
	if entry.ID != "sha256:"+expectedHash {
		t.Fatalf("unexpected snapshot id: %s", entry.ID)
	}
	if entry.RecordID != info.RecordID {
		t.Fatalf("expected record id %s", info.RecordID)
	}
}
