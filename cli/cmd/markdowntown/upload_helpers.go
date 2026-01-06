package main

import (
	"fmt"
	"io"
	"path/filepath"

	syncer "markdowntown-cli/internal/sync"

	"github.com/spf13/cobra"
)

// newUploadCmd creates the upload subcommand for sync.
func newUploadCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "upload",
		Short: "Upload repository to the web UI",
		RunE: func(_ *cobra.Command, args []string) error {
			return runUpload(args)
		},
	}
}

// defaultProjectName derives a project name from the repository root path.
func defaultProjectName(repoRoot string) string {
	return filepath.Base(repoRoot)
}

// newSyncProgressReporter creates a progress reporter that writes to the given writer.
func newSyncProgressReporter(w io.Writer, verbose bool) syncer.UploadProgressFunc {
	return func(p syncer.UploadProgress) {
		if !verbose {
			return
		}
		if p.Stage != "" {
			_, _ = fmt.Fprintf(w, "[%s] ", p.Stage)
		}
		if p.Total > 0 {
			_, _ = fmt.Fprintf(w, "%d/%d", p.Completed, p.Total)
		}
		_, _ = fmt.Fprintln(w)
	}
}

// buildSnapshotURL constructs a URL to view the uploaded snapshot.
func buildSnapshotURL(baseURL, snapshotID string) string {
	return fmt.Sprintf("%s/cli/%s", baseURL, snapshotID)
}
