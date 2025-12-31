package audit

import (
	"path/filepath"
	"strings"
)

// Redactor normalizes paths for audit output.
type Redactor struct {
	RepoRoot string
	HomeDir  string
}

// RedactPath normalizes a path based on its scope.
func (r Redactor) RedactPath(scope, target string) string {
	if target == "" {
		return ""
	}

	switch scope {
	case "repo":
		if rel := relPath(r.RepoRoot, target); rel != "" {
			return "./" + rel
		}
	case "user":
		if rel := relPath(r.HomeDir, target); rel != "" {
			return "~/" + rel
		}
		return "~/" + filepath.Base(target)
	case "global":
		return filepath.ToSlash(target)
	}

	return filepath.ToSlash(target)
}

// RedactPaths normalizes a list of paths for a scope.
func (r Redactor) RedactPaths(scope string, paths []string) []string {
	if len(paths) == 0 {
		return nil
	}
	redacted := make([]string, 0, len(paths))
	for _, path := range paths {
		redacted = append(redacted, r.RedactPath(scope, path))
	}
	return redacted
}

func relPath(root, target string) string {
	if root == "" {
		return ""
	}
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return ""
	}
	if rel == "." {
		return ""
	}
	normalized := filepath.ToSlash(rel)
	if strings.HasPrefix(normalized, "../") || normalized == ".." {
		return ""
	}
	return normalized
}
