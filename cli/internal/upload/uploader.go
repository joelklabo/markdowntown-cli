package upload

import (
	"context"
	"fmt"
	"time"

	"markdowntown-cli/internal/scan"
	syncer "markdowntown-cli/internal/sync"

	"github.com/spf13/afero"
)

// Options configures the upload process.
type Options struct {
	RepoRoot          string
	ProjectID         string
	ProjectName       string
	ProjectSlug       string
	Provider          string
	BaseSnapshotID    string
	IncludeGitIgnored bool
	MaxFiles          int
	MaxTotalBytes     int64
	MaxFileBytes      int64
	MaxBase64Bytes    int64
	UploadConcurrency int
	ScanWorkers       int
	Progress          syncer.UploadProgressFunc
}

// Result captures the outcome of a scan and upload.
type Result struct {
	SnapshotID    string
	ScanResult    scan.Result
	UploadedBlobs int
	UploadedBytes int64
	Resumed       bool
}

// Run performs a scan and uploads the snapshot with scan results as metadata.
func Run(ctx context.Context, client *syncer.Client, opts Options) (Result, error) {
	var result Result

	// 1. Run Scan
	if opts.Progress != nil {
		opts.Progress(syncer.UploadProgress{Stage: "scanning"})
	}

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return result, fmt.Errorf("load registry: %w", err)
	}

	scanStartedAt := time.Now()
	scanResult, err := scan.Scan(scan.Options{
		RepoRoot:       opts.RepoRoot,
		IncludeContent: true, // We need content for the scan result logic
		ScanWorkers:    opts.ScanWorkers,
		Registry:       registry,
		Fs:             afero.NewOsFs(),
	})
	if err != nil {
		return result, fmt.Errorf("scan failed: %w", err)
	}

	// Apply gitignore to scan result to filter out ignored files from the report
	scanResult, err = scan.ApplyGitignore(scanResult, opts.RepoRoot)
	if err != nil {
		return result, fmt.Errorf("apply gitignore: %w", err)
	}
	scanFinishedAt := time.Now()

	payload := NewScanPayload(scanResult, registry.Version, scanStartedAt, scanFinishedAt)

	// 2. Upload Snapshot
	syncResult, err := syncer.UploadSnapshot(ctx, client, syncer.UploadOptions{
		RepoRoot:          opts.RepoRoot,
		ProjectID:         opts.ProjectID,
		ProjectName:       opts.ProjectName,
		ProjectSlug:       opts.ProjectSlug,
		Provider:          opts.Provider,
		BaseSnapshotID:    opts.BaseSnapshotID,
		IncludeGitIgnored: opts.IncludeGitIgnored,
		MaxFiles:          opts.MaxFiles,
		MaxTotalBytes:     opts.MaxTotalBytes,
		MaxFileBytes:      opts.MaxFileBytes,
		MaxBase64Bytes:    opts.MaxBase64Bytes,
		UploadConcurrency: opts.UploadConcurrency,
		Metadata:          payload,
		Progress:          opts.Progress,
	})
	if err != nil {
		// Return partial result if available
		result.SnapshotID = syncResult.SnapshotID
		return result, err
	}

	result.SnapshotID = syncResult.SnapshotID
	result.ScanResult = scanResult
	result.UploadedBlobs = syncResult.UploadedBlobs
	result.UploadedBytes = syncResult.UploadedBytes
	result.Resumed = syncResult.Resumed

	return result, nil
}
