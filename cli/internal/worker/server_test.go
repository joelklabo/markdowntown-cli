package worker

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"markdowntown-cli/internal/scan"
)

func TestNewServerDefaults(t *testing.T) {
	s := NewServer(Config{})

	if s.timeout != defaultTimeout {
		t.Errorf("expected default timeout %v, got %v", defaultTimeout, s.timeout)
	}

	expectedMaxBody := int64(defaultMaxBodyMB) * 1024 * 1024
	if s.maxBodyBytes != expectedMaxBody {
		t.Errorf("expected default maxBodyBytes %d, got %d", expectedMaxBody, s.maxBodyBytes)
	}

	if s.logger == nil {
		t.Error("expected default logger to be set")
	}
}

func TestNewServerCustomConfig(t *testing.T) {
	customTimeout := 10 * time.Second
	customMaxBody := int64(2 * 1024 * 1024)
	customLogger := log.New(&bytes.Buffer{}, "test: ", 0)

	s := NewServer(Config{
		Registry:     scan.Registry{Version: "test"},
		Timeout:      customTimeout,
		MaxBodyBytes: customMaxBody,
		Logger:       customLogger,
	})

	if s.timeout != customTimeout {
		t.Errorf("expected timeout %v, got %v", customTimeout, s.timeout)
	}

	if s.maxBodyBytes != customMaxBody {
		t.Errorf("expected maxBodyBytes %d, got %d", customMaxBody, s.maxBodyBytes)
	}

	if s.logger != customLogger {
		t.Error("expected custom logger to be used")
	}

	if s.registry.Version != "test" {
		t.Errorf("expected registry version 'test', got %q", s.registry.Version)
	}
}

func TestHandleHealthReturnsOk(t *testing.T) {
	s := NewServer(Config{})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	s.HandleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp["ok"] != true {
		t.Errorf("expected ok=true, got %v", resp["ok"])
	}
}

func TestHandleRunMethodNotAllowed(t *testing.T) {
	s := NewServer(Config{})

	req := httptest.NewRequest(http.MethodGet, "/run", nil)
	w := httptest.NewRecorder()

	s.HandleRun(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405, got %d", w.Code)
	}

	var resp RunResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Ok {
		t.Error("expected ok=false for method not allowed")
	}

	if resp.Error == nil {
		t.Fatal("expected error in response")
	}

	if resp.Error.Code != ErrCodeUnsupported {
		t.Errorf("expected error code %q, got %q", ErrCodeUnsupported, resp.Error.Code)
	}
}

func TestHandleRunInvalidJSON(t *testing.T) {
	s := NewServer(Config{})

	req := httptest.NewRequest(http.MethodPost, "/run", strings.NewReader("not json"))
	w := httptest.NewRecorder()

	s.HandleRun(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var resp RunResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Error == nil || resp.Error.Code != ErrCodeInvalidRequest {
		t.Errorf("expected error code %q", ErrCodeInvalidRequest)
	}
}

func TestHandleRunMissingType(t *testing.T) {
	s := NewServer(Config{})

	body := `{"id": "test-123"}`
	req := httptest.NewRequest(http.MethodPost, "/run", strings.NewReader(body))
	w := httptest.NewRecorder()

	s.HandleRun(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var resp RunResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Error == nil || resp.Error.Code != ErrCodeInvalidRequest {
		t.Errorf("expected error code %q", ErrCodeInvalidRequest)
	}

	if !strings.Contains(resp.Error.Message, "type is required") {
		t.Errorf("expected message to mention type required, got: %s", resp.Error.Message)
	}
}

func TestHandleRunTrailingJSON(t *testing.T) {
	s := NewServer(Config{})

	body := `{"type": "audit"}{"extra": "data"}`
	req := httptest.NewRequest(http.MethodPost, "/run", strings.NewReader(body))
	w := httptest.NewRecorder()

	s.HandleRun(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var resp RunResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Error == nil {
		t.Fatal("expected error for trailing JSON")
	}

	if !strings.Contains(resp.Error.Message, "trailing") {
		t.Errorf("expected message to mention trailing JSON, got: %s", resp.Error.Message)
	}
}

func TestHandleRunUnsupportedType(t *testing.T) {
	s := NewServer(Config{})

	body := `{"type": "unknown"}`
	req := httptest.NewRequest(http.MethodPost, "/run", strings.NewReader(body))
	w := httptest.NewRecorder()

	s.HandleRun(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var resp RunResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Error == nil || resp.Error.Code != ErrCodeUnsupported {
		t.Errorf("expected error code %q", ErrCodeUnsupported)
	}
}

func TestHandleRunAuditMissingPayload(t *testing.T) {
	s := NewServer(Config{})

	body := `{"type": "audit"}`
	req := httptest.NewRequest(http.MethodPost, "/run", strings.NewReader(body))
	w := httptest.NewRecorder()

	s.HandleRun(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var resp RunResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Error == nil {
		t.Fatal("expected error for missing audit payload")
	}

	if !strings.Contains(resp.Error.Message, "audit payload is required") {
		t.Errorf("expected message about audit payload, got: %s", resp.Error.Message)
	}
}

func TestHandleRunSuggestMissingPayload(t *testing.T) {
	s := NewServer(Config{})

	body := `{"type": "suggest"}`
	req := httptest.NewRequest(http.MethodPost, "/run", strings.NewReader(body))
	w := httptest.NewRecorder()

	s.HandleRun(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var resp RunResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Error == nil {
		t.Fatal("expected error for missing suggest payload")
	}

	if !strings.Contains(resp.Error.Message, "suggest payload is required") {
		t.Errorf("expected message about suggest payload, got: %s", resp.Error.Message)
	}
}
