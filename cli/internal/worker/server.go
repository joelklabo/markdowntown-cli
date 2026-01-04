package worker

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"markdowntown-cli/internal/scan"
)

const (
	defaultTimeout   = 30 * time.Second
	defaultMaxBodyMB = 8
)

type workerError struct {
	code    string
	message string
	status  int
	details any
}

func (e *workerError) Error() string {
	return e.message
}

func newWorkerError(code, message string, status int, details any) *workerError {
	return &workerError{code: code, message: message, status: status, details: details}
}

// Config configures the worker server.
type Config struct {
	Registry     scan.Registry
	Timeout      time.Duration
	MaxBodyBytes int64
	Logger       *log.Logger
}

// Server handles worker requests.
type Server struct {
	registry     scan.Registry
	timeout      time.Duration
	maxBodyBytes int64
	logger       *log.Logger
}

// NewServer creates a worker server with defaults.
func NewServer(cfg Config) *Server {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = defaultTimeout
	}
	maxBody := cfg.MaxBodyBytes
	if maxBody <= 0 {
		maxBody = int64(defaultMaxBodyMB) * 1024 * 1024
	}
	logger := cfg.Logger
	if logger == nil {
		logger = log.New(log.Writer(), "engine-worker: ", log.LstdFlags)
	}
	return &Server{
		registry:     cfg.Registry,
		timeout:      timeout,
		maxBodyBytes: maxBody,
		logger:       logger,
	}
}

// HandleRun executes audit or suggest runs.
func (s *Server) HandleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, newWorkerError(ErrCodeUnsupported, "method not allowed", http.StatusMethodNotAllowed, nil), "")
		return
	}

	req, err := s.decodeRequest(w, r)
	if err != nil {
		writeError(w, err, "")
		return
	}

	ctx, cancel := s.requestContext(r.Context(), req.TimeoutMs)
	defer cancel()

	started := time.Now()
	resp, err := s.run(ctx, req)
	if err != nil {
		writeError(w, err, req.ID)
		return
	}

	resp.ID = req.ID
	resp.Type = req.Type
	resp.DurationMs = time.Since(started).Milliseconds()
	resp.Ok = true

	writeJSON(w, http.StatusOK, resp)
}

// HandleHealth reports basic readiness.
func (s *Server) HandleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) decodeRequest(w http.ResponseWriter, r *http.Request) (RunRequest, *workerError) {
	var req RunRequest
	reader := http.MaxBytesReader(w, r.Body, s.maxBodyBytes)
	defer func() {
		_ = r.Body.Close()
	}()

	dec := json.NewDecoder(reader)
	if err := dec.Decode(&req); err != nil {
		return RunRequest{}, newWorkerError(ErrCodeInvalidRequest, "invalid JSON body", http.StatusBadRequest, err.Error())
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return RunRequest{}, newWorkerError(ErrCodeInvalidRequest, "unexpected trailing JSON", http.StatusBadRequest, nil)
	}
	if req.Type == "" {
		return RunRequest{}, newWorkerError(ErrCodeInvalidRequest, "type is required", http.StatusBadRequest, nil)
	}
	return req, nil
}

func (s *Server) requestContext(ctx context.Context, timeoutMs int64) (context.Context, context.CancelFunc) {
	timeout := s.timeout
	if timeoutMs > 0 {
		reqTimeout := time.Duration(timeoutMs) * time.Millisecond
		if reqTimeout < timeout {
			timeout = reqTimeout
		}
	}
	return context.WithTimeout(ctx, timeout)
}

func (s *Server) run(ctx context.Context, req RunRequest) (RunResponse, *workerError) {
	switch req.Type {
	case RunTypeAudit:
		if req.Audit == nil {
			return RunResponse{}, newWorkerError(ErrCodeInvalidRequest, "audit payload is required", http.StatusBadRequest, nil)
		}
		output, err := s.runAudit(ctx, *req.Audit)
		if err != nil {
			return RunResponse{}, err
		}
		return RunResponse{Audit: &output}, nil
	case RunTypeSuggest:
		if req.Suggest == nil {
			return RunResponse{}, newWorkerError(ErrCodeInvalidRequest, "suggest payload is required", http.StatusBadRequest, nil)
		}
		report, err := s.runSuggest(ctx, *req.Suggest)
		if err != nil {
			return RunResponse{}, err
		}
		return RunResponse{Suggest: &report}, nil
	default:
		return RunResponse{}, newWorkerError(ErrCodeUnsupported, "unsupported run type", http.StatusBadRequest, req.Type)
	}
}

func writeError(w http.ResponseWriter, err *workerError, requestID string) {
	if err == nil {
		return
	}
	status := err.status
	if status == 0 {
		status = http.StatusInternalServerError
	}
	payload := RunResponse{
		ID:    requestID,
		Ok:    false,
		Error: &Error{Code: err.code, Message: err.message, Details: err.details},
	}
	writeJSON(w, status, payload)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(payload); err != nil {
		if !errors.Is(err, context.Canceled) {
			log.Printf("failed to write response: %v", err)
		}
	}
}
