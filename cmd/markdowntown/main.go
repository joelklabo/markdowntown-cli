// Package main implements the markdowntown CLI.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"markdowntown-cli/internal/git"
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

const scanUsage = `markdowntown scan

Usage:
  markdowntown scan [flags]

Flags:
  --repo <path>         Repo path (defaults to git root from cwd)
  --repo-only           Exclude user scope; scan repo only
  --stdin               Read additional paths from stdin (one per line)
  --include-content     Include file contents in output
  --compact             Emit compact JSON (no indentation)
  --quiet               Disable progress output
  -h, --help            Show help
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

func runScan(args []string) error {
	flags := flag.NewFlagSet("scan", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var repoPath string
	var repoOnly bool
	var readStdin bool
	var includeContent bool
	var compact bool
	var quiet bool
	var help bool

	flags.StringVar(&repoPath, "repo", "", "repo path (defaults to git root)")
	flags.BoolVar(&repoOnly, "repo-only", false, "exclude user scope")
	flags.BoolVar(&readStdin, "stdin", false, "read additional paths from stdin")
	flags.BoolVar(&includeContent, "include-content", false, "include file contents")
	flags.BoolVar(&compact, "compact", false, "emit compact JSON")
	flags.BoolVar(&quiet, "quiet", false, "disable progress output")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}

	if help {
		printScanUsage(os.Stdout)
		return nil
	}

	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}

	repoRoot, err := resolveRepoRoot(repoPath)
	if err != nil {
		return err
	}

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return err
	}

	stdinPaths, err := readStdinPaths(readStdin)
	if err != nil {
		return err
	}

	progress, finish := progressReporter(!quiet)
	startedAt := time.Now()
	result, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		RepoOnly:       repoOnly,
		IncludeContent: includeContent,
		Progress:       progress,
		StdinPaths:     stdinPaths,
		Registry:       registry,
	})
	finish()
	if err != nil {
		return err
	}
	finishedAt := time.Now()

	timing := scan.Timing{
		DiscoveryMs: elapsedMs(startedAt, finishedAt),
		HashingMs:   0,
		GitignoreMs: 0,
		TotalMs:     elapsedMs(startedAt, finishedAt),
	}

	output := scan.BuildOutput(result, scan.OutputOptions{
		SchemaVersion:   version.SchemaVersion,
		RegistryVersion: registry.Version,
		ToolVersion:     version.ToolVersion,
		RepoRoot:        repoRoot,
		ScanStartedAt:   startedAt.UnixMilli(),
		GeneratedAt:     finishedAt.UnixMilli(),
		Timing:          timing,
	})

	enc := json.NewEncoder(os.Stdout)
	if !compact {
		enc.SetIndent("", "  ")
	}
	enc.SetEscapeHTML(false)
	return enc.Encode(output)
}

func runRegistry(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("registry subcommand required")
	}
	if args[0] != "validate" {
		return fmt.Errorf("unknown registry subcommand: %s", args[0])
	}
	return runRegistryValidate()
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

func runRegistryValidate() error {
	path, err := scan.ResolveRegistryPath()
	if err != nil {
		return err
	}

	data, err := scan.ReadRegistryFile(path)
	if err != nil {
		return err
	}

	result := scan.ValidateRegistry(path, data)
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	if err := enc.Encode(result); err != nil {
		return err
	}

	if !result.Valid {
		os.Exit(1)
	}
	return nil
}

func printScanUsage(w io.Writer) {
	_, _ = fmt.Fprint(w, scanUsage)
}

func resolveRepoRoot(repoPath string) (string, error) {
	if repoPath != "" {
		return git.Root(repoPath)
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return git.Root(cwd)
}

func readStdinPaths(enabled bool) ([]string, error) {
	if !enabled {
		return nil, nil
	}
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var paths []string
	for scanner.Scan() {
		paths = append(paths, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return paths, nil
}

func progressReporter(enabled bool) (func(string), func()) {
	if !enabled || !isTerminal(os.Stdout) {
		return nil, func() {}
	}
	width := terminalWidth()
	prefix := "Scanning: "
	lastLen := 0
	write := func(path string) {
		maxPath := width - len(prefix)
		msg := prefix + truncateLeft(path, maxPath)
		if lastLen > len(msg) {
			msg += strings.Repeat(" ", lastLen-len(msg))
		}
		lastLen = len(msg)
		_, _ = fmt.Fprintf(os.Stderr, "\r%s", msg)
	}
	finish := func() {
		if lastLen == 0 {
			return
		}
		padding := strings.Repeat(" ", lastLen)
		_, _ = fmt.Fprintf(os.Stderr, "\r%s\r", padding)
	}
	return write, finish
}

func truncateLeft(value string, limit int) string {
	if limit <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	if limit <= 3 {
		return string(runes[len(runes)-limit:])
	}
	return "..." + string(runes[len(runes)-(limit-3):])
}

func isTerminal(file *os.File) bool {
	info, err := file.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
}

func terminalWidth() int {
	if cols := os.Getenv("COLUMNS"); cols != "" {
		if width, err := strconv.Atoi(cols); err == nil && width > 0 {
			return width
		}
	}
	return 80
}

func elapsedMs(start time.Time, end time.Time) int64 {
	if end.Before(start) {
		return 0
	}
	return end.Sub(start).Milliseconds()
}
