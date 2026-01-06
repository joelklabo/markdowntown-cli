package sync

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"markdowntown-cli/internal/config"
	"mime"
	"os"
	"path/filepath"
	syncpkg "sync"
)

// UploadStage identifies which stage is running.
type UploadStage string

const (
	// UploadStageManifest indicates manifest creation.
	UploadStageManifest UploadStage = "manifest"
	// UploadStageHandshake indicates handshake with the server.
	UploadStageHandshake UploadStage = "handshake"
	// UploadStageUpload indicates blob upload work.
	UploadStageUpload UploadStage = "upload"
	// UploadStageFinalize indicates snapshot finalization.
	UploadStageFinalize UploadStage = "finalize"
)

// UploadProgress reports upload progress.
type UploadProgress struct {
	Stage     UploadStage
	Completed int
	Total     int
	Hash      string
}

// UploadProgressFunc receives upload progress updates.
type UploadProgressFunc func(UploadProgress)

// UploadOptions configures the upload workflow.
type UploadOptions struct {
	RepoRoot          string
	ProjectID         string
	ProjectName       string
	ProjectSlug       string
	Provider          string
	BaseSnapshotID    string
	ProtocolVersion   string
	IdempotencyKey    string
	IncludeGitIgnored bool
	MaxFiles          int
	MaxTotalBytes     int64
	MaxFileBytes      int64
	MaxBase64Bytes    int64
	UploadConcurrency int
	Metadata          any
	Progress          UploadProgressFunc
}

// UploadResult captures snapshot upload outcomes.
type UploadResult struct {
	SnapshotID    string
	ManifestHash  string
	MissingBlobs  int
	UploadedBlobs int
	UploadedBytes int64
	Preflight     PreflightResult
	Resumed       bool
}

// UploadSnapshot builds a manifest, uploads missing blobs, and finalizes the snapshot.
func UploadSnapshot(ctx context.Context, client *Client, opts UploadOptions) (UploadResult, error) {
	var result UploadResult
	if client == nil {
		return result, errors.New("sync client required")
	}
	if opts.RepoRoot == "" {
		return result, errors.New("repo root required")
	}
	if opts.ProjectName == "" && opts.ProjectSlug == "" && opts.ProjectID == "" {
		return result, errors.New("project name, slug, or id required")
	}

	workers := opts.UploadConcurrency
	if workers <= 0 {
		workers = 4
	}

	if opts.Progress != nil {
		opts.Progress(UploadProgress{Stage: UploadStageManifest})
	}

	manifest, preflight, err := BuildManifest(ManifestOptions{
		RepoRoot:          opts.RepoRoot,
		IncludeGitIgnored: opts.IncludeGitIgnored,
		MaxFiles:          opts.MaxFiles,
		MaxTotalBytes:     opts.MaxTotalBytes,
		MaxFileBytes:      opts.MaxFileBytes,
	})
	result.ManifestHash = manifest.Hash
	result.Preflight = preflight
	if err != nil {
		return result, err
	}

	if opts.Progress != nil {
		opts.Progress(UploadProgress{Stage: UploadStageHandshake})
	}

	// Check for existing checkpoint to resume
	checkpoint, err := config.LoadCheckpoint(opts.RepoRoot)
	if err == nil && checkpoint.ManifestHash == manifest.Hash {
		result.Resumed = true
		if opts.BaseSnapshotID == "" {
			opts.BaseSnapshotID = checkpoint.SnapshotID
		}
		if opts.IdempotencyKey == "" {
			opts.IdempotencyKey = checkpoint.ManifestHash
		}
	}

	handshake := UploadHandshakeRequest{
		ProjectID:       opts.ProjectID,
		ProjectSlug:     opts.ProjectSlug,
		ProjectName:     opts.ProjectName,
		Provider:        opts.Provider,
		RepoRoot:        opts.RepoRoot,
		ProtocolVersion: opts.ProtocolVersion,
		IdempotencyKey:  opts.IdempotencyKey,
		BaseSnapshotID:  opts.BaseSnapshotID,
		ManifestHash:    manifest.Hash,
		Metadata:        opts.Metadata,
		Manifest:        convertManifestEntries(manifest.Entries),
	}

	resp, err := client.Handshake(ctx, handshake)
	result.SnapshotID = resp.SnapshotID
	result.MissingBlobs = len(resp.MissingBlobs)
	if err != nil {
		return result, err
	}

	// Save or update checkpoint
	_ = config.SaveCheckpoint(config.UploadCheckpoint{
		RepoRoot:     opts.RepoRoot,
		SnapshotID:   resp.SnapshotID,
		ManifestHash: manifest.Hash,
		MissingBlobs: resp.MissingBlobs,
		UploadURL:    resp.Upload.URL,
	})

	if opts.Progress != nil {
		opts.Progress(UploadProgress{
			Stage:     UploadStageUpload,
			Completed: 0,
			Total:     len(resp.MissingBlobs),
		})
	}

	uploadedCount, uploadedBytes, err := uploadMissingBlobs(ctx, client, resp, manifest.Entries, opts, workers)
	result.UploadedBlobs = uploadedCount
	result.UploadedBytes = uploadedBytes
	if err != nil {
		return result, err
	}

	if opts.Progress != nil {
		opts.Progress(UploadProgress{Stage: UploadStageFinalize})
	}

	finalize, err := client.Finalize(ctx, resp.SnapshotID)
	if finalize.SnapshotID != "" {
		result.SnapshotID = finalize.SnapshotID
	}
	if err != nil {
		return result, err
	}

	// Clear checkpoint on success
	_ = config.RemoveCheckpoint(opts.RepoRoot)

	return result, nil
}

