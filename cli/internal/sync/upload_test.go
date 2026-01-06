package sync

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	syncpkg "sync"
	"testing"
	"time"
)

func TestUploadSnapshotUploadsMissingBlobs(t *testing.T) {
	repoRoot := t.TempDir()
	fileOne := filepath.Join(repoRoot, "alpha.txt")
	fileTwo := filepath.Join(repoRoot, "beta.txt")

	if err := os.WriteFile(fileOne, []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}
	if err := os.WriteFile(fileTwo, []byte("beta"), 0o600); err != nil {
		t.Fatalf("write beta: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	if len(manifest.Entries) != 2 {
		t.Fatalf("expected 2 manifest entries, got %d", len(manifest.Entries))
	}
	missingHash := manifest.Entries[0].BlobHash
	missingContent := "alpha"

	var (
		mu            syncpkg.Mutex
		handshakeReq  UploadHandshakeRequest
		blobRequests  []UploadBlobRequest
		finalizeCount int
		capturedAuth  string
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			_ = r.Body.Close()
		}()
		decoder := json.NewDecoder(r.Body)
		var req UploadHandshakeRequest
		if err := decoder.Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		mu.Lock()
		handshakeReq = req
		capturedAuth = r.Header.Get("Authorization")
		mu.Unlock()

		resp := UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{missingHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			_ = r.Body.Close()
		}()
		decoder := json.NewDecoder(r.Body)
		var req UploadBlobRequest
		if err := decoder.Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		mu.Lock()
		blobRequests = append(blobRequests, req)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(UploadBlobResponse{Status: "ok", BlobID: "blob-1"})
	})

	mux.HandleFunc("/api/cli/upload/complete", func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			_ = r.Body.Close()
		}()
		mu.Lock()
		finalizeCount++
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(FinalizeResponse{Status: "ready", SnapshotID: "snap-123"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	result, err := UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:          repoRoot,
		ProjectName:       "demo",
		Provider:          "local",
		UploadConcurrency: 1,
	})
	if err != nil {
		t.Fatalf("upload snapshot: %v", err)
	}

	if result.SnapshotID != "snap-123" {
		t.Fatalf("expected snapshot id snap-123, got %s", result.SnapshotID)
	}

	mu.Lock()
	defer mu.Unlock()

	if capturedAuth == "" {
		t.Fatalf("expected authorization header")
	}
	if handshakeReq.ProjectName != "demo" {
		t.Fatalf("expected project name demo, got %s", handshakeReq.ProjectName)
	}
	if len(handshakeReq.Manifest) != 2 {
		t.Fatalf("expected 2 manifest entries, got %d", len(handshakeReq.Manifest))
	}
	if len(blobRequests) != 1 {
		t.Fatalf("expected 1 blob upload, got %d", len(blobRequests))
	}
	if blobRequests[0].Sha256 != missingHash {
		t.Fatalf("expected blob hash %s, got %s", missingHash, blobRequests[0].Sha256)
	}
	decoded, err := base64.StdEncoding.DecodeString(blobRequests[0].ContentBase64)
	if err != nil {
		t.Fatalf("decode base64: %v", err)
	}
	if string(decoded) != missingContent {
		t.Fatalf("expected content %q, got %q", missingContent, string(decoded))
	}
	if finalizeCount != 1 {
		t.Fatalf("expected finalize to run once, got %d", finalizeCount)
	}
}

