package main

import "github.com/spf13/cobra"

func newSyncCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "sync",
		Short: "Sync the repository with the web UI",
	}
	cmd.AddCommand(newUploadCmd())
	return cmd
}
