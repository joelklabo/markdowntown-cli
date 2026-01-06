// Package main implements the markdowntown CLI.
package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/engine"
	"markdowntown-cli/internal/git"
	"markdowntown-cli/internal/lsp"
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/version"

	"github.com/spf13/afero"
)

const rootUsage = `markdowntown

Usage:
  markdowntown                     # Show help (no default command)
  markdowntown login               # Authenticate via token or device flow
  markdowntown logout              # Clear stored authentication credentials
  markdowntown sync upload [flags] # Upload snapshot to the web app
  markdowntown pull [flags]        # Pull and apply patches from the web app
  markdowntown scan [flags]        # Scan for AI config files
  markdowntown scan-remote [flags] # Scan a remote git repository
  markdowntown suggest [flags]     # Generate evidence-backed suggestions
  markdowntown resolve [flags]     # Resolve effective instruction chain
  markdowntown audit [flags]       # Audit scan results
  markdowntown serve               # Start LSP server
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
  --global-scope        Include global/system scope roots (e.g., /etc)
  --global-max-files <n> Max files to scan in global scope (0 = unlimited)
  --global-max-bytes <n> Max bytes to scan in global scope (0 = unlimited)
  --global-xdev         Do not cross filesystem boundaries in global scope
  --scan-workers <n>    Parallel scan workers (0 = auto)
  --stdin               Read additional paths from stdin (one per line)
  --include-content     Include file contents in output (default)
  --no-content          Exclude file contents from output
  --format <json|jsonl> Output format (default: json)
  --jsonl               Emit JSONL output (alias for --format jsonl)
  --compact             Emit compact JSON (ignored for jsonl)
  --quiet               Disable progress output
  --for-file <path>     Filter output to configs applicable to path
  -h, --help            Show help
`

const scanRemoteUsage = `markdowntown scan-remote

Usage:
  markdowntown scan-remote <url> [flags]

Flags:
  --ref <ref>           Git reference (branch, tag, commit) to checkout
  --repo-only           Exclude user scope; scan repo only
  --global-scope        Include global/system scope roots (e.g., /etc)
  --global-max-files <n> Max files to scan in global scope (0 = unlimited)
  --global-max-bytes <n> Max bytes to scan in global scope (0 = unlimited)
  --global-xdev         Do not cross filesystem boundaries in global scope
  --scan-workers <n>    Parallel scan workers (0 = auto)
  --include-content     Include file contents in output (default)
  --no-content          Exclude file contents from output
  --format <json|jsonl> Output format (default: json)
  --jsonl               Emit JSONL output (alias for --format jsonl)
  --compact             Emit compact JSON (ignored for jsonl)
  --quiet               Disable progress output
  -h, --help            Show help
`

