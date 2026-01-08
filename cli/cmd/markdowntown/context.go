package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	context_pkg "markdowntown-cli/internal/context"
	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/tui"
)

const contextUsage = `markdowntown context

Usage:
  markdowntown context [flags] [path]

Flags:
  --repo <path>         Repo path (defaults to git root from cwd)
  --json                Output context resolution as JSON
  -h, --help            Show help
`

func runContext(args []string) error {
	flags := flag.NewFlagSet("context", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var repoPath string
	var jsonMode bool
	var help bool

	flags.StringVar(&repoPath, "repo", "", "repo path (defaults to git root)")
	flags.BoolVar(&jsonMode, "json", false, "output context resolution as JSON")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}

	if help {
		printContextUsage(os.Stdout)
		return nil
	}

	targetPath := "."
	if flags.NArg() > 0 {
		targetPath = flags.Arg(0)
	}

	if flags.NArg() > 1 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args()[1:], " "))
	}

	repoRoot, err := resolveRepoRoot(repoPath)
	if err != nil {
		return err
	}

	if jsonMode {
		return runContextJSON(repoRoot, targetPath)
	}

	return tui.Start(repoRoot)
}

func printContextUsage(w io.Writer) {
	_, _ = fmt.Fprint(w, contextUsage)
}

func runContextJSON(repoRoot, targetPath string) error {
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return err
	}

	relPath, err := filepath.Rel(repoRoot, absTarget)
	if err != nil {
		// If target is outside repo root, use absolute path
		relPath = absTarget
	}

	if relPath == "." {
		relPath = ""
	}

	engine := context_pkg.NewEngine()
	clients := instructions.AllClients()

	res, err := engine.ResolveContext(context.Background(), context_pkg.ResolveOptions{
		RepoRoot: repoRoot,
		FilePath: relPath,
		Clients:  clients,
	})
	if err != nil {
		return err
	}

	return context_pkg.WriteJSON(os.Stdout, res)
}
