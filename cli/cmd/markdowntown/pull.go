package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"markdowntown-cli/internal/auth"
	"markdowntown-cli/internal/config"
	syncer "markdowntown-cli/internal/sync"
)

const pullUsage = `markdowntown pull

Usage:
  markdowntown pull [flags]

Flags:
  --snapshot <id>   Snapshot ID to fetch patches
  --patch-id <id>   Patch ID to fetch a single patch
  --repo <path>     Repo path (defaults to git root)
  --base-url <url>  Base URL for the web app (default from login/env)
  --apply           Apply patches (default is dry-run)
  --dry-run         Only check patches (default)
  --force           Apply patches even if working tree is dirty
  --quiet           Reduce output
  -h, --help        Show help
`

func runPull(args []string) error {
	return runPullWithIO(os.Stdout, os.Stderr, args)
}

func runPullWithIO(stdout, stderr io.Writer, args []string) error {
	flags := flag.NewFlagSet("pull", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var repoPath string
	var snapshotID string
	var patchID string
	var baseURL string
	var apply bool
	var dryRun bool
	var force bool
	var quiet bool
	var help bool

	flags.StringVar(&repoPath, "repo", "", "repo path")
	flags.StringVar(&snapshotID, "snapshot", "", "snapshot id")
	flags.StringVar(&patchID, "patch-id", "", "patch id")
	flags.StringVar(&baseURL, "base-url", "", "base url")
	flags.BoolVar(&apply, "apply", false, "apply patches")
	flags.BoolVar(&dryRun, "dry-run", false, "dry run")
	flags.BoolVar(&force, "force", false, "apply with dirty working tree")
	flags.BoolVar(&quiet, "quiet", false, "quiet")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}
	if help {
		_, _ = fmt.Fprint(stdout, pullUsage)
		return nil
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}

	snapshotID = strings.TrimSpace(snapshotID)
	patchID = strings.TrimSpace(patchID)
	if snapshotID == "" && patchID == "" {
		return errors.New("missing snapshot id or patch id")
	}
	if snapshotID != "" && patchID != "" {
		return errors.New("use either --snapshot or --patch-id")
	}
	if apply && dryRun {
		return errors.New("choose either --apply or --dry-run")
	}
	if !apply {
		dryRun = true
	}

	repoRoot, err := resolveRepoRoot(repoPath)
	if err != nil {
		return err
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

	ctx := context.Background()
	patches, err := fetchPatches(ctx, client, snapshotID, patchID)
	if err != nil {
		return err
	}
	if len(patches) == 0 {
		_, _ = fmt.Fprintln(stdout, "No patches available.")
		return nil
	}

	results, err := syncer.ApplyPatches(repoRoot, patches, syncer.ApplyOptions{DryRun: dryRun, Force: force})
	printPullResults(stdout, stderr, results, dryRun, quiet)
	if err != nil {
		return err
	}

	return nil
}

func fetchPatches(ctx context.Context, client *syncer.Client, snapshotID, patchID string) ([]syncer.Patch, error) {
	if patchID != "" {
		patch, err := syncer.FetchPatch(ctx, client, patchID)
		if err != nil {
			return nil, err
		}
		return []syncer.Patch{patch}, nil
	}

	return syncer.FetchPatches(ctx, client, snapshotID)
}

func printPullResults(stdout, stderr io.Writer, results []syncer.ApplyResult, dryRun bool, quiet bool) {
	var applied int
	var skipped int
	var conflicts int

	for _, result := range results {
		switch result.Status {
		case syncer.PatchApplied:
			applied++
			if !quiet {
				_, _ = fmt.Fprintf(stderr, "Applied patch %s (%s).\n", result.Patch.ID, result.Patch.Path)
			}
		case syncer.PatchDryRun:
			applied++
			if !quiet {
				_, _ = fmt.Fprintf(stderr, "Patch %s would apply cleanly (%s).\n", result.Patch.ID, result.Patch.Path)
			}
		case syncer.PatchSkipped:
			skipped++
			if !quiet {
				_, _ = fmt.Fprintf(stderr, "Skipped patch %s (%s).\n", result.Patch.ID, result.Patch.Path)
			}
		case syncer.PatchConflict:
			conflicts++
			if !quiet && result.Err != nil {
				_, _ = fmt.Fprintf(stderr, "Patch %s conflict (%s): %v\n", result.Patch.ID, result.Patch.Path, result.Err)
			}
		case syncer.PatchFailed:
			if !quiet && result.Err != nil {
				_, _ = fmt.Fprintf(stderr, "Patch %s failed (%s): %v\n", result.Patch.ID, result.Patch.Path, result.Err)
			}
		}
	}

	if dryRun {
		_, _ = fmt.Fprintf(stdout, "Dry run: %d patch(es) checked, %d skipped, %d conflict(s).\n", applied, skipped, conflicts)
		return
	}
	_, _ = fmt.Fprintf(stdout, "Applied %d patch(es); %d skipped; %d conflict(s).\n", applied, skipped, conflicts)
}