const auditUsage = `markdowntown audit

Usage:
  markdowntown audit [flags]

Flags:
  --input <path>            Read scan JSON from file or - for stdin
  --format <json|md>        Output format (default: json)
  --compact                 Emit compact JSON (ignored for md)
  --fail-severity <level>   Exit 1 when issues at/above severity (error|warning|info)
  --redact <mode>           Path redaction mode (auto|always|never)
  --only <ruleId>           Run only these rule IDs (repeatable)
  --ignore-rule <ruleId>    Suppress rule IDs (repeatable)
  --exclude <glob>          Exclude paths from audit matching (repeatable)
  --include-scan-warnings   Include raw scan warnings in output
  --repo <path>             Repo path (defaults to git root)
  --repo-only               Exclude user scope when running internal scan
  --global-scope            Include global/system scope roots (e.g., /etc)
  --global-max-files <n>    Max files to scan in global scope (0 = unlimited)
  --global-max-bytes <n>    Max bytes to scan in global scope (0 = unlimited)
  --global-xdev             Do not cross filesystem boundaries in global scope
  --scan-workers <n>        Parallel scan workers (0 = auto)
  --stdin                   Read additional scan roots from stdin
  --no-content              Exclude file contents from internal scan
  -h, --help                Show help
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
		if err := git.ValidateGitVersion(); err != nil {
			exitWithError(err)
		}
		if err := runScan(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "login":
		if err := runLogin(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "logout":
		if err := runLogout(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "sync":
		if err := git.ValidateGitVersion(); err != nil {
			exitWithError(err)
		}
		cmd := newSyncCmd()
		cmd.SetArgs(args[1:])
		if err := cmd.Execute(); err != nil {
			exitWithError(err)
		}
		return
	case "pull":
		if err := git.ValidateGitVersion(); err != nil {
			exitWithError(err)
		}
		if err := runPull(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "scan-remote":
		if err := git.ValidateGitVersion(); err != nil {
			exitWithError(err)
		}
		if err := runScanRemote(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "suggest":
		if err := runSuggest(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "resolve":
		if err := runResolve(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "audit":
		if err := runAudit(args[1:]); err != nil {
			exitWithError(err)
		}
		return
	case "serve":
		if err := runServe(args[1:]); err != nil {
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
	var globalScope bool
	var globalMaxFiles int
	var globalMaxBytes int64
	var globalXDev bool
	var scanWorkers int
	var readStdin bool
	var includeContent bool
	var noContent bool
	var format string
	var jsonl bool
	var compact bool
	var quiet bool
	var help bool
	var forFile string

	flags.StringVar(&repoPath, "repo", "", "repo path (defaults to git root)")
	flags.BoolVar(&repoOnly, "repo-only", false, "exclude user scope")
	flags.BoolVar(&globalScope, "global-scope", false, "include global/system scope roots")
	flags.IntVar(&globalMaxFiles, "global-max-files", 0, "max files to scan in global scope (0 = unlimited)")
	flags.Int64Var(&globalMaxBytes, "global-max-bytes", 0, "max bytes to scan in global scope (0 = unlimited)")
	flags.BoolVar(&globalXDev, "global-xdev", false, "do not cross filesystem boundaries in global scope")
	flags.IntVar(&scanWorkers, "scan-workers", 0, "parallel scan workers (0 = auto)")
	flags.BoolVar(&readStdin, "stdin", false, "read additional paths from stdin")
	flags.BoolVar(&includeContent, "include-content", true, "include file contents")
	flags.BoolVar(&noContent, "no-content", false, "exclude file contents")
	flags.StringVar(&format, "format", "json", "output format (json or jsonl)")
	flags.BoolVar(&jsonl, "jsonl", false, "emit JSONL output")
	flags.BoolVar(&compact, "compact", false, "emit compact JSON")
	flags.BoolVar(&quiet, "quiet", false, "disable progress output")
	flags.StringVar(&forFile, "for-file", "", "filter output to configs applicable to path")
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
	if globalMaxFiles < 0 {
		return fmt.Errorf("global-max-files must be >= 0")
	}
	if globalMaxBytes < 0 {
		return fmt.Errorf("global-max-bytes must be >= 0")
	}
	if globalScope && runtime.GOOS == "windows" {
		_, _ = fmt.Fprintln(os.Stderr, "warning: --global-scope is not supported on Windows")
	}

	if jsonl {
		format = "jsonl"
	}
	format = strings.ToLower(format)
	if format != "json" && format != "jsonl" {
		return fmt.Errorf("invalid format: %s", format)
	}

	repoRoot, err := resolveRepoRoot(repoPath)
	if err != nil {
		return err
	}
	if noContent {
		includeContent = false
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
		IncludeGlobal:  globalScope,
		IncludeContent: includeContent,
		ScanWorkers:    scanWorkers,
		GlobalMaxFiles: globalMaxFiles,
		GlobalMaxBytes: globalMaxBytes,
		GlobalXDev:     globalXDev,
		Progress:       progress,
		StdinPaths:     stdinPaths,
		Registry:       registry,
		Fs:             afero.NewOsFs(),
	})
	finish()
	if err != nil {
		return err
	}
	result, err = scan.ApplyGitignore(result, repoRoot)
	if err != nil {
		return err
	}

	if forFile != "" {
		result = scan.FilterForFile(result, forFile)
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

	return scan.WriteOutput(os.Stdout, output, format, compact)
}

func runScanRemote(args []string) error {
	flags := flag.NewFlagSet("scan-remote", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var ref string
	var repoOnly bool
	var globalScope bool
	var globalMaxFiles int
	var globalMaxBytes int64
	var globalXDev bool
	var scanWorkers int
	var includeContent bool
	var noContent bool
	var format string
	var jsonl bool
	var compact bool
	var quiet bool
	var help bool

	flags.StringVar(&ref, "ref", "", "git reference to checkout")
	flags.BoolVar(&repoOnly, "repo-only", false, "exclude user scope")
	flags.BoolVar(&globalScope, "global-scope", false, "include global/system scope roots")
	flags.IntVar(&globalMaxFiles, "global-max-files", 0, "max files to scan in global scope (0 = unlimited)")
	flags.Int64Var(&globalMaxBytes, "global-max-bytes", 0, "max bytes to scan in global scope (0 = unlimited)")
	flags.BoolVar(&globalXDev, "global-xdev", false, "do not cross filesystem boundaries in global scope")
	flags.IntVar(&scanWorkers, "scan-workers", 0, "parallel scan workers (0 = auto)")
	flags.BoolVar(&includeContent, "include-content", true, "include file contents")
	flags.BoolVar(&noContent, "no-content", false, "exclude file contents")
	flags.StringVar(&format, "format", "json", "output format (json or jsonl)")
	flags.BoolVar(&jsonl, "jsonl", false, "emit JSONL output")
	flags.BoolVar(&compact, "compact", false, "emit compact JSON")
	flags.BoolVar(&quiet, "quiet", false, "disable progress output")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}

	if help {
		printScanRemoteUsage(os.Stdout)
		return nil
	}

	if flags.NArg() != 1 {
		return fmt.Errorf("git URL required")
	}
	if globalMaxFiles < 0 {
		return fmt.Errorf("global-max-files must be >= 0")
	}
	if globalMaxBytes < 0 {
		return fmt.Errorf("global-max-bytes must be >= 0")
	}
	if globalScope && runtime.GOOS == "windows" {
		_, _ = fmt.Fprintln(os.Stderr, "warning: --global-scope is not supported on Windows")
	}
	url := flags.Arg(0)

	if jsonl {
		format = "jsonl"
	}
	format = strings.ToLower(format)
	if format != "json" && format != "jsonl" {
		return fmt.Errorf("invalid format: %s", format)
	}

	repoRoot, cleanup, err := scan.CloneToTemp(url, ref)
	if err != nil {
		return err
	}
	defer cleanup()

	if noContent {
		includeContent = false
	}

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return err
	}

	progress, finish := progressReporter(!quiet)
	startedAt := time.Now()
	result, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		RepoOnly:       repoOnly,
		IncludeGlobal:  globalScope,
		IncludeContent: includeContent,
		ScanWorkers:    scanWorkers,
		GlobalMaxFiles: globalMaxFiles,
		GlobalMaxBytes: globalMaxBytes,
		GlobalXDev:     globalXDev,
		Progress:       progress,
		Registry:       registry,
		Fs:             afero.NewOsFs(),
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
		RepoRoot:        repoRoot, // Using temp dir as root so relative paths are correct
		ScanStartedAt:   startedAt.UnixMilli(),
		GeneratedAt:     finishedAt.UnixMilli(),
		Timing:          timing,
	})

	return scan.WriteOutput(os.Stdout, output, format, compact)
}

func runServe(_ []string) error {
	// Keep stdout reserved for JSON-RPC; commonlog already writes to stderr.
	return lsp.RunServer(version.ToolVersion)
}

func runAudit(args []string) error {
	opts, err := parseAuditFlags(args)
	if err != nil {
		return newCLIError(err, 2)
	}
	if opts.help {
		printAuditUsage(os.Stdout)
		return nil
	}

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return newCLIError(err, 2)
	}

	auditStartedAt := time.Now()
	scanOutput, err := loadAuditInput(opts, registry)
	if err != nil {
		return newCLIError(err, 2)
	}

	auditOutput, threshold, err := executeAudit(scanOutput, registry, opts, auditStartedAt)
	if err != nil {
		return newCLIError(err, 2)
	}

	if err := renderAuditOutput(auditOutput, opts); err != nil {
		return newCLIError(err, 2)
	}

	if audit.ShouldFail(auditOutput.Issues, threshold) {
		os.Exit(1)
	}
	return nil
}

type auditOptions struct {
	inputPath           string
	format              string
	compact             bool
	failSeverity        string
	redactMode          string
	includeScanWarnings bool
	repoPath            string
	repoOnly            bool
	globalScope         bool
	globalMaxFiles      int
	globalMaxBytes      int64
	globalXDev          bool
	scanWorkers         int
	readStdin           bool
	noContent           bool
	help                bool
	onlyRules           stringList
	ignoreRules         stringList
	excludePaths        stringList
}

func parseAuditFlags(args []string) (*auditOptions, error) {
	opts := &auditOptions{}
	flags := flag.NewFlagSet("audit", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	flags.StringVar(&opts.inputPath, "input", "", "read scan JSON from file or stdin (-)")
	flags.StringVar(&opts.format, "format", "json", "output format (json or md)")
	flags.BoolVar(&opts.compact, "compact", false, "emit compact JSON")
	flags.StringVar(&opts.failSeverity, "fail-severity", string(audit.SeverityError), "exit 1 when issues meet severity (error|warning|info)")
	flags.StringVar(&opts.redactMode, "redact", string(audit.RedactAuto), "path redaction mode (auto|always|never)")
	flags.Var(&opts.onlyRules, "only", "rule IDs to include (repeatable)")
	flags.Var(&opts.ignoreRules, "ignore-rule", "rule IDs to suppress (repeatable)")
	flags.Var(&opts.excludePaths, "exclude", "exclude path globs from audit matching (repeatable)")
	flags.BoolVar(&opts.includeScanWarnings, "include-scan-warnings", false, "include raw scan warnings")
	flags.StringVar(&opts.repoPath, "repo", "", "repo path (defaults to git root)")
	flags.BoolVar(&opts.repoOnly, "repo-only", false, "exclude user scope")
	flags.BoolVar(&opts.globalScope, "global-scope", false, "include global/system scope roots")
	flags.IntVar(&opts.globalMaxFiles, "global-max-files", 0, "max files to scan in global scope (0 = unlimited)")
	flags.Int64Var(&opts.globalMaxBytes, "global-max-bytes", 0, "max bytes to scan in global scope (0 = unlimited)")
	flags.BoolVar(&opts.globalXDev, "global-xdev", false, "do not cross filesystem boundaries in global scope")
	flags.IntVar(&opts.scanWorkers, "scan-workers", 0, "parallel scan workers (0 = auto)")
	flags.BoolVar(&opts.readStdin, "stdin", false, "read additional paths from stdin")
	flags.BoolVar(&opts.noContent, "no-content", false, "exclude file contents from internal scan")
	flags.BoolVar(&opts.help, "help", false, "show help")
	flags.BoolVar(&opts.help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return nil, err
	}
	if opts.help {
		return opts, nil
	}
	if flags.NArg() > 0 {
		return nil, fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}
	if opts.globalMaxFiles < 0 {
		return nil, fmt.Errorf("global-max-files must be >= 0")
	}
	if opts.globalMaxBytes < 0 {
		return nil, fmt.Errorf("global-max-bytes must be >= 0")
	}
	if opts.globalScope && runtime.GOOS == "windows" {
		_, _ = fmt.Fprintln(os.Stderr, "warning: --global-scope is not supported on Windows")
	}
	if opts.inputPath != "" && (opts.repoPath != "" || opts.repoOnly || opts.readStdin) {
		return nil, fmt.Errorf("--input cannot be combined with scan flags")
	}
	opts.format = strings.ToLower(opts.format)
	if opts.format != "json" && opts.format != "md" {
		return nil, fmt.Errorf("invalid format: %s", opts.format)
	}

	return opts, nil
}

func loadAuditInput(opts *auditOptions, registry scan.Registry) (scan.Output, error) {
	var scanOutput scan.Output
	var err error

	if opts.inputPath != "" {
		scanOutput, err = readScanInput(opts.inputPath)
		if err != nil {
			return scanOutput, err
		}
	} else {
		repoRoot, err := resolveRepoRoot(opts.repoPath)
		if err != nil {
			return scanOutput, err
		}
		stdinPaths, err := readStdinPaths(opts.readStdin)
		if err != nil {
			return scanOutput, err
		}

		progress, finish := progressReporter(true)
		scanStartedAt := time.Now()
		result, err := scan.Scan(scan.Options{
			RepoRoot:       repoRoot,
			RepoOnly:       opts.repoOnly,
			IncludeGlobal:  opts.globalScope,
			IncludeContent: !opts.noContent,
			ScanWorkers:    opts.scanWorkers,
			GlobalMaxFiles: opts.globalMaxFiles,
			GlobalMaxBytes: opts.globalMaxBytes,
			GlobalXDev:     opts.globalXDev,
			Progress:       progress,
			StdinPaths:     stdinPaths,
			Registry:       registry,
			Fs:             afero.NewOsFs(),
		})
		finish()
		if err != nil {
			return scanOutput, err
		}

		result, err = scan.ApplyGitignore(result, repoRoot)
		if err != nil {
			return scanOutput, err
		}
		scanFinishedAt := time.Now()

		timing := scan.Timing{
			DiscoveryMs: elapsedMs(scanStartedAt, scanFinishedAt),
			HashingMs:   0,
			GitignoreMs: 0,
			TotalMs:     elapsedMs(scanStartedAt, scanFinishedAt),
		}

		scanOutput = scan.BuildOutput(result, scan.OutputOptions{
			SchemaVersion:   version.SchemaVersion,
			RegistryVersion: registry.Version,
			ToolVersion:     version.ToolVersion,
			RepoRoot:        repoRoot,
			ScanStartedAt:   scanStartedAt.UnixMilli(),
			GeneratedAt:     scanFinishedAt.UnixMilli(),
			Timing:          timing,
		})
	}

	return audit.FilterOutput(scanOutput, []string(opts.excludePaths))
}

func executeAudit(scanOutput scan.Output, registry scan.Registry, opts *auditOptions, startedAt time.Time) (audit.Output, audit.Severity, error) {
	threshold, err := audit.ParseSeverity(opts.failSeverity)
	if err != nil {
		return audit.Output{}, threshold, err
	}
	redact, err := audit.ParseRedactMode(opts.redactMode)
	if err != nil {
		return audit.Output{}, threshold, err
	}

	rules, err := audit.FilterRules(audit.DefaultRules(), []string(opts.onlyRules), []string(opts.ignoreRules))
	if err != nil {
		return audit.Output{}, threshold, err
	}

	homeDir, _ := os.UserHomeDir()
	xdgConfigHome := os.Getenv("XDG_CONFIG_HOME")
	if xdgConfigHome == "" && homeDir != "" {
		xdgConfigHome = filepath.Join(homeDir, ".config")
	}

	redactor := audit.NewRedactor(scanOutput.RepoRoot, homeDir, xdgConfigHome, redact)
	issues := engine.Run(audit.Context{
		Scan:     scanOutput,
		Registry: registry,
		Redactor: redactor,
	}, rules)

	normalizer := audit.NewEngine(redactor)
	issues = normalizer.NormalizeIssues(issues)

	summary := audit.BuildSummary(issues)
	generatedAt := time.Now()

	output := audit.Output{
		SchemaVersion:       version.AuditSchemaVersion,
		Audit:               audit.Meta{ToolVersion: version.ToolVersion, AuditStartedAt: startedAt.UnixMilli(), GeneratedAt: generatedAt.UnixMilli()},
		SourceScan:          audit.SourceScan{SchemaVersion: scanOutput.SchemaVersion, ToolVersion: scanOutput.ToolVersion, RegistryVersion: scanOutput.RegistryVersion, RepoRoot: scanOutput.RepoRoot, ScanStartedAt: scanOutput.ScanStartedAt, GeneratedAt: scanOutput.GeneratedAt, Scans: scanOutput.Scans},
		RegistryVersionUsed: registry.Version,
		PathRedaction:       audit.RedactionInfo{Mode: redact, Enabled: redact != audit.RedactNever},
		Summary:             summary,
		Issues:              issues,
	}
	if opts.includeScanWarnings {
		output.ScanWarnings = audit.BuildScanWarnings(scanOutput.Warnings, issues, redactor, scanOutput.RepoRoot)
	}

	return output, threshold, nil
}

func renderAuditOutput(output audit.Output, opts *auditOptions) error {
	switch opts.format {
	case "md":
		_, _ = fmt.Fprint(os.Stdout, audit.RenderMarkdown(output))
	default:
		enc := json.NewEncoder(os.Stdout)
		if !opts.compact {
			enc.SetIndent("", "  ")
		}
		enc.SetEscapeHTML(false)
		if err := enc.Encode(output); err != nil {
			return err
		}
	}
	return nil
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
	code := 1
	if err != nil {
		var cliErr *cliError
		if errors.As(err, &cliErr) {
			code = cliErr.code
			err = cliErr.err
		}
		fmt.Fprintln(os.Stderr, err.Error())
	}
	printUsage(os.Stderr)
	os.Exit(code)
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

func printAuditUsage(w io.Writer) {
	_, _ = fmt.Fprint(w, auditUsage)
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

func printScanRemoteUsage(w io.Writer) {
	_, _ = fmt.Fprint(w, scanRemoteUsage)
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

type cliError struct {
	err  error
	code int
}

func (e *cliError) Error() string {
	if e == nil || e.err == nil {
		return ""
	}
	return e.err.Error()
}

func newCLIError(err error, code int) error {
	if err == nil {
		return nil
	}
	return &cliError{err: err, code: code}
}

type stringList []string

func (s *stringList) String() string {
	return strings.Join(*s, ",")
}

func (s *stringList) Set(value string) error {
	parts := strings.Split(value, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		*s = append(*s, part)
	}
	return nil
}

func readScanInput(inputPath string) (scan.Output, error) {
	var output scan.Output
	var data []byte
	var err error

	if inputPath == "-" {
		data, err = io.ReadAll(os.Stdin)
		if err != nil {
			return output, err
		}
		if len(strings.TrimSpace(string(data))) == 0 {
			return output, fmt.Errorf("stdin is empty")
		}
	} else {
		// #nosec G304 -- input path is provided by the user or CLI flag.
		data, err = os.ReadFile(inputPath)
		if err != nil {
			return output, err
		}
	}

	if err := json.Unmarshal(data, &output); err != nil {
		return output, err
	}
	if output.SchemaVersion == "" {
		return output, fmt.Errorf("scan schemaVersion is required")
	}
	if output.SchemaVersion != version.SchemaVersion {
		return output, fmt.Errorf("unsupported scan schemaVersion: %s", output.SchemaVersion)
	}
	return output, nil
}
