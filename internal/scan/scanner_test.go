package scan

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/spf13/afero"
)

func TestScanWarnsOnPermissionDeniedDir(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("permission bits are unreliable on Windows")
	}

	root := copyFixture(t, "security")
	restricted := filepath.Join(root, "restricted")
	if err := os.Mkdir(restricted, 0o700); err != nil {
		t.Fatalf("mkdir restricted: %v", err)
	}
	if err := os.Chmod(restricted, 0); err != nil {
		t.Fatalf("chmod restricted: %v", err)
	}
	t.Cleanup(func() {
		// #nosec G302 -- directory needs execute bit for cleanup.
		_ = os.Chmod(restricted, 0o700)
	})
	if _, err := os.ReadDir(restricted); err == nil {
		t.Skip("unable to simulate permission denied on this system")
	}

	result, err := Scan(Options{
		RepoRoot: root,
		Registry: testRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if !hasWarning(result.Warnings, restricted, "EACCES") {
		t.Fatalf("expected EACCES warning for %s", restricted)
	}
}

func TestScanWarnsOnCircularSymlink(t *testing.T) {
	root := copyFixture(t, "security")
	loopDir := filepath.Join(root, "loop")
	if err := os.Mkdir(loopDir, 0o700); err != nil {
		t.Fatalf("mkdir loop: %v", err)
	}
	linkPath := filepath.Join(loopDir, "self")
	if err := os.Symlink(loopDir, linkPath); err != nil {
		if errors.Is(err, fs.ErrPermission) {
			t.Skip("symlinks not permitted")
		}
		t.Fatalf("symlink: %v", err)
	}

	result, err := Scan(Options{
		RepoRoot: root,
		Registry: testRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if !hasWarningContains(result.Warnings, filepath.Join("loop", "self"), "CIRCULAR_SYMLINK") {
		t.Fatalf("expected CIRCULAR_SYMLINK warning for %s (warnings: %#v)", linkPath, result.Warnings)
	}
}

func TestPopulateEntryContentMissingFile(t *testing.T) {
	entry := &ConfigEntry{}
	fs := afero.NewMemMapFs()
	missingPath := "/missing.txt"

	populateEntryContent(fs, entry, missingPath, true)

	if entry.Error == nil || *entry.Error != "ENOENT" {
		t.Fatalf("expected ENOENT error, got %#v", entry.Error)
	}
	if entry.SizeBytes != nil || entry.Sha256 != nil {
		t.Fatalf("expected no size or sha on missing file")
	}
}

func TestPopulateEntryContentEmptyFile(t *testing.T) {
	fs := afero.NewMemMapFs()
	path := "/empty.md"
	if err := afero.WriteFile(fs, path, []byte{}, 0o600); err != nil {
		t.Fatalf("write empty file: %v", err)
	}

	entry := &ConfigEntry{}
	populateEntryContent(fs, entry, path, false)

	if entry.Warning == nil || *entry.Warning != "empty" {
		t.Fatalf("expected empty warning, got %#v", entry.Warning)
	}
}

func TestPopulateEntryContentFrontmatterError(t *testing.T) {
	fs := afero.NewMemMapFs()
	path := "/bad.md"
	content := []byte("---\nkey: value\n")
	if err := afero.WriteFile(fs, path, content, 0o600); err != nil {
		t.Fatalf("write bad frontmatter: %v", err)
	}

	entry := &ConfigEntry{}
	populateEntryContent(fs, entry, path, false)

	if entry.FrontmatterError == nil {
		t.Fatalf("expected frontmatter error for missing delimiter")
	}
}

func TestScanUserRootMissing(t *testing.T) {
	repoRoot := copyFixture(t, "security")
	missingRoot := filepath.Join(t.TempDir(), "missing-root")

	result, err := Scan(Options{
		RepoRoot: repoRoot,
		UserRoots: []string{
			missingRoot,
		},
		Registry: testRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	found := false
	for _, scan := range result.Scans {
		if scan.Scope == "user" && scan.Root == missingRoot {
			found = true
			if scan.Exists {
				t.Fatalf("expected missing user root to have Exists=false")
			}
		}
	}
	if !found {
		t.Fatalf("expected user scan entry for %s", missingRoot)
	}
}

func TestScanGlobalScopeOrdering(t *testing.T) {
	repoRoot := t.TempDir()
	writeTestFile(t, filepath.Join(repoRoot, "repo.md"), "repo")

	userRoot := t.TempDir()
	writeTestFile(t, filepath.Join(userRoot, "AGENTS.md"), "user")

	globalRoot := copyFixture(t, "global-scope")

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		UserRoots:     []string{userRoot},
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      globalScopeRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	output := BuildOutput(result, OutputOptions{
		SchemaVersion:   "test",
		RegistryVersion: "1",
		ToolVersion:     "test",
		RepoRoot:        repoRoot,
	})

	foundGlobal := false
	for _, scan := range output.Scans {
		if scan.Scope == ScopeGlobal && filepath.Clean(scan.Root) == filepath.Clean(globalRoot) {
			foundGlobal = true
			break
		}
	}
	if !foundGlobal {
		t.Fatalf("expected global scan root %s", globalRoot)
	}

	seenGlobal := false
	for _, entry := range output.Configs {
		if entry.Scope == ScopeGlobal {
			seenGlobal = true
			continue
		}
		if seenGlobal {
			t.Fatalf("expected global configs last, saw %s after global", entry.Scope)
		}
	}
}

func TestScanGlobalScopeSkipsSpecialFiles(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("special files not supported on Windows")
	}

	repoRoot := t.TempDir()
	globalRoot := copyFixture(t, "global-scope")
	fifoPath := filepath.Join(globalRoot, "named-pipe")
	if err := mkfifo(fifoPath, 0o600); err != nil {
		if errors.Is(err, errMkfifoUnsupported) {
			t.Skip("mkfifo unsupported on this platform")
		}
		t.Skipf("mkfifo unavailable: %v", err)
	}

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-config",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"global.md", "named-pipe"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if hasEntryWithPath(result.Entries, fifoPath) {
		t.Fatalf("expected fifo %s to be skipped", fifoPath)
	}
	if !hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "global.md")) {
		t.Fatalf("expected global config to be scanned")
	}
}

func TestScanGlobalScopeSkipsSensitivePaths(t *testing.T) {
	repoRoot := t.TempDir()
	globalRoot := copyFixture(t, "global-scope")

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-sensitive",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"global.md", "shadow", "passwd", "security/opasswd"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "shadow")) {
		t.Fatalf("expected shadow to be skipped")
	}
	if hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "passwd")) {
		t.Fatalf("expected passwd to be skipped")
	}
	if hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "security", "opasswd")) {
		t.Fatalf("expected security/opasswd to be skipped")
	}
	if !hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "global.md")) {
		t.Fatalf("expected global config to be scanned")
	}
}