func TestUploadSnapshotSkipsWhenNoMissingBlobs(t *testing.T) {
	repoRoot := t.TempDir()
	fileOne := filepath.Join(repoRoot, "alpha.txt")

	if err := os.WriteFile(fileOne, []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	var (
		mu            syncpkg.Mutex
		blobRequests  []UploadBlobRequest
		finalizeCount int
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&UploadHandshakeRequest{})
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, r *http.Request) {
		var req UploadBlobRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		mu.Lock()
		blobRequests = append(blobRequests, req)
		mu.Unlock()
		_ = json.NewEncoder(w).Encode(UploadBlobResponse{Status: "ok", BlobID: "blob-1"})
	})

	mux.HandleFunc("/api/cli/upload/complete", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		finalizeCount++
		mu.Unlock()
		_ = json.NewEncoder(w).Encode(FinalizeResponse{Status: "ready", SnapshotID: "snap-123"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	result, err := UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:    repoRoot,
		ProjectName: "demo",
		Provider:    "local",
	})
	if err != nil {
		t.Fatalf("upload snapshot: %v", err)
	}
	if result.MissingBlobs != 0 {
		t.Fatalf("expected 0 missing blobs, got %d", result.MissingBlobs)
	}
	if result.UploadedBlobs != 0 {
		t.Fatalf("expected 0 uploaded blobs, got %d", result.UploadedBlobs)
	}

	mu.Lock()
	defer mu.Unlock()

	if len(blobRequests) != 0 {
		t.Fatalf("expected no blob uploads, got %d", len(blobRequests))
	}
	if finalizeCount != 1 {
		t.Fatalf("expected finalize to run once, got %d", finalizeCount)
	}
}

func TestUploadSnapshotMissingBlobInManifest(t *testing.T) {
	repoRoot := t.TempDir()
	fileOne := filepath.Join(repoRoot, "alpha.txt")

	if err := os.WriteFile(fileOne, []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&UploadHandshakeRequest{})
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{"deadbeef"},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	client, err := NewClient(server.URL, "token", "Bearer", server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	_, err = UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:          repoRoot,
		ProjectName:       "demo",
		Provider:          "local",
		UploadConcurrency: 1,
	})
	if err == nil || !strings.Contains(err.Error(), "missing manifest entry") {
		t.Fatalf("expected missing manifest entry error, got %v", err)
	}
}

func TestUploadRetries429WithExponentialBackoff(t *testing.T) {
	repoRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoRoot, "alpha.txt"), []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	missingHash := manifest.Entries[0].BlobHash

	var (
		mu           syncpkg.Mutex
		blobAttempts int
		timestamps   []time.Time
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{missingHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		blobAttempts++
		timestamps = append(timestamps, time.Now())
		attempt := blobAttempts
		mu.Unlock()

		if attempt < 3 {
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "rate limited"})
			return
		}
		_ = json.NewEncoder(w).Encode(UploadBlobResponse{Status: "ok", BlobID: "blob-1"})
	})

	mux.HandleFunc("/api/cli/upload/complete", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(FinalizeResponse{Status: "ready", SnapshotID: "snap-123"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", &http.Client{Timeout: 30 * time.Second})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	result, err := UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:          repoRoot,
		ProjectName:       "demo",
		UploadConcurrency: 1,
	})
	if err != nil {
		t.Fatalf("upload snapshot: %v", err)
	}

	if result.UploadedBlobs != 1 {
		t.Fatalf("expected 1 uploaded blob, got %d", result.UploadedBlobs)
	}

	mu.Lock()
	defer mu.Unlock()

	if blobAttempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", blobAttempts)
	}

	for i := 1; i < len(timestamps); i++ {
		delay := timestamps[i].Sub(timestamps[i-1])
		if delay < 500*time.Millisecond {
			t.Errorf("delay between attempt %d and %d was %v, expected >= 500ms", i, i+1, delay)
		}
	}
}

func TestUploadRetriesNetworkTimeouts(t *testing.T) {
	repoRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoRoot, "alpha.txt"), []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	missingHash := manifest.Entries[0].BlobHash

	var (
		mu           syncpkg.Mutex
		blobAttempts int
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{missingHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		blobAttempts++
		attempt := blobAttempts
		mu.Unlock()

		if attempt < 2 {
			w.WriteHeader(http.StatusGatewayTimeout)
			return
		}
		_ = json.NewEncoder(w).Encode(UploadBlobResponse{Status: "ok", BlobID: "blob-1"})
	})

	mux.HandleFunc("/api/cli/upload/complete", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(FinalizeResponse{Status: "ready", SnapshotID: "snap-123"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", &http.Client{Timeout: 30 * time.Second})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	result, err := UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:          repoRoot,
		ProjectName:       "demo",
		UploadConcurrency: 1,
	})
	if err != nil {
		t.Fatalf("upload snapshot: %v", err)
	}

	if result.UploadedBlobs != 1 {
		t.Fatalf("expected 1 uploaded blob, got %d", result.UploadedBlobs)
	}

	mu.Lock()
	defer mu.Unlock()

	if blobAttempts != 2 {
		t.Fatalf("expected 2 attempts, got %d", blobAttempts)
	}
}

