package sync

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// maxUploadRetries matches the retry count passed to uploadBlobWithRetry.
// Total attempts = maxUploadRetries + 1 (initial + retries).
const maxUploadRetries = 3

func TestClientRetriesOnTransientErrors(t *testing.T) {
	var attempts int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		count := atomic.AddInt32(&attempts, 1)
		if count < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"status":"ok"}`)
	}))
	defer server.Close()

	client, _ := NewClient(server.URL, "token", "Bearer", server.Client())
	ctx := context.Background()

	err := client.UploadBlob(ctx, "/test", UploadBlobRequest{})
	if err != nil {
		t.Fatalf("expected success after retries, got %v", err)
	}

	if atomic.LoadInt32(&attempts) != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
}

func TestClientRetriesOnRateLimitWithRetryAfter(t *testing.T) {
	var attempts int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		count := atomic.AddInt32(&attempts, 1)
		if count == 1 {
			w.Header().Set("Retry-After", "1") // 1 second
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"status":"ok"}`)
	}))
	defer server.Close()

	client, _ := NewClient(server.URL, "token", "Bearer", server.Client())
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	start := time.Now()
	err := client.UploadBlob(ctx, "/test", UploadBlobRequest{})
	elapsed := time.Since(start)

	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}

	if atomic.LoadInt32(&attempts) != 2 {
		t.Errorf("expected 2 attempts, got %d", attempts)
	}

	if elapsed < 1*time.Second {
		t.Errorf("expected to wait at least 1 second due to Retry-After, took %v", elapsed)
	}
}

func TestClientRetriesExhausted(t *testing.T) {
	var attempts int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&attempts, 1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	client, _ := NewClient(server.URL, "token", "Bearer", server.Client())
	ctx := context.Background()

	err := client.UploadBlob(ctx, "/test", UploadBlobRequest{})
	if err == nil {
		t.Fatal("expected error after exhausted retries")
	}

	// Total attempts = maxUploadRetries + 1 (initial attempt + retries)
	if atomic.LoadInt32(&attempts) != maxUploadRetries+1 {
		t.Errorf("expected %d attempts, got %d", maxUploadRetries+1, attempts)
	}
}

func TestClientAuthError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = fmt.Fprint(w, `{"error":"invalid token"}`)
	}))
	defer server.Close()

	client, _ := NewClient(server.URL, "token", "Bearer", server.Client())
	ctx := context.Background()

	err := client.UploadBlob(ctx, "/test", UploadBlobRequest{})
	if err == nil {
		t.Fatal("expected auth error")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}
	if apiErr.Status != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", apiErr.Status)
	}
	if !strings.Contains(err.Error(), "markdowntown login") {
		t.Error("expected error message to include login guidance")
	}
}
