package scan

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"

	scanhash "markdowntown-cli/internal/hash"

	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
)

// Result collects discovered entries and warnings.
type Result struct {
	Scans    []Root
	Entries  []ConfigEntry
	Warnings []Warning
}

var runtimeGOOS = runtime.GOOS

// Scan discovers files across repo/user scopes and stdin paths.
func scanRepoRoots(fs afero.Fs, repoRoots []string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, opts Options) []string {
	repoRootsAbs := make([]string, 0, len(repoRoots))
	repoRootSeen := make(map[string]struct{})
	for _, root := range repoRoots {
		root = expandHomePath(root)
		absRoot, err := filepath.Abs(root)
		if err != nil {
			result.Warnings = append(result.Warnings, warningForError(root, err))
			continue
		}
		absRoot = filepath.Clean(absRoot)
		if _, ok := repoRootSeen[absRoot]; ok {
			continue
		}
		repoRootSeen[absRoot] = struct{}{}
		repoRootsAbs = append(repoRootsAbs, absRoot)
	}

	for _, root := range repoRootsAbs {
		repoInfo, repoErr := fs.Stat(root)
		repoExists := repoErr == nil && repoInfo.IsDir()
		result.Scans = append(result.Scans, Root{Scope: ScopeRepo, Root: root, Exists: repoExists})
		if repoErr != nil && !os.IsNotExist(repoErr) {
			result.Warnings = append(result.Warnings, warningForError(root, repoErr))
		}
		if repoExists {
			walkState := newWalkState(fs, root, opts.Progress, ScopeRepo, opts, repoInfo)
			scanDir(root, root, root, ScopeRepo, repoInfo, patterns, entries, result, walkState, false, false)
		}
	}
	return repoRootsAbs
}

func scanUserRoots(fs afero.Fs, repoRoot string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, opts Options) []string {
	var userRootsAbs []string
	if opts.RepoOnly {
		return userRootsAbs
	}

	userRoots := opts.UserRoots
	if len(userRoots) == 0 {
		userRoots = DefaultUserRoots()
	}
	if extraRoots := discoverVSCodeInstructionPaths(fs, repoRoot, userRoots); len(extraRoots) > 0 {
		userRoots = append(userRoots, extraRoots...)
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
		result.Scans = append(result.Scans, Root{Scope: ScopeUser, Root: absRoot, Exists: exists})
		if statErr != nil && !os.IsNotExist(statErr) {
			result.Warnings = append(result.Warnings, warningForError(absRoot, statErr))
		}
		if !exists {
			continue
		}
		walkState := newWalkState(fs, absRoot, opts.Progress, ScopeUser, opts, info)
		scanDir(absRoot, absRoot, absRoot, ScopeUser, info, patterns, entries, result, walkState, false, false)
	}
	return userRootsAbs
}

func scanGlobalRoots(fs afero.Fs, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, opts Options) []string {
	var globalRootsAbs []string
	if !opts.IncludeGlobal {
		return globalRootsAbs
	}
	if runtimeGOOS == "windows" {
		path := opts.RepoRoot
		if strings.TrimSpace(path) == "" {
			path = "/"
		}
		result.Warnings = append(result.Warnings, Warning{
			Path:    path,
			Code:    "GLOBAL_SCOPE_UNSUPPORTED",
			Message: "Global scope is not supported on Windows",
		})
		return globalRootsAbs
	}

	globalRoots := opts.GlobalRoots
	if len(globalRoots) == 0 {
		globalRoots = DefaultGlobalRoots()
	}
	if len(globalRoots) == 0 {
		return globalRootsAbs
	}

	seen := make(map[string]struct{})
	for _, root := range globalRoots {
		root = expandHomePath(root)
		absRoot, err := filepath.Abs(root)
		if err != nil {
			result.Warnings = append(result.Warnings, warningForError(root, err))
			continue
		}
		absRoot = filepath.Clean(absRoot)
		if _, ok := seen[absRoot]; ok {
			continue
		}
		seen[absRoot] = struct{}{}
		globalRootsAbs = append(globalRootsAbs, absRoot)

		info, statErr := fs.Stat(absRoot)
		exists := statErr == nil && info.IsDir()
		result.Scans = append(result.Scans, Root{Scope: ScopeGlobal, Root: absRoot, Exists: exists})
		if statErr != nil && !os.IsNotExist(statErr) {
			result.Warnings = append(result.Warnings, warningForError(absRoot, statErr))
		}
		if !exists {
			continue
		}
		walkState := newWalkState(fs, absRoot, opts.Progress, ScopeGlobal, opts, info)
		scanDir(absRoot, absRoot, absRoot, ScopeGlobal, info, patterns, entries, result, walkState, false, false)
	}

	return globalRootsAbs
}