func TestUploadRetriesMaxAttemptsExhausted(t *testing.T) {
	repoRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoRoot, "alpha.txt"), []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	missingHash := manifest.Entries[0].BlobHash

	var (
		mu           syncpkg.Mutex
		blobAttempts int
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{missingHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		blobAttempts++
		mu.Unlock()

		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "rate limited"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", &http.Client{Timeout: 30 * time.Second})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	_, err = UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:          repoRoot,
		ProjectName:       "demo",
		UploadConcurrency: 1,
	})
	if err == nil || !strings.Contains(err.Error(), "rate limited") {
		t.Fatalf("expected rate limited error, got %v", err)
	}

	mu.Lock()
	defer mu.Unlock()

	if blobAttempts != 4 {
		t.Fatalf("expected 4 attempts (1 initial + 3 retries), got %d", blobAttempts)
	}
}

func TestUploadRespectsRetryAfterHeader(t *testing.T) {
	repoRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoRoot, "alpha.txt"), []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	missingHash := manifest.Entries[0].BlobHash

	var (
		mu           syncpkg.Mutex
		blobAttempts int
		timestamps   []time.Time
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{missingHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		blobAttempts++
		timestamps = append(timestamps, time.Now())
		attempt := blobAttempts
		mu.Unlock()

		if attempt == 1 {
			w.Header().Set("Retry-After", "2")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_ = json.NewEncoder(w).Encode(UploadBlobResponse{Status: "ok", BlobID: "blob-1"})
	})

	mux.HandleFunc("/api/cli/upload/complete", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(FinalizeResponse{Status: "ready", SnapshotID: "snap-123"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", &http.Client{Timeout: 30 * time.Second})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	result, err := UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:          repoRoot,
		ProjectName:       "demo",
		UploadConcurrency: 1,
	})
	if err != nil {
		t.Fatalf("upload snapshot: %v", err)
	}

	if result.UploadedBlobs != 1 {
		t.Fatalf("expected 1 uploaded blob, got %d", result.UploadedBlobs)
	}

	mu.Lock()
	defer mu.Unlock()

	if blobAttempts != 2 {
		t.Fatalf("expected 2 attempts, got %d", blobAttempts)
	}

	if len(timestamps) == 2 {
		delay := timestamps[1].Sub(timestamps[0])
		if delay < 2*time.Second {
			t.Errorf("delay was %v, expected >= 2s (Retry-After)", delay)
		}
	}
}

func TestUploadContextCancellationDuringBackoff(t *testing.T) {
	repoRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoRoot, "alpha.txt"), []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	missingHash := manifest.Entries[0].BlobHash

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{missingHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Retry-After", "10")
		w.WriteHeader(http.StatusTooManyRequests)
	})

	client, err := NewClient(server.URL, "token", "Bearer", &http.Client{Timeout: 30 * time.Second})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	_, err = UploadSnapshot(ctx, client, UploadOptions{
		RepoRoot:          repoRoot,
		ProjectName:       "demo",
		UploadConcurrency: 1,
	})
	if err == nil {
		t.Fatal("expected context cancellation error")
	}
	if !strings.Contains(err.Error(), "context") && !strings.Contains(err.Error(), "canceled") {
		t.Fatalf("expected context error, got %v", err)
	}
}

