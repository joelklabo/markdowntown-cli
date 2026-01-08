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
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/tui"
)

const contextUsage = `markdowntown context

Usage:
  markdowntown context [flags] [path]

Flags:
  --repo <path>         Repo path (defaults to git root from cwd)
  --json                Output context resolution as JSON
  --compare <c1,c2>     Compare two clients (comma-separated)
  --search <query>      Search across instruction files
  -h, --help            Show help
`

func runContext(args []string) error {
	return runContextWithIO(os.Stdout, args)
}

func runContextWithIO(w io.Writer, args []string) error {
	flags := flag.NewFlagSet("context", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var repoPath string
	var jsonMode bool
	var compareClients string
	var searchQuery string
	var help bool

	flags.StringVar(&repoPath, "repo", "", "repo path (defaults to git root)")
	flags.BoolVar(&jsonMode, "json", false, "output context resolution as JSON")
	flags.StringVar(&compareClients, "compare", "", "compare two clients (comma-separated)")
	flags.StringVar(&searchQuery, "search", "", "search across instruction files")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}

	if help {
		printContextUsage(w)
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
		return runContextJSON(w, repoRoot, targetPath, compareClients, searchQuery)
	}

	return tui.Start(repoRoot)
}

func printContextUsage(w io.Writer) {
	_, _ = fmt.Fprint(w, contextUsage)
}

func runContextJSON(w io.Writer, repoRoot, targetPath, compare, search string) error {
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

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return err
	}

	engine := context_pkg.NewEngine()
	clients := instructions.AllClients()

	res, err := engine.ResolveContext(context.Background(), context_pkg.ResolveOptions{
		RepoRoot: repoRoot,
		FilePath: relPath,
		Clients:  clients,
		Registry: &registry,
	})
	if err != nil {
		return err
	}

	var searchResults []context_pkg.SearchResult
	if search != "" {
		searchResults, err = context_pkg.SearchInstructions(repoRoot, registry, search)
		if err != nil {
			return err
		}
	}

	if compare != "" {
		parts := strings.Split(compare, ",")
		if len(parts) != 2 {
			return fmt.Errorf("compare flag requires exactly two clients (comma-separated)")
		}

		clientA, err := instructions.ParseClient(parts[0])
		if err != nil {
			return err
		}
		clientB, err := instructions.ParseClient(parts[1])
		if err != nil {
			return err
		}

		resA, okA := res.Results[clientA]
		resB, okB := res.Results[clientB]
		if !okA || !okB {
			return fmt.Errorf("requested clients for comparison not found in results")
		}

		diff := context_pkg.DiffResolutions(resA.Resolution, resB.Resolution)
		return context_pkg.WriteJSONWithFullResults(w, res, &diff, searchResults)
	}

	return context_pkg.WriteJSONWithFullResults(w, res, nil, searchResults)
}
