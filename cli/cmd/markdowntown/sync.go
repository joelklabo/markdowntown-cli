package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"markdowntown-cli/internal/auth"
	"markdowntown-cli/internal/config"
	syncer "markdowntown-cli/internal/sync"
)

const syncUsage = `markdowntown sync

Usage:
  markdowntown sync upload [flags]

Flags:
  -h, --help  Show help
`

const syncUploadUsage = `markdowntown sync upload

Usage:
  markdowntown sync upload [flags]

Flags:
  --repo <path>             Repo path (defaults to git root)
  --project <name>          Project name (defaults to repo directory name)
  --project-slug <slug>     Project slug (optional)
  --project-id <id>         Existing project ID (optional)
  --provider <name>         Provider label (default: local)
  --base-url <url>          Base URL for the web app (default from login/env)
  --base-snapshot <id>      Base snapshot ID for delta uploads (optional)
  --idempotency-key <key>   Idempotency key for retry safety (optional)
  --protocol <version>      Protocol version (default: v1)
  --include-git-ignored     Include git-ignored files
  --max-files <n>           Preflight max files (0 = unlimited)
  --max-bytes <n>           Preflight max total bytes (0 = unlimited)
  --max-file-bytes <n>      Preflight max single file size (0 = unlimited)
  --upload-concurrency <n>  Parallel blob uploads (default: 4)
  --quiet                   Reduce progress output
  -h, --help                Show help
`

func runSync(args []string) error {
	if len(args) == 0 {
		_, _ = fmt.Fprint(os.Stdout, syncUsage)
		return nil
	}
	switch args[0] {
	case "help", "-h", "--help":
		_, _ = fmt.Fprint(os.Stdout, syncUsage)
		return nil
	}
	switch args[0] {
	case "upload":
		return runSyncUpload(args[1:])
	default:
		return fmt.Errorf("unknown sync subcommand: %s", args[0])
	}
}

func runSyncUpload(args []string) error {
	return runSyncUploadWithIO(os.Stdout, os.Stderr, args)
}

func runSyncUploadWithIO(stdout, stderr io.Writer, args []string) error {
	flags := flag.NewFlagSet("sync upload", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var repoPath string
	var projectName string
	var projectSlug string
	var projectID string
	var provider string
	var baseURL string
	var baseSnapshot string
	var idempotencyKey string
	var protocol string
	var includeGitIgnored bool
	var maxFiles int
	var maxBytes int64
	var maxFileBytes int64
	var uploadConcurrency int
	var quiet bool
	var help bool

	flags.StringVar(&repoPath, "repo", "", "repo path")
	flags.StringVar(&projectName, "project", "", "project name")
	flags.StringVar(&projectSlug, "project-slug", "", "project slug")
	flags.StringVar(&projectID, "project-id", "", "project id")
	flags.StringVar(&provider, "provider", "local", "provider")
	flags.StringVar(&baseURL, "base-url", "", "base url")
	flags.StringVar(&baseSnapshot, "base-snapshot", "", "base snapshot")
	flags.StringVar(&idempotencyKey, "idempotency-key", "", "idempotency key")
	flags.StringVar(&protocol, "protocol", "v1", "protocol version")
	flags.BoolVar(&includeGitIgnored, "include-git-ignored", false, "include git ignored")
	flags.IntVar(&maxFiles, "max-files", 0, "max files")
	flags.Int64Var(&maxBytes, "max-bytes", 0, "max bytes")
	flags.Int64Var(&maxFileBytes, "max-file-bytes", 0, "max file bytes")
	flags.IntVar(&uploadConcurrency, "upload-concurrency", 4, "upload concurrency")
	flags.BoolVar(&quiet, "quiet", false, "quiet")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}
	if help {
		_, _ = fmt.Fprint(stdout, syncUploadUsage)
		return nil
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}
	if maxFiles < 0 {
		return fmt.Errorf("max-files must be >= 0")
	}
	if maxBytes < 0 {
		return fmt.Errorf("max-bytes must be >= 0")
	}
	if maxFileBytes < 0 {
		return fmt.Errorf("max-file-bytes must be >= 0")
	}
	if uploadConcurrency < 0 {
		return fmt.Errorf("upload-concurrency must be >= 0")
	}

	repoRoot, err := resolveRepoRoot(repoPath)
	if err != nil {
		return err
	}

	projectName = strings.TrimSpace(projectName)
	projectSlug = strings.TrimSpace(projectSlug)
	projectID = strings.TrimSpace(projectID)
	if projectName == "" && projectSlug == "" && projectID == "" {
		projectName = defaultProjectName(repoRoot)
	}

	record, _, err := auth.LoadAuth()
	if err != nil {
		if errors.Is(err, config.ErrAuthNotFound) {
			return errors.New("not logged in; run `markdowntown login`")
		}
		return err
	}
	if record.AccessToken == "" {
		return errors.New("missing access token; run `markdowntown login`")
	}
	if !record.ExpiresAt.IsZero() && time.Now().After(record.ExpiresAt) {
		return errors.New("auth token expired; run `markdowntown login`")
	}

	resolvedBaseURL := strings.TrimSpace(baseURL)
	if resolvedBaseURL == "" {
		resolvedBaseURL = strings.TrimSpace(record.BaseURL)
	}
	resolvedBaseURL, err = auth.ResolveBaseURL(resolvedBaseURL)
	if err != nil {
		return err
	}

	client, err := syncer.NewClient(resolvedBaseURL, record.AccessToken, record.TokenType, nil)
	if err != nil {
		return err
	}

	progress := newSyncProgressReporter(stderr, !quiet)

	result, err := syncer.UploadSnapshot(context.Background(), client, syncer.UploadOptions{
		RepoRoot:          repoRoot,
		ProjectID:         projectID,
		ProjectName:       projectName,
		ProjectSlug:       projectSlug,
		Provider:          provider,
		BaseSnapshotID:    strings.TrimSpace(baseSnapshot),
		ProtocolVersion:   strings.TrimSpace(protocol),
		IdempotencyKey:    strings.TrimSpace(idempotencyKey),
		IncludeGitIgnored: includeGitIgnored,
		MaxFiles:          maxFiles,
		MaxTotalBytes:     maxBytes,
		MaxFileBytes:      maxFileBytes,
		UploadConcurrency: uploadConcurrency,
		Progress:          progress,
	})
	if err != nil {
		if result.SnapshotID != "" {
			_, _ = fmt.Fprintf(stderr, "Upload interrupted for snapshot %s. Re-run to resume; missing blobs will be skipped.\n", result.SnapshotID)
		}
		return err
	}

	if !quiet {
		_, _ = fmt.Fprintf(stderr, "Manifest: %d files, %d bytes.\n", result.Preflight.FileCount, result.Preflight.TotalBytes)
		_, _ = fmt.Fprintf(stderr, "Uploaded %d blobs (%d bytes).\n", result.UploadedBlobs, result.UploadedBytes)
	}

	viewURL := buildSnapshotURL(resolvedBaseURL, result.SnapshotID)
	_, _ = fmt.Fprintf(stdout, "Snapshot ready: %s\n", result.SnapshotID)
	_, _ = fmt.Fprintf(stdout, "View: %s\n", viewURL)
	return nil
}