func TestScanGlobalScopeHonorsMaxFiles(t *testing.T) {
	repoRoot := t.TempDir()
	globalRoot := t.TempDir()
	writeTestFile(t, filepath.Join(globalRoot, "a.md"), "a")
	writeTestFile(t, filepath.Join(globalRoot, "b.md"), "b")

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-config",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"*.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:       repoRoot,
		IncludeGlobal:  true,
		GlobalRoots:    []string{globalRoot},
		GlobalMaxFiles: 1,
		Registry:       registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "b.md")) {
		t.Fatalf("expected b.md to be skipped due to max files guardrail")
	}
	if !hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "a.md")) {
		t.Fatalf("expected a.md to be scanned")
	}
	if !hasWarning(result.Warnings, filepath.Join(globalRoot, "b.md"), "GLOBAL_MAX_FILES") {
		t.Fatalf("expected GLOBAL_MAX_FILES warning")
	}
}

func TestScanGlobalScopeHonorsMaxBytes(t *testing.T) {
	repoRoot := t.TempDir()
	globalRoot := t.TempDir()
	writeTestFile(t, filepath.Join(globalRoot, "a.md"), "1234")
	writeTestFile(t, filepath.Join(globalRoot, "b.md"), "12345678")

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-config",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"*.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:       repoRoot,
		IncludeGlobal:  true,
		GlobalRoots:    []string{globalRoot},
		GlobalMaxBytes: 4,
		Registry:       registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "b.md")) {
		t.Fatalf("expected b.md to be skipped due to max bytes guardrail")
	}
	if !hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "a.md")) {
		t.Fatalf("expected a.md to be scanned")
	}
	if !hasWarning(result.Warnings, filepath.Join(globalRoot, "b.md"), "GLOBAL_MAX_BYTES") {
		t.Fatalf("expected GLOBAL_MAX_BYTES warning")
	}
}

func TestScanGlobalScopeWarnsOnWindows(t *testing.T) {
	repoRoot := t.TempDir()

	withRuntimeGOOS(t, "windows", func() {
		result, err := Scan(Options{
			RepoRoot:      repoRoot,
			IncludeGlobal: true,
			Registry:      globalScopeRegistry(),
		})
		if err != nil {
			t.Fatalf("scan: %v", err)
		}

		if !hasWarning(result.Warnings, repoRoot, "GLOBAL_SCOPE_UNSUPPORTED") {
			t.Fatalf("expected GLOBAL_SCOPE_UNSUPPORTED warning")
		}
	})
}