func scanStdinPaths(fs afero.Fs, paths []string, repoRootsAbs []string, userRootsAbs []string, globalRootsAbs []string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, opts Options) {
	for _, stdinPath := range paths {
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
		info, err := lstat(fs, absPath)
		if err != nil {
			result.Warnings = append(result.Warnings, warningForError(absPath, err))
			continue
		}
		scope, root := resolveScopeAndRoot(absPath, repoRootsAbs, userRootsAbs, globalRootsAbs, info)
		var rootInfo os.FileInfo
		if scope == ScopeGlobal {
			rootInfo, _ = fs.Stat(root)
		}
		walkState := newWalkState(fs, root, opts.Progress, scope, opts, rootInfo)
		scanPath(absPath, absPath, root, scope, patterns, entries, result, walkState, true)
	}
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

	patterns, warnings, err := loadPatterns(fs, opts)
	if err != nil {
		return result, err
	}
	result.Warnings = append(result.Warnings, warnings...)

	repoRoot, err := filepath.Abs(opts.RepoRoot)
	if err != nil {
		return result, err
	}
	repoRoot = filepath.Clean(repoRoot)

	entries := make(map[string]*ConfigEntry)

	repoRoots := []string{repoRoot}
	workspaceRoots, workspaceWarnings := discoverWorkspaceRoots(fs, repoRoot)
	if len(workspaceWarnings) > 0 {
		result.Warnings = append(result.Warnings, workspaceWarnings...)
	}
	if len(workspaceRoots) > 0 {
		repoRoots = append(repoRoots, workspaceRoots...)
	}

	repoRootsAbs := scanRepoRoots(fs, repoRoots, patterns, entries, &result, opts)
	userRootsAbs := scanUserRoots(fs, repoRoot, patterns, entries, &result, opts)
	globalRootsAbs := scanGlobalRoots(fs, patterns, entries, &result, opts)
	scanStdinPaths(fs, opts.StdinPaths, repoRootsAbs, userRootsAbs, globalRootsAbs, patterns, entries, &result, opts)

	populateEntriesContent(fs, entries, opts.IncludeContent, opts.ScanWorkers)

	for _, entry := range entries {
		result.Entries = append(result.Entries, *entry)
	}

	return result, nil
}

func populateEntriesContent(fs afero.Fs, entries map[string]*ConfigEntry, includeContent bool, workers int) {
	if len(entries) == 0 {
		return
	}
	if workers <= 0 {
		workers = defaultScanWorkers()
	}
	if workers < 1 {
		workers = 1
	}
	if workers == 1 {
		for _, entry := range entries {
			if entry == nil {
				continue
			}
			resolved := entry.Resolved
			if resolved == "" {
				resolved = entry.Path
			}
			populateEntryContent(fs, entry, resolved, includeContent)
		}
		return
	}

	sem := semaphore.NewWeighted(int64(workers))
	group, ctx := errgroup.WithContext(context.Background())
	for _, entry := range entries {
		entry := entry
		if entry == nil {
			continue
		}
		if err := sem.Acquire(ctx, 1); err != nil {
			break
		}
		group.Go(func() error {
			defer sem.Release(1)
			resolved := entry.Resolved
			if resolved == "" {
				resolved = entry.Path
			}
			populateEntryContent(fs, entry, resolved, includeContent)
			return nil
		})
	}
	_ = group.Wait()
}

