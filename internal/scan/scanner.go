package scan

import (
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	scanhash "markdowntown-cli/internal/hash"

	"github.com/spf13/afero"
)

// Options configures the discovery scan.
type Options struct {
	RepoRoot       string
	RepoOnly       bool
	IncludeContent bool
	Progress       func(string)
	UserRoots      []string
	StdinPaths     []string
	Registry       Registry
	Patterns       []CompiledPattern
	Fs             afero.Fs
}

// Result collects discovered entries and warnings.
type Result struct {
	Scans    []Root
	Entries  []ConfigEntry
	Warnings []Warning
}

// Scan discovers files across repo/user scopes and stdin paths.
func Scan(opts Options) (Result, error) {
	var result Result

	if strings.TrimSpace(opts.RepoRoot) == "" {
		return result, fmt.Errorf("repo root required")
	}

	fs := opts.Fs
	if fs == nil {
		fs = afero.NewOsFs()
	}

	patterns := opts.Patterns
	if len(patterns) == 0 {
		if len(opts.Registry.Patterns) == 0 {
			return result, fmt.Errorf("registry patterns required")
		}
		compiled, err := CompilePatterns(opts.Registry)
		if err != nil {
			return result, err
		}
		patterns = compiled
	}

	repoRoot, err := filepath.Abs(opts.RepoRoot)
	if err != nil {
		return result, err
	}
	repoRoot = filepath.Clean(repoRoot)

	entries := make(map[string]*ConfigEntry)

	var userRootsAbs []string

	repoInfo, repoErr := fs.Stat(repoRoot)
	repoExists := repoErr == nil && repoInfo.IsDir()
	result.Scans = append(result.Scans, Root{Scope: "repo", Root: repoRoot, Exists: repoExists})
	if repoErr != nil && !os.IsNotExist(repoErr) {
		result.Warnings = append(result.Warnings, warningForError(repoRoot, repoErr))
	}
	if repoExists {
		walkState := newWalkState(fs, repoRoot, opts.IncludeContent, opts.Progress)
		scanDir(repoRoot, repoRoot, repoRoot, "repo", repoInfo, patterns, entries, &result, walkState, false, false)
	}

	if !opts.RepoOnly {
		userRoots := opts.UserRoots
		if len(userRoots) == 0 {
			userRoots = DefaultUserRoots()
		}
		for _, root := range userRoots {
			root = expandHomePath(root)
			absRoot, err := filepath.Abs(root)
			if err != nil {
				result.Warnings = append(result.Warnings, warningForError(root, err))
				continue
			}
			absRoot = filepath.Clean(absRoot)
			userRootsAbs = append(userRootsAbs, absRoot)
			info, statErr := fs.Stat(absRoot)
			exists := statErr == nil && info.IsDir()
			result.Scans = append(result.Scans, Root{Scope: "user", Root: absRoot, Exists: exists})
			if statErr != nil && !os.IsNotExist(statErr) {
				result.Warnings = append(result.Warnings, warningForError(absRoot, statErr))
			}
			if !exists {
				continue
			}
			walkState := newWalkState(fs, absRoot, opts.IncludeContent, opts.Progress)
			scanDir(absRoot, absRoot, absRoot, "user", info, patterns, entries, &result, walkState, false, false)
		}
	}

	for _, stdinPath := range opts.StdinPaths {
		stdinPath = strings.TrimSpace(stdinPath)
		if stdinPath == "" {
			continue
		}
		path := expandHomePath(stdinPath)
		absPath, err := filepath.Abs(path)
		if err != nil {
			result.Warnings = append(result.Warnings, warningForError(path, err))
			continue
		}
		info, err := fs.Stat(absPath) // Was Lstat, but afero might not have Lstat?
		// We'll address Lstat later. For now fs.Stat.
		// Wait, we need Lstat for symlinks.
		// If fs is OsFs, we can use os.Lstat? No, must use fs.
		// afero.Lstater check.
		if err != nil {
			result.Warnings = append(result.Warnings, warningForError(absPath, err))
			continue
		}
		scope, root := resolveScopeAndRoot(absPath, repoRoot, userRootsAbs, info)
		walkState := newWalkState(fs, root, opts.IncludeContent, opts.Progress)
		scanPath(absPath, absPath, root, scope, patterns, entries, &result, walkState, true)
	}

	for _, entry := range entries {
		result.Entries = append(result.Entries, *entry)
	}

	return result, nil
}

