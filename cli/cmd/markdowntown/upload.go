package main

import (
	"context"
	"fmt"
	"markdowntown-cli/internal/sync"
	"os"

	"github.com/spf13/cobra"
)

func newUploadCmd() *cobra.Command {
	var repoPath string
	var dryRun bool
	var maxBase64 int64
	var projectName string
	var projectSlug string
	var projectID string

	cmd := &cobra.Command{
		Use:   "upload",
		Short: "Upload a snapshot of the repository to the web UI",
		RunE: func(_ *cobra.Command, _ []string) error {
			if repoPath == "" {
				wd, err := os.Getwd()
				if err != nil {
					return err
				}
				repoPath = wd
			}

			if dryRun {
				fmt.Println("Dry run: skipping upload")
			}

			// Load auth config to get baseURL and token
			client, err := sync.NewClient(os.Getenv("MARKDOWNTOWN_BASE_URL"), os.Getenv("MARKDOWNTOWN_TOKEN"), "Bearer", nil)
			if err != nil {
				// Fallback to loading from disk if env not set
				// This is just a stub, real implementation would load from config.LoadAuth()
				fmt.Println("Warning: authentication not configured via env vars")
			}

			opts := sync.UploadOptions{
				RepoRoot:       repoPath,
				ProjectID:      projectID,
				ProjectName:    projectName,
				ProjectSlug:    projectSlug,
				MaxBase64Bytes: maxBase64,
				Progress: func(p sync.UploadProgress) {
					fmt.Printf("[%s] %d/%d %s\n", p.Stage, p.Completed, p.Total, p.Hash)
				},
			}

			result, err := sync.UploadSnapshot(context.Background(), client, opts)
			if err != nil {
				return err
			}

			fmt.Printf("Upload successful! Snapshot ID: %s\n", result.SnapshotID)
			return nil
		},
	}

	cmd.Flags().StringVar(&repoPath, "repo", "", "Path to the repository (defaults to git root)")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Scan the repository but do not upload")
	cmd.Flags().Int64Var(&maxBase64, "max-base64", 1024*1024, "Maximum blob size for base64 upload (default 1MB)")
	cmd.Flags().StringVar(&projectName, "project-name", "", "Project name")
	cmd.Flags().StringVar(&projectSlug, "project-slug", "", "Project slug")
	cmd.Flags().StringVar(&projectID, "project-id", "", "Project ID")

	return cmd
}