func TestScanGlobalScopeWarnsOnPermissionDenied(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("permission bits are unreliable on Windows")
	}
	if os.Geteuid() == 0 {
		t.Skip("permission tests are unreliable when running as root")
	}

	repoRoot := t.TempDir()
	globalRoot := copyFixture(t, "global-scope")
	restricted := filepath.Join(globalRoot, "restricted")
	if err := os.Mkdir(restricted, 0o700); err != nil {
		t.Fatalf("mkdir restricted: %v", err)
	}
	if err := os.Chmod(restricted, 0); err != nil {
		t.Fatalf("chmod restricted: %v", err)
	}
	t.Cleanup(func() {
		// #nosec G302 -- directory needs execute bit for cleanup.
		_ = os.Chmod(restricted, 0o700)
	})
	if _, err := os.ReadDir(restricted); err == nil {
		t.Skip("unable to simulate permission denied on this system")
	}

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      globalScopeRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if !hasWarning(result.Warnings, restricted, "EACCES") {
		t.Fatalf("expected EACCES warning for %s", restricted)
	}
}

func TestScanGlobalScopeSymlinkEscape(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink permissions vary on Windows")
	}

	repoRoot := t.TempDir()
	globalRoot := copyFixture(t, "global-scope")
	externalDir := t.TempDir()
	externalPath := filepath.Join(externalDir, "escape.md")
	writeTestFile(t, externalPath, "escape")

	linkPath := filepath.Join(globalRoot, "escape-link")
	if err := os.Symlink(externalPath, linkPath); err != nil {
		if errors.Is(err, fs.ErrPermission) {
			t.Skip("symlinks not permitted")
		}
		t.Fatalf("symlink: %v", err)
	}

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-escape",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"escape-link"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if !hasWarning(result.Warnings, linkPath, "SYMLINK_ESCAPE") {
		t.Fatalf("expected SYMLINK_ESCAPE warning for %s", linkPath)
	}
	if hasEntryWithPath(result.Entries, linkPath) || hasEntryWithPath(result.Entries, externalPath) {
		t.Fatalf("expected escaped symlink to be skipped")
	}
}

func TestScanGlobalScopeWarnsOnCircularSymlink(t *testing.T) {
	globalRoot := copyFixture(t, "global-scope")
	loopDir := filepath.Join(globalRoot, "loop")
	if err := os.Mkdir(loopDir, 0o700); err != nil {
		t.Fatalf("mkdir loop: %v", err)
	}
	linkPath := filepath.Join(loopDir, "self")
	if err := os.Symlink("self", linkPath); err != nil {
		if errors.Is(err, fs.ErrPermission) {
			t.Skip("symlinks not permitted")
		}
		t.Fatalf("symlink: %v", err)
	}

	result, err := Scan(Options{
		RepoRoot:      t.TempDir(),
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      globalScopeRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if !hasWarningContains(result.Warnings, filepath.Join("loop", "self"), "CIRCULAR_SYMLINK") &&
		!hasWarningContains(result.Warnings, filepath.Join("loop", "self"), "ERROR") {
		t.Fatalf("expected symlink warning for %s (warnings: %#v)", linkPath, result.Warnings)
	}
}

func TestScanGlobalScopeSkipsSensitivePrefixes(t *testing.T) {
	repoRoot := t.TempDir()
	globalRoot := copyFixture(t, "global-scope")

	registry := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "global-sensitive",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"global.md", "shadow", "passwd", "security/opasswd"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}

	result, err := Scan(Options{
		RepoRoot:      repoRoot,
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      registry,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "shadow")) {
		t.Fatalf("expected shadow to be skipped")
	}
	if hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "passwd")) {
		t.Fatalf("expected passwd to be skipped")
	}
	if hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "security", "opasswd")) {
		t.Fatalf("expected security/opasswd to be skipped")
	}
	if !hasEntryWithPath(result.Entries, filepath.Join(globalRoot, "global.md")) {
		t.Fatalf("expected global.md to be scanned")
	}
}