// DefaultUserRoots lists user-scope roots to scan.
func DefaultUserRoots() []string {
	codexHome := os.Getenv("CODEX_HOME")
	if codexHome == "" {
		codexHome = "~/.codex"
	}
	return []string{
		codexHome,
		"~/.config/Code/User",
		"~/.gemini",
		"~/Documents/Cline/Rules",
		"~/.continue",
		"~/.cursor",
		"~/.claude",
	}
}

type walkState struct {
	fs             afero.Fs
	root           string
	includeContent bool
	progress       func(string)
	visited        map[string]struct{}
	active         map[string]struct{}
}

func newWalkState(fs afero.Fs, root string, includeContent bool, progress func(string)) *walkState {
	return &walkState{
		fs:             fs,
		root:           root,
		includeContent: includeContent,
		progress:       progress,
		visited:        make(map[string]struct{}),
		active:         make(map[string]struct{}),
	}
}

func scanDir(logicalPath string, actualPath string, root string, scope string, info os.FileInfo, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, state *walkState, fromStdin bool, fromSymlink bool) {
	if scope == "repo" && logicalPath != state.root {
		if isSubmodule(state.fs, actualPath) {
			return
		}
	}

	key := state.dirKey(info, actualPath)
	if !state.enterDir(key, logicalPath, result, fromSymlink) {
		return
	}
	defer state.leaveDir(key)

	dirEntries, err := afero.ReadDir(state.fs, actualPath)
	if err != nil {
		result.Warnings = append(result.Warnings, warningForError(logicalPath, err))
		return
	}

	for _, entry := range dirEntries {
		entryActual := filepath.Join(actualPath, entry.Name())
		entryLogical := filepath.Join(logicalPath, entry.Name())
		scanPath(entryLogical, entryActual, root, scope, patterns, entries, result, state, fromStdin)
	}
}

func scanPath(logicalPath string, actualPath string, root string, scope string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, state *walkState, fromStdin bool) {
	if state.progress != nil {
		state.progress(logicalPath)
	}

	info, err := lstat(state.fs, actualPath)
	if err != nil {
		result.Warnings = append(result.Warnings, warningForError(logicalPath, err))
		return
	}

	if info.Mode()&os.ModeSymlink != 0 {
		resolveAndScanSymlink(logicalPath, actualPath, root, scope, patterns, entries, result, state, fromStdin)
		return
	}

	if info.IsDir() {
		scanDir(logicalPath, actualPath, root, scope, info, patterns, entries, result, state, fromStdin, false)
		return
	}

	scanFile(logicalPath, actualPath, root, scope, patterns, entries, result, state, info, fromStdin)
}

func resolveAndScanSymlink(logicalPath string, actualPath string, root string, scope string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, state *walkState, fromStdin bool) {
	resolved, err := evalSymlinks(state.fs, actualPath)
	if err != nil {
		result.Warnings = append(result.Warnings, warningForError(logicalPath, err))
		return
	}

	resolvedInfo, err := state.fs.Stat(resolved)
	if err != nil {
		result.Warnings = append(result.Warnings, warningForError(logicalPath, err))
		return
	}

	if resolvedInfo.IsDir() {
		scanDir(logicalPath, resolved, root, scope, resolvedInfo, patterns, entries, result, state, fromStdin, true)
		return
	}

	scanFile(logicalPath, resolved, root, scope, patterns, entries, result, state, resolvedInfo, fromStdin)
}

