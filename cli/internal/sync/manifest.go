package sync

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"markdowntown-cli/internal/git"
)

// ManifestEntry describes a single file entry for a repo snapshot.
type ManifestEntry struct {
	Path      string `json:"path"`
	BlobHash  string `json:"blobHash"`
	Size      int64  `json:"size"`
	Mode      int64  `json:"mode"`
	Mtime     int64  `json:"mtime"`
	IsDeleted bool   `json:"isDeleted,omitempty"`
}

// Manifest contains ordered entries and a deterministic hash of the payload.
type Manifest struct {
	Entries []ManifestEntry `json:"entries"`
	Hash    string          `json:"hash"`
}

// ManifestOptions configures manifest generation and preflight limits.
type ManifestOptions struct {
	RepoRoot          string
	IncludeGitIgnored bool
	MaxFiles          int
	MaxTotalBytes     int64
	MaxFileBytes      int64
}

// BuildManifest builds a deterministic manifest for the repo root.
func BuildManifest(opts ManifestOptions) (Manifest, PreflightResult, error) {
	repoRoot, err := normalizeRepoRoot(opts.RepoRoot)
	if err != nil {
		return Manifest{}, PreflightResult{}, err
	}

	records, err := collectFileRecords(repoRoot)
	if err != nil {
		return Manifest{}, PreflightResult{}, err
	}

	records, err = filterGitIgnored(repoRoot, records, opts.IncludeGitIgnored)
	if err != nil {
		return Manifest{}, PreflightResult{}, err
	}

	preflight, err := summarizeRecords(records, opts)
	if err != nil {
		return Manifest{}, preflight, err
	}

	entries, err := buildEntries(records)
	if err != nil {
		return Manifest{}, preflight, err
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Path < entries[j].Path
	})

	hash, err := hashManifest(entries)
	if err != nil {
		return Manifest{}, preflight, err
	}

	return Manifest{Entries: entries, Hash: hash}, preflight, nil
}

func normalizeRepoRoot(repoRoot string) (string, error) {
	if repoRoot == "" {
		return "", errors.New("repo root is required")
	}
	abs, err := filepath.Abs(repoRoot)
	if err != nil {
		return "", err
	}
	// Resolve symlinks to match git's behavior (e.g., /var -> /private/var on macOS)
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", err
	}
	return resolved, nil
}

type fileRecord struct {
	absPath string
	relPath string
	info    os.FileInfo
}

func collectFileRecords(repoRoot string) ([]fileRecord, error) {
	records := make([]fileRecord, 0)

	err := filepath.WalkDir(repoRoot, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path == repoRoot {
			return nil
		}

		if entry.Name() == ".git" {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if entry.Type()&os.ModeSymlink != 0 {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if entry.IsDir() {
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}

		if !info.Mode().IsRegular() {
			return nil
		}

		rel, err := filepath.Rel(repoRoot, path)
		if err != nil {
			return err
		}
		if rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			return nil
		}

		records = append(records, fileRecord{
			absPath: path,
			relPath: filepath.ToSlash(rel),
			info:    info,
		})
		return nil
	})

	if err != nil {
		return nil, err
	}

	return records, nil
}

func filterGitIgnored(repoRoot string, records []fileRecord, includeGitIgnored bool) ([]fileRecord, error) {
	if includeGitIgnored || len(records) == 0 {
		return records, nil
	}

	gitRoot, err := git.Root(repoRoot)
	if err != nil {
		if errors.Is(err, git.ErrGitNotFound) {
			// No git installed - include all files
			return records, nil
		}
		// Check if error message indicates not a git repo
		if err != nil && (strings.Contains(err.Error(), "not a git repository") || strings.Contains(err.Error(), "fatal:")) {
			// Not a git repo - include all files
			return records, nil
		}
		return nil, err
	}

	paths := make([]string, len(records))
	for i, record := range records {
		paths[i] = record.absPath
	}

	ignored, err := git.CheckIgnore(gitRoot, paths)
	if err != nil {
		if errors.Is(err, git.ErrGitNotFound) {
			return records, nil
		}
		return nil, err
	}

	filtered := records[:0]
	for _, record := range records {
		if ignored[record.absPath] {
			continue
		}
		filtered = append(filtered, record)
	}
	return filtered, nil
}

func buildEntries(records []fileRecord) ([]ManifestEntry, error) {
	entries := make([]ManifestEntry, 0, len(records))
	for _, record := range records {
		hash, err := HashFile(record.absPath)
		if err != nil {
			return nil, err
		}

		entries = append(entries, ManifestEntry{
			Path:     record.relPath,
			BlobHash: hash,
			Size:     record.info.Size(),
			Mode:     int64(record.info.Mode().Perm()),
			Mtime:    record.info.ModTime().UnixMilli(),
		})
	}
	return entries, nil
}

func hashManifest(entries []ManifestEntry) (string, error) {
	payload, err := json.Marshal(entries)
	if err != nil {
		return "", err
	}
	checksum := sha256.Sum256(payload)
	return hex.EncodeToString(checksum[:]), nil
}
