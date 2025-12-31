// Package main implements the markdowntown CLI.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/version"
)

const rootUsage = `markdowntown

Usage:
  markdowntown                     # Show help (no default command)
  markdowntown scan [flags]        # Scan for AI config files
  markdowntown registry validate   # Validate pattern registry
  markdowntown tools list          # List recognized tools

Flags:
  --version  Print tool and schema versions
  -h, --help Show help
`

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		printUsage(os.Stdout)
		return
	}

	switch args[0] {
	case "-h", "--help", "help":
		printUsage(os.Stdout)
		return
	case "--version":
		printVersion(os.Stdout)
		return
	case "scan":
		if err := runScan(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "registry":
		if err := runRegistry(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "tools":
		if err := runTools(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	default:
		exitWithError(fmt.Errorf("unknown command: %s", args[0]))
	}
}

func printUsage(w io.Writer) {
	_, _ = fmt.Fprint(w, rootUsage)
}

func printVersion(w io.Writer) {
	_, _ = fmt.Fprintf(w, "markdowntown %s (schema %s)\n", version.ToolVersion, version.SchemaVersion)
}

func runScan(_ []string) error {
	return fmt.Errorf("scan not implemented")
}

func runRegistry(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("registry subcommand required")
	}
	if args[0] != "validate" {
		return fmt.Errorf("unknown registry subcommand: %s", args[0])
	}
	return fmt.Errorf("registry validate not implemented")
}

func runTools(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("tools subcommand required")
	}
	if args[0] != "list" {
		return fmt.Errorf("unknown tools subcommand: %s", args[0])
	}
	return runToolsList()
}

func exitWithError(err error) {
	fmt.Fprintln(os.Stderr, err.Error())
	printUsage(os.Stderr)
	os.Exit(1)
}

func runToolsList() error {
	reg, _, err := scan.LoadRegistry()
	if err != nil {
		return err
	}

	summaries := scan.BuildToolSummaries(reg)
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	return enc.Encode(summaries)
}
