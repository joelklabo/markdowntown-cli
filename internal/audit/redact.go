package audit

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strconv"
	"strings"
)

// RedactMode determines how paths are redacted.
type RedactMode string

const (
	// RedactAuto redacts non-repo paths and keeps repo paths intact.
	RedactAuto RedactMode = "auto"
	// RedactAlways redacts all paths, including repo paths.
	RedactAlways RedactMode = "always"
	// RedactNever disables redaction for all paths.
	RedactNever RedactMode = "never"
)

// Redactor redacts paths based on scope and configured mode.
type Redactor struct {
	repoRoot        string
	homeDir         string
	xdgConfigHome   string
	mode            RedactMode
	placeholders    map[string]string
	nextPlaceholder int
}

// NewRedactor creates a redactor for the given repo and user paths.
func NewRedactor(repoRoot, homeDir, xdgConfigHome string, mode RedactMode) *Redactor {
	return &Redactor{
		repoRoot:        filepath.Clean(repoRoot),
		homeDir:         filepath.Clean(homeDir),
		xdgConfigHome:   filepath.Clean(xdgConfigHome),
		mode:            mode,
		placeholders:    make(map[string]string),
		nextPlaceholder: 1,
	}
}

// RedactPath returns a redacted Path description for the provided scope.
func (r *Redactor) RedactPath(path, scope string) Path {
	absPath := filepath.Clean(path)
	if !filepath.IsAbs(absPath) {
		if resolved, err := filepath.Abs(absPath); err == nil {
			absPath = resolved
		}
	}

	if scope == "repo" {
		return Path{
			Path:     r.repoRelative(absPath),
			Scope:    scope,
			Redacted: false,
		}
	}

	if r.mode == RedactNever {
		return Path{
			Path:     filepath.ToSlash(absPath),
			Scope:    scope,
			Redacted: false,
		}
	}

	return r.redactNonRepo(absPath, scope)
}

func (r *Redactor) redactNonRepo(absPath, scope string) Path {
	pathID := hashPathID(absPath)

	if r.xdgConfigHome != "" && isWithin(absPath, r.xdgConfigHome) {
		rel := strings.TrimPrefix(filepath.ToSlash(absPath), filepath.ToSlash(r.xdgConfigHome))
		rel = strings.TrimPrefix(rel, "/")
		return Path{
			Path:     "$XDG_CONFIG_HOME/" + rel,
			Scope:    scope,
			Redacted: true,
			PathID:   pathID,
		}
	}

	if r.homeDir != "" && isWithin(absPath, r.homeDir) {
		rel := strings.TrimPrefix(filepath.ToSlash(absPath), filepath.ToSlash(r.homeDir))
		rel = strings.TrimPrefix(rel, "/")
		return Path{
			Path:     "$HOME/" + rel,
			Scope:    scope,
			Redacted: true,
			PathID:   pathID,
		}
	}

	placeholder, ok := r.placeholders[absPath]
	if !ok {
		placeholder = "<ABS_PATH_" + itoa(r.nextPlaceholder) + ">"
		r.placeholders[absPath] = placeholder
		r.nextPlaceholder++
	}

	return Path{
		Path:     placeholder,
		Scope:    scope,
		Redacted: true,
		PathID:   pathID,
	}
}

func (r *Redactor) repoRelative(absPath string) string {
	if r.repoRoot == "" {
		return filepath.ToSlash(absPath)
	}
	rel, err := filepath.Rel(r.repoRoot, absPath)
	if err != nil {
		return filepath.ToSlash(absPath)
	}
	rel = filepath.ToSlash(rel)
	if rel == "." {
		return "./"
	}
	if !strings.HasPrefix(rel, "./") {
		rel = "./" + rel
	}
	return rel
}

func isWithin(path, root string) bool {
	path = filepath.Clean(path)
	root = filepath.Clean(root)
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	return rel == "." || (!strings.HasPrefix(rel, "..") && rel != "..")
}

func hashPathID(path string) string {
	sum := sha256.Sum256([]byte(path))
	return "p:" + hex.EncodeToString(sum[:8])
}

func itoa(value int) string {
	return strconv.Itoa(value)
}
