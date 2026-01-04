package sync

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	syncpkg "sync"
	"testing"
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