func TestUploadRetriesMixed5xxErrors(t *testing.T) {
	repoRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoRoot, "alpha.txt"), []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}
	if err := os.WriteFile(filepath.Join(repoRoot, "beta.txt"), []byte("beta"), 0o600); err != nil {
		t.Fatalf("write beta: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	if len(manifest.Entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(manifest.Entries))
	}

	var (
		mu            syncpkg.Mutex
		alphaAttempts int
		betaAttempts  int
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{manifest.Entries[0].BlobHash, manifest.Entries[1].BlobHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, r *http.Request) {
		var req UploadBlobRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		mu.Lock()
		var attempt int
		if req.Sha256 == manifest.Entries[0].BlobHash {
			alphaAttempts++
			attempt = alphaAttempts
		} else {
			betaAttempts++
			attempt = betaAttempts
		}
		mu.Unlock()

		if req.Sha256 == manifest.Entries[0].BlobHash && attempt == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		_ = json.NewEncoder(w).Encode(UploadBlobResponse{Status: "ok", BlobID: "blob-1"})
	})

	mux.HandleFunc("/api/cli/upload/complete", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(FinalizeResponse{Status: "ready", SnapshotID: "snap-123"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", &http.Client{Timeout: 30 * time.Second})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	result, err := UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:          repoRoot,
		ProjectName:       "demo",
		UploadConcurrency: 2,
	})
	if err != nil {
		t.Fatalf("upload snapshot: %v", err)
	}

	if result.UploadedBlobs != 2 {
		t.Fatalf("expected 2 uploaded blobs, got %d", result.UploadedBlobs)
	}

	mu.Lock()
	defer mu.Unlock()

	if alphaAttempts != 2 {
		t.Fatalf("expected alpha to be retried (2 attempts), got %d", alphaAttempts)
	}
	if betaAttempts != 1 {
		t.Fatalf("expected beta to succeed first time (1 attempt), got %d", betaAttempts)
	}
}

func TestParseRetryAfterHTTPDate(t *testing.T) {
	header := time.Now().Add(1500 * time.Millisecond).UTC().Format(http.TimeFormat)
	seconds := parseRetryAfter(header)
	if seconds < 1 || seconds > 3 {
		t.Fatalf("expected retry-after seconds between 1 and 3, got %d", seconds)
	}
}

func TestUploadHandles401AuthExpiry(t *testing.T) {
	repoRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoRoot, "alpha.txt"), []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	missingHash := manifest.Entries[0].BlobHash

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{missingHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	_, err = UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:    repoRoot,
		ProjectName: "demo",
	})
	if err == nil {
		t.Fatal("expected unauthorized error")
	}
	if !strings.Contains(err.Error(), "authentication failed") || !strings.Contains(err.Error(), "markdowntown login") {
		t.Fatalf("expected actionable guidance in error, got %v", err)
	}
}

func TestUploadHandles403Forbidden(t *testing.T) {
	repoRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoRoot, "alpha.txt"), []byte("alpha"), 0o600); err != nil {
		t.Fatalf("write alpha: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}
	missingHash := manifest.Entries[0].BlobHash

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/api/cli/upload/handshake", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(UploadHandshakeResponse{
			SnapshotID:   "snap-123",
			MissingBlobs: []string{missingHash},
			Upload: UploadPlan{
				Mode: "direct",
				URL:  server.URL + "/api/cli/upload/blob",
			},
		})
	})

	mux.HandleFunc("/api/cli/upload/blob", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
	})

	client, err := NewClient(server.URL, "token", "Bearer", server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	_, err = UploadSnapshot(context.Background(), client, UploadOptions{
		RepoRoot:    repoRoot,
		ProjectName: "demo",
	})
	if err == nil {
		t.Fatal("expected forbidden error")
	}
	if !strings.Contains(err.Error(), "access denied") || !strings.Contains(err.Error(), "markdowntown login") {
		t.Fatalf("expected actionable guidance in error, got %v", err)
	}
}

func TestBackoffDelayUsesRandomJitter(t *testing.T) {
	expectedBase := 500 * time.Millisecond * 2
	delays := make(map[time.Duration]struct{})
	for i := 0; i < 5; i++ {
		delay := backoffDelay(1, 0)
		if delay < expectedBase || delay > expectedBase+100*time.Millisecond {
			t.Fatalf("delay %v outside expected range [%v, %v]", delay, expectedBase, expectedBase+100*time.Millisecond)
		}
		delays[delay] = struct{}{}
	}
	if len(delays) == 1 {
		for delay := range delays {
			t.Fatalf("expected jitter to vary, saw identical delay %v", delay)
		}
	}
}