func scanFile(logicalPath string, resolvedPath string, root string, scope string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, state *walkState, info os.FileInfo, fromStdin bool) {
	absPath, err := filepath.Abs(logicalPath)
	if err != nil {
		result.Warnings = append(result.Warnings, warningForError(logicalPath, err))
		return
	}

	depth := pathDepth(root, logicalPath)
	rel, _ := filepath.Rel(root, logicalPath)
	rel = filepath.ToSlash(rel)

	matches := matchTools(patterns, scope, absPath, rel)
	if len(matches) == 0 && !fromStdin {
		return
	}

	outputPath := absPath
	if outsideRoot(root, resolvedPath) {
		if resolvedAbs, err := filepath.Abs(resolvedPath); err == nil {
			outputPath = resolvedAbs
		}
	}

	resolvedAbs := resolvedPath
	if absResolved, err := filepath.Abs(resolvedPath); err == nil {
		resolvedAbs = absResolved
	}

	entry := entries[resolvedAbs]
	if entry == nil {
		mtime := info.ModTime().UnixMilli()
		entry = &ConfigEntry{
			Path:       outputPath,
			Scope:      scope,
			Depth:      depth,
			Mtime:      mtime,
			Tools:      []ToolEntry{},
			Resolved:   resolvedAbs,
			FromStdin:  fromStdin,
			Gitignored: false,
		}
		entries[resolvedAbs] = entry
		populateEntryContent(state.fs, entry, resolvedAbs, state.includeContent)
	} else if fromStdin {
		entry.FromStdin = true
	}

	entry.Tools = append(entry.Tools, matches...)
	if fromStdin && len(entry.Tools) == 0 {
		result.Warnings = append(result.Warnings, Warning{
			Path:    entry.Path,
			Code:    "UNRECOGNIZED_STDIN",
			Message: "stdin path did not match any registry pattern",
		})
	}
}

func populateEntryContent(fs afero.Fs, entry *ConfigEntry, resolvedPath string, includeContent bool) {
	// #nosec G304 -- resolvedPath comes from scan roots or stdin.
	data, err := afero.ReadFile(fs, resolvedPath)
	if err != nil {
		code := errorCodeFor(err)
		entry.Error = &code
		entry.SizeBytes = nil
		entry.Sha256 = nil
		return
	}

	size := int64(len(data))
	entry.SizeBytes = &size

	sha := scanhash.SumHex(data)
	entry.Sha256 = &sha

	if size == 0 {
		warning := "empty"
		entry.Warning = &warning
	}

	frontmatter, hasFrontmatter, fmErr := ParseFrontmatter(data)
	if hasFrontmatter && frontmatter != nil {
		entry.Frontmatter = frontmatter.Data
		entry.FrontmatterLocations = frontmatter.Locations
	}
	if fmErr != nil {
		errText := fmErr.Error()
		entry.FrontmatterError = &errText
	}

	if isBinaryContent(data) {
		skipped := "binary"
		entry.ContentSkipped = &skipped
		entry.Content = nil
		return
	}

	if includeContent {
		content := string(data)
		entry.Content = &content
	}
}

func isBinaryContent(data []byte) bool {
	if len(data) == 0 {
		return false
	}
	contentType := http.DetectContentType(data)
	return strings.HasPrefix(contentType, "application/octet-stream")
}

func errorCodeFor(err error) string {
	switch {
	case errors.Is(err, fs.ErrPermission):
		return "EACCES"
	case errors.Is(err, fs.ErrNotExist):
		return "ENOENT"
	default:
		return "ERROR"
	}
}

func matchTools(patterns []CompiledPattern, scope string, absPath string, relPath string) []ToolEntry {
	var tools []ToolEntry
	for _, compiled := range patterns {
		if compiled.Pattern.Scope != scope {
			continue
		}
		matched, pattern, err := compiled.Match(absPath, relPath)
		if err != nil || !matched {
			continue
		}
		tools = append(tools, ToolEntry{
			ToolID:           compiled.Pattern.ToolID,
			ToolName:         compiled.Pattern.ToolName,
			Kind:             compiled.Pattern.Kind,
			LoadBehavior:     compiled.Pattern.LoadBehavior,
			Application:      compiled.Pattern.Application,
			ApplicationField: compiled.Pattern.ApplicationField,
			MatchedPattern:   pattern,
			Notes:            compiled.Pattern.Notes,
			Hints:            compiled.Pattern.Hints,
		})
	}

	sortTools(tools)
	return tools
}