func defaultProjectName(repoRoot string) string {
	base := strings.TrimSpace(filepath.Base(repoRoot))
	if base == "" || base == "." || base == string(filepath.Separator) {
		return "repo"
	}
	return base
}

func buildSnapshotURL(baseURL, snapshotID string) string {
	if snapshotID == "" {
		return baseURL
	}
	joined, err := url.JoinPath(baseURL, "cli", "snapshots", snapshotID)
	if err != nil {
		return strings.TrimRight(baseURL, "/") + "/cli/snapshots/" + snapshotID
	}
	return joined
}

func newSyncProgressReporter(stderr io.Writer, enabled bool) syncer.UploadProgressFunc {
	if !enabled {
		return nil
	}
	lastStage := syncer.UploadStage("")
	lastLen := 0
	terminal := isTerminal(os.Stderr)

	return func(progress syncer.UploadProgress) {
		if progress.Stage != lastStage {
			if lastStage == syncer.UploadStageUpload && terminal && lastLen > 0 {
				_, _ = fmt.Fprint(stderr, "\n")
				lastLen = 0
			}
			lastStage = progress.Stage
			switch progress.Stage {
			case syncer.UploadStageManifest:
				_, _ = fmt.Fprintln(stderr, "Building manifest...")
			case syncer.UploadStageHandshake:
				_, _ = fmt.Fprintln(stderr, "Contacting upload service...")
			case syncer.UploadStageFinalize:
				_, _ = fmt.Fprintln(stderr, "Finalizing snapshot...")
			}
		}

		if progress.Stage != syncer.UploadStageUpload {
			return
		}

		if progress.Total == 0 {
			_, _ = fmt.Fprintln(stderr, "No blobs to upload.")
			return
		}

		msg := fmt.Sprintf("Uploading blobs: %d/%d", progress.Completed, progress.Total)
		if terminal {
			if lastLen > len(msg) {
				msg += strings.Repeat(" ", lastLen-len(msg))
			}
			lastLen = len(msg)
			_, _ = fmt.Fprintf(stderr, "\r%s", msg)
			if progress.Completed >= progress.Total {
				_, _ = fmt.Fprint(stderr, "\n")
				lastLen = 0
			}
			return
		}

		if progress.Completed == progress.Total || progress.Completed == 1 || progress.Completed%10 == 0 {
			_, _ = fmt.Fprintln(stderr, msg)
		}
	}
}
