// Package main implements the markdowntown CLI.
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/git"
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/version"
)

const rootUsage = `markdowntown

Usage:
  markdowntown                     # Show help (no default command)
  markdowntown scan [flags]        # Scan for AI config files
  markdowntown audit [flags]       # Audit scan results and report issues
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

const auditUsage = `markdowntown audit

Usage:
  markdowntown audit [flags]

Flags:
  --input <path|->      Read scan JSON from file or stdin
  --format <json|md>    Output format (default: json)
  --compact             Emit compact JSON (no indentation)
  --ignore-rule <id>    Suppress a rule by ID (repeatable)
  --exclude <glob>      Exclude matching paths (repeatable)
  --repo <path>         Repo path (defaults to git root from cwd)
  --repo-only           Exclude user scope; scan repo only
  --stdin               Read additional paths from stdin (one per line)
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
	case "audit":
		code, err := runAudit(args[1:])
		if err != nil {
			fmt.Fprintln(os.Stderr, err.Error())
			if code == 0 {
				code = 2
			}
			os.Exit(code)
		}
		if code != 0 {
			os.Exit(code)
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
	result, err = scan.ApplyGitignore(result, repoRoot)
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

func runAudit(args []string) (int, error) {
	flags := flag.NewFlagSet("audit", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var input string
	var format string
	var compact bool
	var repoPath string
	var repoOnly bool
	var readStdin bool
	var help bool
	var ignoreRules stringList
	var excludePaths stringList

	flags.StringVar(&input, "input", "", "scan JSON input file or '-' for stdin")
	flags.StringVar(&format, "format", "json", "output format (json|md)")
	flags.BoolVar(&compact, "compact", false, "emit compact JSON")
	flags.Var(&ignoreRules, "ignore-rule", "suppress rule by ID (repeatable)")
	flags.Var(&excludePaths, "exclude", "exclude matching paths (repeatable)")
	flags.StringVar(&repoPath, "repo", "", "repo path (defaults to git root)")
	flags.BoolVar(&repoOnly, "repo-only", false, "exclude user scope")
	flags.BoolVar(&readStdin, "stdin", false, "read additional paths from stdin")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		printAuditUsage(os.Stderr)
		return 2, err
	}

	if help {
		printAuditUsage(os.Stdout)
		return 0, nil
	}

	if flags.NArg() > 0 {
		return 2, fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}

	format = strings.ToLower(format)
	if format != "json" && format != "md" {
		return 2, fmt.Errorf("invalid format: %s", format)
	}

	if input != "" && readStdin {
		return 2, fmt.Errorf("--input and --stdin cannot be combined")
	}

	var scanOutput scan.Output
	var err error
	if input != "" {
		scanOutput, err = readScanInput(input)
	} else {
		scanOutput, err = runAuditScan(repoPath, repoOnly, readStdin)
	}
	if err != nil {
		return 2, err
	}

	engine := audit.Engine{
		Rules: audit.DefaultRules(),
		Filters: audit.FilterOptions{
			IgnoreRules:  []string(ignoreRules),
			ExcludePaths: []string(excludePaths),
		},
	}
	output, err := engine.Run(scanOutput)
	if err != nil {
		return 2, err
	}

	exitCode := auditExitCode(output)
	if format == "md" {
		if err := audit.RenderMarkdown(os.Stdout, output); err != nil {
			return 2, err
		}
		return exitCode, nil
	}

	enc := json.NewEncoder(os.Stdout)
	if !compact {
		enc.SetIndent("", "  ")
	}
	enc.SetEscapeHTML(false)
	if err := enc.Encode(output); err != nil {
		return 2, err
	}
	return exitCode, nil
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

func printAuditUsage(w io.Writer) {
	_, _ = fmt.Fprint(w, auditUsage)
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

func readScanInput(path string) (scan.Output, error) {
	var data []byte
	var err error
	if path == "-" {
		data, err = io.ReadAll(os.Stdin)
	} else {
		data, err = os.ReadFile(path)
	}
	if err != nil {
		return scan.Output{}, err
	}
	if len(bytes.TrimSpace(data)) == 0 {
		return scan.Output{}, fmt.Errorf("scan input is empty")
	}
	var output scan.Output
	if err := json.Unmarshal(data, &output); err != nil {
		return scan.Output{}, err
	}
	return output, nil
}

func runAuditScan(repoPath string, repoOnly bool, readStdin bool) (scan.Output, error) {
	repoRoot, err := resolveRepoRoot(repoPath)
	if err != nil {
		return scan.Output{}, err
	}

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return scan.Output{}, err
	}

	stdinPaths, err := readStdinPaths(readStdin)
	if err != nil {
		return scan.Output{}, err
	}

	progress, finish := progressReporter(true)
	startedAt := time.Now()
	result, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		RepoOnly:       repoOnly,
		IncludeContent: false,
		Progress:       progress,
		StdinPaths:     stdinPaths,
		Registry:       registry,
	})
	finish()
	if err != nil {
		return scan.Output{}, err
	}
	result, err = scan.ApplyGitignore(result, repoRoot)
	if err != nil {
		return scan.Output{}, err
	}
	finishedAt := time.Now()

	timing := scan.Timing{
		DiscoveryMs: elapsedMs(startedAt, finishedAt),
		HashingMs:   0,
		GitignoreMs: 0,
		TotalMs:     elapsedMs(startedAt, finishedAt),
	}

	return scan.BuildOutput(result, scan.OutputOptions{
		SchemaVersion:   version.SchemaVersion,
		RegistryVersion: registry.Version,
		ToolVersion:     version.ToolVersion,
		RepoRoot:        repoRoot,
		ScanStartedAt:   startedAt.UnixMilli(),
		GeneratedAt:     finishedAt.UnixMilli(),
		Timing:          timing,
	}), nil
}

func auditExitCode(output audit.Output) int {
	for _, issue := range output.Issues {
		if issue.Severity == audit.SeverityError {
			return 1
		}
	}
	return 0
}

type stringList []string

func (s *stringList) String() string {
	return strings.Join(*s, ",")
}

func (s *stringList) Set(value string) error {
	*s = append(*s, value)
	return nil
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