type uploadEntry struct {
	entry   ManifestEntry
	absPath string
}

func uploadMissingBlobs(
	ctx context.Context,
	client *Client,
	resp UploadHandshakeResponse,
	entries []ManifestEntry,
	opts UploadOptions,
	workers int,
) (int, int64, error) {
	if len(resp.MissingBlobs) == 0 {
		return 0, 0, nil
	}
	if resp.Upload.Mode != "direct" {
		return 0, 0, fmt.Errorf("unsupported upload mode: %s", resp.Upload.Mode)
	}
	if resp.Upload.URL == "" {
		return 0, 0, errors.New("upload URL missing")
	}

	entryMap, err := buildEntryMap(opts.RepoRoot, entries)
	if err != nil {
		return 0, 0, err
	}

	if workers > len(resp.MissingBlobs) {
		workers = len(resp.MissingBlobs)
	}
	if workers <= 0 {
		workers = 1
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	type uploadJob struct {
		hash string
	}
	jobs := make(chan uploadJob)
	errCh := make(chan error, 1)

	var (
		mu           syncpkg.Mutex
		progressMu   syncpkg.Mutex
		uploaded     int
		uploadedSize int64
	)

	worker := func() {
		defer func() {
			if r := recover(); r != nil {
				select {
				case errCh <- fmt.Errorf("upload panic: %v", r):
				default:
				}
				cancel()
			}
		}()

		for job := range jobs {
			if ctx.Err() != nil {
				return
			}
			entry, ok := entryMap[job.hash]
			if !ok {
				select {
				case errCh <- fmt.Errorf("missing manifest entry for blob %s", job.hash):
				default:
				}
				cancel()
				return
			}

			if err := uploadBlobDirect(ctx, client, resp.Upload.URL, resp.SnapshotID, entry, opts.MaxBase64Bytes); err != nil {
				select {
				case errCh <- err:
				default:
				}
				cancel()
				return
			}

			mu.Lock()
			uploaded++
			uploadedSize += entry.entry.Size
			complete := uploaded
			mu.Unlock()

			if opts.Progress != nil {
				progressMu.Lock()
				opts.Progress(UploadProgress{
					Stage:     UploadStageUpload,
					Completed: complete,
					Total:     len(resp.MissingBlobs),
					Hash:      job.hash,
				})
				progressMu.Unlock()
			}
		}
	}

	var wg syncpkg.WaitGroup
	wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func() {
			defer wg.Done()
			worker()
		}()
	}

	for _, hash := range resp.MissingBlobs {
		if ctx.Err() != nil {
			break
		}
		jobs <- uploadJob{hash: hash}
	}
	close(jobs)
	wg.Wait()

	select {
	case err := <-errCh:
		return uploaded, uploadedSize, err
	default:
	}

	return uploaded, uploadedSize, nil
}

func uploadBlobDirect(ctx context.Context, client *Client, endpoint string, snapshotID string, entry uploadEntry, maxBase64 int64) error {
	content, contentType, err := readBlobContent(entry)
	if err != nil {
		return fmt.Errorf("read blob %s: %w", entry.entry.Path, err)
	}

	if maxBase64 > 0 && int64(len(content)) > maxBase64 {
		return fmt.Errorf("blob %s exceeds base64 upload limit (%d > %d bytes)", entry.entry.Path, len(content), maxBase64)
	}

	req := UploadBlobRequest{
		SnapshotID:    snapshotID,
		Sha256:        entry.entry.BlobHash,
		SizeBytes:     entry.entry.Size,
		ContentBase64: base64.StdEncoding.EncodeToString(content),
	}
	if contentType != "" {
		req.ContentType = contentType
	}

	if err := client.UploadBlob(ctx, endpoint, req); err != nil {
		return fmt.Errorf("upload blob %s: %w", entry.entry.Path, err)
	}
	return nil
}

func readBlobContent(entry uploadEntry) ([]byte, string, error) {
	// #nosec G304 -- path is derived from repo root and manifest.
	data, err := os.ReadFile(entry.absPath)
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) != entry.entry.Size {
		return nil, "", fmt.Errorf("blob size mismatch for %s", entry.entry.Path)
	}

	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])
	if hash != entry.entry.BlobHash {
		return nil, "", fmt.Errorf("blob hash mismatch for %s", entry.entry.Path)
	}

	contentType := mime.TypeByExtension(filepath.Ext(entry.entry.Path))
	return data, contentType, nil
}

func buildEntryMap(repoRoot string, entries []ManifestEntry) (map[string]uploadEntry, error) {
	if repoRoot == "" {
		return nil, errors.New("repo root required")
	}
	mapped := make(map[string]uploadEntry, len(entries))
	for _, entry := range entries {
		if entry.IsDeleted {
			continue
		}
		if _, ok := mapped[entry.BlobHash]; ok {
			continue
		}
		absPath := filepath.Join(repoRoot, filepath.FromSlash(entry.Path))
		mapped[entry.BlobHash] = uploadEntry{
			entry:   entry,
			absPath: absPath,
		}
	}
	return mapped, nil
}

func convertManifestEntries(entries []ManifestEntry) []UploadManifestEntry {
	converted := make([]UploadManifestEntry, 0, len(entries))
	for _, entry := range entries {
		converted = append(converted, UploadManifestEntry{
			Path:      entry.Path,
			BlobHash:  entry.BlobHash,
			SizeBytes: entry.Size,
			Mode:      entry.Mode,
			Mtime:     entry.Mtime,
			IsDeleted: entry.IsDeleted,
		})
	}
	return converted
}