func sortTools(tools []ToolEntry) {
	if len(tools) < 2 {
		return
	}
	for i := 0; i < len(tools)-1; i++ {
		for j := i + 1; j < len(tools); j++ {
			if tools[j].ToolID < tools[i].ToolID {
				tools[i], tools[j] = tools[j], tools[i]
			}
		}
	}
}

func expandHomePath(path string) string {
	expanded, err := expandHome(path)
	if err != nil {
		return path
	}
	return expanded
}

func pathDepth(root string, path string) int {
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == "." {
		return 0
	}
	return strings.Count(rel, string(filepath.Separator))
}

func outsideRoot(root string, path string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return true
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return true
	}
	return false
}

func warningForError(path string, err error) Warning {
	code := "ERROR"
	if errors.Is(err, fs.ErrPermission) {
		code = "EACCES"
	}
	return Warning{Path: path, Code: code, Message: err.Error()}
}

func isSubmodule(fs afero.Fs, path string) bool {
	_, err := fs.Stat(filepath.Join(path, ".git"))
	return err == nil
}

func resolveScopeAndRoot(path string, repoRoot string, userRoots []string, info os.FileInfo) (string, string) {
	if isWithinRoot(path, repoRoot) {
		return "repo", repoRoot
	}
	if userRoot := findContainingRoot(path, userRoots); userRoot != "" {
		return "user", userRoot
	}
	if info != nil && info.IsDir() {
		return "user", path
	}
	return "user", filepath.Dir(path)
}

func findContainingRoot(path string, roots []string) string {
	var match string
	for _, root := range roots {
		if root == "" {
			continue
		}
		if isWithinRoot(path, root) && len(root) > len(match) {
			match = root
		}
	}
	return match
}

func isWithinRoot(path string, root string) bool {
	if path == root {
		return true
	}
	sep := string(filepath.Separator)
	return strings.HasPrefix(path, root+sep)
}

func (state *walkState) dirKey(info os.FileInfo, path string) string {
	if info == nil {
		return path
	}
	sys := info.Sys()
	if sys == nil {
		return path
	}
	value := reflect.ValueOf(sys)
	if value.Kind() == reflect.Pointer {
		value = value.Elem()
	}
	if !value.IsValid() || value.Kind() != reflect.Struct {
		return path
	}
	dev := value.FieldByName("Dev")
	ino := value.FieldByName("Ino")
	if !dev.IsValid() || !ino.IsValid() || !dev.CanUint() || !ino.CanUint() {
		return path
	}
	return fmt.Sprintf("%d:%d", dev.Uint(), ino.Uint())
}

func (state *walkState) enterDir(key string, logicalPath string, result *Result, fromSymlink bool) bool {
	if _, ok := state.active[key]; ok {
		if fromSymlink {
			result.Warnings = append(result.Warnings, Warning{
				Path:    logicalPath,
				Code:    "CIRCULAR_SYMLINK",
				Message: "Circular symlink detected",
			})
		}
		return false
	}
	if _, ok := state.visited[key]; ok {
		return false
	}
	state.visited[key] = struct{}{}
	state.active[key] = struct{}{}
	return true
}

func (state *walkState) leaveDir(key string) {
	delete(state.active, key)
}

func lstat(fs afero.Fs, path string) (os.FileInfo, error) {
	if lstater, ok := fs.(afero.Lstater); ok {
		info, _, err := lstater.LstatIfPossible(path)
		return info, err
	}
	return fs.Stat(path)
}

func evalSymlinks(fs afero.Fs, path string) (string, error) {
	if _, ok := fs.(*afero.OsFs); ok {
		return filepath.EvalSymlinks(path)
	}
	return path, nil
}