func loadPatterns(fs afero.Fs, opts Options) ([]CompiledPattern, []Warning, error) {
	patterns := opts.Patterns
	var warnings []Warning

	if len(patterns) == 0 {
		if len(opts.Registry.Patterns) == 0 {
			return nil, nil, fmt.Errorf("registry patterns required")
		}
		compiled, err := CompilePatterns(opts.Registry)
		if err != nil {
			return nil, nil, err
		}
		patterns = compiled
	}

	if !opts.RepoOnly {
		fallback, configPath, err := loadCodexFallbackFilenames(fs)
		if err != nil {
			warnings = append(warnings, warningForError(configPath, err))
		} else if len(fallback) > 0 {
			updated, err := appendCodexFallbackPatterns(patterns, fallback)
			if err != nil {
				warnings = append(warnings, warningForError(configPath, err))
			} else {
				patterns = updated
			}
		}
	}
	return patterns, warnings, nil
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

// DefaultGlobalRoots lists system-wide roots to scan (opt-in).
func DefaultGlobalRoots() []string {
	if runtimeGOOS == "windows" {
		return nil
	}
	return []string{"/etc"}
}

func defaultScanWorkers() int {
	if runtime.GOOS == "js" {
		return 1
	}
	if workers := runtime.NumCPU(); workers > 0 {
		return workers
	}
	return 1
}

var globalSkipPrefixes = []string{
	"passwd",
	"passwd-",
	"shadow",
	"shadow-",
	"group",
	"group-",
	"gshadow",
	"gshadow-",
	"sudoers",
	"sudoers.d",
	"security",
	"ssh",
	"krb5.keytab",
	"kubernetes",
	"networkmanager/system-connections",
	"pki/private",
	"pki/tls/private",
	"ssl/private",
	"wpa_supplicant.conf",
}

func shouldSkipGlobalPath(root string, path string, info os.FileInfo) bool {
	if isSpecialFile(info) {
		return true
	}

	rel, err := filepath.Rel(root, path)
	if err != nil {
		return true
	}
	if rel == "." {
		return false
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return true
	}

	rel = strings.ToLower(filepath.ToSlash(rel))
	for _, prefix := range globalSkipPrefixes {
		if rel == prefix || strings.HasPrefix(rel, prefix+"/") {
			return true
		}
	}
	return false
}

func isSpecialFile(info os.FileInfo) bool {
	if info == nil {
		return false
	}
	mode := info.Mode()
	return mode&(os.ModeDevice|os.ModeCharDevice|os.ModeNamedPipe|os.ModeSocket|os.ModeIrregular) != 0
}

type walkState struct {
	fs          afero.Fs
	root        string
	scope       string
	progress    func(string)
	visited     map[string]struct{}
	active      map[string]struct{}
	activePaths map[string]struct{}
	guard       guardState
}

type guardState struct {
	maxFiles     int
	maxBytes     int64
	filesSeen    int
	bytesSeen    int64
	limitReached bool
	warnedFiles  bool
	warnedBytes  bool
	warnedXDev   bool
	rootDev      uint64
	hasRootDev   bool
	xdev         bool
}

func newWalkState(fs afero.Fs, root string, progress func(string), scope string, opts Options, rootInfo os.FileInfo) *walkState {
	state := &walkState{
		fs:          fs,
		root:        root,
		scope:       scope,
		progress:    progress,
		visited:     make(map[string]struct{}),
		active:      make(map[string]struct{}),
		activePaths: make(map[string]struct{}),
	}
	if scope == ScopeGlobal {
		state.guard.maxFiles = opts.GlobalMaxFiles
		state.guard.maxBytes = opts.GlobalMaxBytes
		state.guard.xdev = opts.GlobalXDev
		if rootInfo == nil && opts.GlobalXDev {
			if info, err := fs.Stat(root); err == nil {
				rootInfo = info
			}
		}
		if opts.GlobalXDev {
			state.guard.rootDev, state.guard.hasRootDev = devFromInfo(rootInfo)
		}
	}
	return state
}

func (state *walkState) guardStop() bool {
	return state.scope == ScopeGlobal && state.guard.limitReached
}

func (state *walkState) allowXDev(info os.FileInfo, logicalPath string, result *Result) bool {
	if state.scope != ScopeGlobal || !state.guard.xdev {
		return true
	}
	if !state.guard.hasRootDev {
		return true
	}
	dev, ok := devFromInfo(info)
	if ok && dev != state.guard.rootDev {
		if !state.guard.warnedXDev {
			state.guard.warnedXDev = true
			result.Warnings = append(result.Warnings, Warning{
				Path:    logicalPath,
				Code:    "GLOBAL_XDEV",
				Message: "Skipping path on different filesystem",
			})
		}
		return false
	}
	return true
}

func (state *walkState) allowFile(info os.FileInfo, logicalPath string, result *Result) bool {
	if state.scope != ScopeGlobal {
		return true
	}
	if state.guard.maxFiles <= 0 && state.guard.maxBytes <= 0 {
		return true
	}
	if info == nil || info.IsDir() {
		return true
	}
	size := info.Size()
	if size < 0 {
		size = 0
	}
	if state.guard.maxFiles > 0 && state.guard.filesSeen+1 > state.guard.maxFiles {
		if !state.guard.warnedFiles {
			state.guard.warnedFiles = true
			result.Warnings = append(result.Warnings, Warning{
				Path:    logicalPath,
				Code:    "GLOBAL_MAX_FILES",
				Message: fmt.Sprintf("Global scan file limit %d exceeded; skipping remaining paths", state.guard.maxFiles),
			})
		}
		state.guard.limitReached = true
		return false
	}
	if state.guard.maxBytes > 0 && state.guard.bytesSeen+size > state.guard.maxBytes {
		if !state.guard.warnedBytes {
			state.guard.warnedBytes = true
			result.Warnings = append(result.Warnings, Warning{
				Path:    logicalPath,
				Code:    "GLOBAL_MAX_BYTES",
				Message: fmt.Sprintf("Global scan byte limit %d exceeded; skipping remaining paths", state.guard.maxBytes),
			})
		}
		state.guard.limitReached = true
		return false
	}
	state.guard.filesSeen++
	state.guard.bytesSeen += size
	return true
}

func scanDir(logicalPath string, actualPath string, root string, scope string, info os.FileInfo, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, state *walkState, fromStdin bool, fromSymlink bool) {
	if state.guardStop() {
		return
	}
	if scope == ScopeGlobal && shouldSkipGlobalPath(root, logicalPath, info) {
		return
	}
	if scope == ScopeRepo && logicalPath != state.root {
		if isSubmodule(state.fs, actualPath) {
			return
		}
	}

	key := state.dirKey(info, actualPath)
	if !state.enterDir(key, logicalPath, actualPath, result, fromSymlink) {
		return
	}
	defer state.leaveDir(key, actualPath)

	dirEntries, err := afero.ReadDir(state.fs, actualPath)
	if err != nil {
		result.Warnings = append(result.Warnings, warningForError(logicalPath, err))
		return
	}

	for _, entry := range dirEntries {
		if state.guardStop() {
			return
		}
		entryActual := filepath.Join(actualPath, entry.Name())
		entryLogical := filepath.Join(logicalPath, entry.Name())
		scanPath(entryLogical, entryActual, root, scope, patterns, entries, result, state, fromStdin)
	}
}

func scanPath(logicalPath string, actualPath string, root string, scope string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, state *walkState, fromStdin bool) {
	if state.guardStop() {
		return
	}
	if state.progress != nil {
		state.progress(logicalPath)
	}

	info, err := lstat(state.fs, actualPath)
	if err != nil {
		result.Warnings = append(result.Warnings, warningForError(logicalPath, err))
		return
	}

	if scope == ScopeGlobal && shouldSkipGlobalPath(root, logicalPath, info) {
		return
	}

	if info.Mode()&os.ModeSymlink != 0 {
		resolveAndScanSymlink(logicalPath, actualPath, root, scope, patterns, entries, result, state, fromStdin)
		return
	}

	if scope == ScopeGlobal && !state.allowXDev(info, logicalPath, result) {
		return
	}

	if info.IsDir() {
		scanDir(logicalPath, actualPath, root, scope, info, patterns, entries, result, state, fromStdin, false)
		return
	}

	if !state.allowFile(info, logicalPath, result) {
		return
	}
	scanFile(logicalPath, actualPath, root, scope, patterns, entries, result, info, fromStdin)
}

func resolveAndScanSymlink(logicalPath string, actualPath string, root string, scope string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, state *walkState, fromStdin bool) {
	if state.guardStop() {
		return
	}
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

	if scope == ScopeGlobal && outsideRoot(root, resolved) {
		result.Warnings = append(result.Warnings, Warning{
			Path:    logicalPath,
			Code:    "SYMLINK_ESCAPE",
			Message: "Symlink target escapes global root",
		})
		return
	}

	if scope == ScopeGlobal && !state.allowXDev(resolvedInfo, logicalPath, result) {
		return
	}

	if scope == ScopeGlobal && shouldSkipGlobalPath(root, resolved, resolvedInfo) {
		return
	}

	if resolvedInfo.IsDir() {
		scanDir(logicalPath, resolved, root, scope, resolvedInfo, patterns, entries, result, state, fromStdin, true)
		return
	}

	if !state.allowFile(resolvedInfo, logicalPath, result) {
		return
	}
	scanFile(logicalPath, resolved, root, scope, patterns, entries, result, resolvedInfo, fromStdin)
}

func scanFile(logicalPath string, resolvedPath string, root string, scope string, patterns []CompiledPattern, entries map[string]*ConfigEntry, result *Result, info os.FileInfo, fromStdin bool) {
	if scope == ScopeGlobal && shouldSkipGlobalPath(root, resolvedPath, info) {
		return
	}
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

func resolveScopeAndRoot(path string, repoRoots []string, userRoots []string, globalRoots []string, info os.FileInfo) (string, string) {
	if repoRoot := findContainingRoot(path, repoRoots); repoRoot != "" {
		return ScopeRepo, repoRoot
	}
	if userRoot := findContainingRoot(path, userRoots); userRoot != "" {
		return ScopeUser, userRoot
	}
	if globalRoot := findContainingRoot(path, globalRoots); globalRoot != "" {
		return ScopeGlobal, globalRoot
	}
	if info != nil && info.IsDir() {
		return ScopeUser, path
	}
	return ScopeUser, filepath.Dir(path)
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
	devValue, ok := uintFromStatField(dev)
	if !ok {
		return path
	}
	inoValue, ok := uintFromStatField(ino)
	if !ok {
		return path
	}
	return fmt.Sprintf("%d:%d", devValue, inoValue)
}

func devFromInfo(info os.FileInfo) (uint64, bool) {
	if info == nil {
		return 0, false
	}
	sys := info.Sys()
	if sys == nil {
		return 0, false
	}
	value := reflect.ValueOf(sys)
	if value.Kind() == reflect.Pointer {
		value = value.Elem()
	}
	if !value.IsValid() || value.Kind() != reflect.Struct {
		return 0, false
	}
	dev := value.FieldByName("Dev")
	return uintFromStatField(dev)
}

func uintFromStatField(value reflect.Value) (uint64, bool) {
	if !value.IsValid() {
		return 0, false
	}
	switch value.Kind() {
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return value.Uint(), true
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		if value.Int() < 0 {
			return 0, false
		}
		return uint64(value.Int()), true // #nosec G115 -- value.Int already validated as non-negative.
	default:
		return 0, false
	}
}

func (state *walkState) enterDir(key string, logicalPath string, actualPath string, result *Result, fromSymlink bool) bool {
	pathKey := filepath.Clean(actualPath)
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
	if pathKey != "" {
		if _, ok := state.activePaths[pathKey]; ok {
			if fromSymlink {
				result.Warnings = append(result.Warnings, Warning{
					Path:    logicalPath,
					Code:    "CIRCULAR_SYMLINK",
					Message: "Circular symlink detected",
				})
			}
			return false
		}
	}
	if _, ok := state.visited[key]; ok {
		return false
	}
	state.visited[key] = struct{}{}
	state.active[key] = struct{}{}
	if pathKey != "" {
		state.activePaths[pathKey] = struct{}{}
	}
	return true
}

func (state *walkState) leaveDir(key string, actualPath string) {
	delete(state.active, key)
	if actualPath != "" {
		delete(state.activePaths, filepath.Clean(actualPath))
	}
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
