package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"markdowntown-cli/internal/auth"
)

const logoutUsage = `markdowntown logout

Usage:
  markdowntown logout [flags]

Flags:
   -h, --help    Show help
`

func runLogout(args []string) error {
	return runLogoutWithIO(os.Stdout, os.Stderr, args)
}

func runLogoutWithIO(stdout, stderr io.Writer, args []string) error {
	flags := flag.NewFlagSet("logout", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var help bool
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}
	if help {
		_, _ = fmt.Fprint(stdout, logoutUsage)
		return nil
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}

	store := auth.NewFileTokenStore()
	if err := store.Delete(); err != nil {
		_, _ = fmt.Fprintf(stderr, "Warning: failed to clear token: %v\n", err)
		return err
	}

	_, _ = fmt.Fprintln(stdout, "Logged out successfully.")
	return nil
}
