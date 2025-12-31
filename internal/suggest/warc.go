package suggest

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
	"strings"
	"time"

	scanhash "markdowntown-cli/internal/hash"
)

// WARCRecord describes a single WARC entry.
type WARCRecord struct {
	Type        string
	TargetURI   string
	Date        time.Time
	RecordID    string
	ContentType string
	Payload     []byte
}

// RecordInfo captures metadata about a written record.
type RecordInfo struct {
	RecordID  string
	Offset    int64
	Length    int64
	TargetURI string
	Type      string
	Date      time.Time
}

// WARCWriter writes WARC 1.1 records.
type WARCWriter struct {
	w      io.Writer
	offset int64
}

// NewWARCWriter returns a writer that tracks record offsets.
func NewWARCWriter(w io.Writer) *WARCWriter {
	return &WARCWriter{w: w}
}

// WriteRecord writes a WARC record and returns its metadata.
func (w *WARCWriter) WriteRecord(record WARCRecord) (RecordInfo, error) {
	if record.Type == "" {
		return RecordInfo{}, fmt.Errorf("record type required")
	}
	if record.RecordID == "" {
		record.RecordID = newRecordID()
	}
	if record.Date.IsZero() {
		record.Date = time.Now().UTC()
	}
	if record.ContentType == "" {
		record.ContentType = "application/octet-stream"
	}

	headers := []string{
		"WARC/1.1",
		fmt.Sprintf("WARC-Type: %s", record.Type),
		fmt.Sprintf("WARC-Target-URI: %s", record.TargetURI),
		fmt.Sprintf("WARC-Date: %s", record.Date.Format(time.RFC3339)),
		fmt.Sprintf("WARC-Record-ID: %s", record.RecordID),
		fmt.Sprintf("Content-Type: %s", record.ContentType),
		fmt.Sprintf("Content-Length: %d", len(record.Payload)),
	}

	buffer := bytes.NewBufferString(strings.Join(headers, "\r\n"))
	buffer.WriteString("\r\n\r\n")
	buffer.Write(record.Payload)
	buffer.WriteString("\r\n\r\n")

	start := w.offset
	if err := w.writeAll(buffer.Bytes()); err != nil {
		return RecordInfo{}, err
	}

	return RecordInfo{
		RecordID:  record.RecordID,
		Offset:    start,
		Length:    w.offset - start,
		TargetURI: record.TargetURI,
		Type:      record.Type,
		Date:      record.Date,
	}, nil
}

// WriteResponse writes a response record with the provided HTTP payload.
func (w *WARCWriter) WriteResponse(targetURL string, payload []byte) (RecordInfo, error) {
	return w.WriteRecord(WARCRecord{
		Type:        "response",
		TargetURI:   targetURL,
		ContentType: "application/http; msgtype=response",
		Payload:     payload,
	})
}

// WriteMetadata writes a metadata record payload.
func (w *WARCWriter) WriteMetadata(targetURL string, payload []byte) (RecordInfo, error) {
	return w.WriteRecord(WARCRecord{
		Type:        "metadata",
		TargetURI:   targetURL,
		ContentType: "application/json",
		Payload:     payload,
	})
}

// SnapshotIndexEntry records snapshot metadata for audit.
type SnapshotIndexEntry struct {
	ID        string `json:"id"`
	URL       string `json:"url"`
	FetchedAt int64  `json:"fetchedAt"`
	Hash      string `json:"hash"`
	Offset    int64  `json:"offset"`
	Length    int64  `json:"length"`
	RecordID  string `json:"recordId"`
}

// NewSnapshotIndexEntry builds an index entry from a response payload.
func NewSnapshotIndexEntry(url string, fetchedAt time.Time, payload []byte, info RecordInfo) SnapshotIndexEntry {
	hash := scanhash.SumHex(payload)
	return SnapshotIndexEntry{
		ID:        "sha256:" + hash,
		URL:       url,
		FetchedAt: fetchedAt.UnixMilli(),
		Hash:      hash,
		Offset:    info.Offset,
		Length:    info.Length,
		RecordID:  info.RecordID,
	}
}

func (w *WARCWriter) writeAll(data []byte) error {
	for len(data) > 0 {
		n, err := w.w.Write(data)
		w.offset += int64(n)
		if err != nil {
			return err
		}
		if n == 0 {
			return io.ErrShortWrite
		}
		data = data[n:]
	}
	return nil
}

func newRecordID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "<urn:uuid:00000000-0000-0000-0000-000000000000>"
	}
	buf[6] = (buf[6] & 0x0f) | 0x40
	buf[8] = (buf[8] & 0x3f) | 0x80
	hex := fmt.Sprintf("%x", buf)
	return fmt.Sprintf("<urn:uuid:%s-%s-%s-%s-%s>",
		hex[0:8],
		hex[8:12],
		hex[12:16],
		hex[16:20],
		hex[20:32],
	)
}