func TestScanGlobalScopeWarnsOnSymlinkEscape(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink permissions vary on Windows")
	}

	globalRoot := copyFixture(t, "global-scope")
	outsideDir := t.TempDir()
	outsidePath := filepath.Join(outsideDir, "outside.md")
	writeTestFile(t, outsidePath, "outside")

	linkPath := filepath.Join(globalRoot, "escape.md")
	if err := os.Symlink(outsidePath, linkPath); err != nil {
		if errors.Is(err, fs.ErrPermission) {
			t.Skip("symlinks not permitted")
		}
		t.Fatalf("symlink: %v", err)
	}

	result, err := Scan(Options{
		RepoRoot:      t.TempDir(),
		IncludeGlobal: true,
		GlobalRoots:   []string{globalRoot},
		Registry:      globalScopeRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if !hasWarning(result.Warnings, linkPath, "SYMLINK_ESCAPE") {
		t.Fatalf("expected SYMLINK_ESCAPE warning for %s", linkPath)
	}
}

func TestGlobalXDevGuardrailSkipsDifferentDevice(t *testing.T) {
	rootInfo := fakeFileInfo{
		name: "root",
		sys:  fakeStat{Dev: 1},
		dir:  true,
	}
	state := newWalkState(afero.NewMemMapFs(), "/root", nil, ScopeGlobal, Options{
		GlobalXDev: true,
	}, rootInfo)

	result := Result{}
	otherInfo := fakeFileInfo{
		name: "other",
		sys:  fakeStat{Dev: 2},
	}

	if state.allowXDev(otherInfo, "/root/other", &result) {
		t.Fatalf("expected xdev guardrail to skip different device")
	}
	if !hasWarning(result.Warnings, "/root/other", "GLOBAL_XDEV") {
		t.Fatalf("expected GLOBAL_XDEV warning")
	}
}

func hasWarning(warnings []Warning, path string, code string) bool {
	for _, warning := range warnings {
		if warning.Code == code && warning.Path == path {
			return true
		}
	}
	return false
}

func hasWarningContains(warnings []Warning, pathFragment string, code string) bool {
	for _, warning := range warnings {
		if warning.Code == code && strings.Contains(warning.Path, pathFragment) {
			return true
		}
	}
	return false
}

func withRuntimeGOOS(t *testing.T, value string, fn func()) {
	t.Helper()
	previous := runtimeGOOS
	runtimeGOOS = value
	t.Cleanup(func() {
		runtimeGOOS = previous
	})
	fn()
}

type fakeStat struct {
	Dev uint64
}

type fakeFileInfo struct {
	name string
	size int64
	mode os.FileMode
	mod  time.Time
	sys  any
	dir  bool
}

func (info fakeFileInfo) Name() string {
	return info.name
}

func (info fakeFileInfo) Size() int64 {
	return info.size
}

func (info fakeFileInfo) Mode() os.FileMode {
	return info.mode
}

func (info fakeFileInfo) ModTime() time.Time {
	return info.mod
}

func (info fakeFileInfo) IsDir() bool {
	return info.dir
}

func (info fakeFileInfo) Sys() any {
	return info.sys
}

func testRegistry() Registry {
	return Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "test",
				ToolID:       "test",
				ToolName:     "Test",
				Kind:         "config",
				Scope:        "repo",
				Paths:        []string{"README.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}
}

func globalScopeRegistry() Registry {
	return Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "repo-config",
				ToolID:       "repo-tool",
				ToolName:     "Repo Tool",
				Kind:         "config",
				Scope:        ScopeRepo,
				Paths:        []string{"repo.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "user-config",
				ToolID:       "user-tool",
				ToolName:     "User Tool",
				Kind:         "config",
				Scope:        ScopeUser,
				Paths:        []string{"AGENTS.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
			{
				ID:           "global-config",
				ToolID:       "global-tool",
				ToolName:     "Global Tool",
				Kind:         "config",
				Scope:        ScopeGlobal,
				Paths:        []string{"global.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}
}

func hasEntryWithPath(entries []ConfigEntry, path string) bool {
	for _, entry := range entries {
		if entry.Path == path {
			return true
		}
	}
	return false
}

func copyFixture(t *testing.T, name string) string {
	root := t.TempDir()
	src := filepath.Join("..", "..", "testdata", "repos", name)
	if err := copyDir(src, root); err != nil {
		t.Fatalf("copy fixture: %v", err)
	}
	return root
}

func copyDir(src string, dest string) error {
	return filepath.WalkDir(src, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		target := filepath.Join(dest, rel)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o700)
		}
		// #nosec G304 -- copying fixture files during tests.
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o600)
	})
}

func TestScanWithMemMapFs(t *testing.T) {
	fs := afero.NewMemMapFs()
	repoRoot := "/repo"
	if runtime.GOOS == "windows" {
		volume := filepath.VolumeName(os.TempDir())
		repoRoot = filepath.Join(volume+string(os.PathSeparator), "repo")
	}
	if err := fs.MkdirAll(repoRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := afero.WriteFile(fs, filepath.Join(repoRoot, "README.md"), []byte("# Repo"), 0644); err != nil {
		t.Fatal(err)
	}

	result, err := Scan(Options{
		Fs:       fs,
		RepoRoot: repoRoot,
		Registry: testRegistry(),
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if len(result.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(result.Entries))
	}
	if result.Entries[0].Path != filepath.Join(repoRoot, "README.md") {
		t.Errorf("expected path %s, got %s", filepath.Join(repoRoot, "README.md"), result.Entries[0].Path)
	}
}
