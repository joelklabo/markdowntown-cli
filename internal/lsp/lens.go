package lsp

import (
	"fmt"
	"path/filepath"
	"strings"

	"markdowntown-cli/internal/scan"

	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

func (s *Server) codeLens(_ *glsp.Context, params *protocol.CodeLensParams) ([]protocol.CodeLens, error) {
	if params == nil {
		return nil, nil
	}
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return nil, err
	}
	return s.lensForPath(path)
}

func (s *Server) lensForPath(path string) ([]protocol.CodeLens, error) {
	repoRoot := repoRootForPath(s.rootPath, path)

	repoOnly := true
	var userRoots []string
	if userRoot, ok := userRootForPath(path); ok {
		repoOnly = false
		userRoots = []string{userRoot}
	} else if _, ok := relativeRepoPath(repoRoot, path); !ok {
		repoOnly = false
		userRoots = []string{filepath.Dir(path)}
	}

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return nil, nil
	}

	var stdinPaths []string
	if _, err := s.overlay.Stat(path); err == nil {
		if _, err := s.base.Stat(path); err != nil {
			stdinPaths = append(stdinPaths, path)
		}
	}

	result, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		RepoOnly:       repoOnly,
		IncludeContent: false,
		StdinPaths:     stdinPaths,
		UserRoots:      userRoots,
		Registry:       registry,
		Fs:             s.fs,
	})
	if err != nil {
		return nil, nil
	}
	if updated, err := scan.ApplyGitignore(result, repoRoot); err == nil {
		result = updated
	}

	entry := scan.EntryForPath(result, path)
	if entry == nil || len(entry.Tools) == 0 {
		return nil, nil
	}

	label := lensLabel(result, entry)
	if label == "" {
		return nil, nil
	}

	lens := protocol.CodeLens{
		Range: protocol.Range{
			Start: protocol.Position{Line: 0, Character: 0},
			End:   protocol.Position{Line: 0, Character: 0},
		},
		Command: &protocol.Command{
			Title:   label,
			Command: "editor.action.showHover",
		},
	}

	return []protocol.CodeLens{lens}, nil
}

func lensLabel(result scan.Result, entry *scan.ConfigEntry) string {
	if entry == nil {
		return ""
	}
	if shadowedBy, _ := scan.ShadowingEntry(result, entry.Path); shadowedBy != nil {
		return fmt.Sprintf("Shadowed by %s", lensDisplayPath(*shadowedBy, result.Scans))
	}
	return fmt.Sprintf("Active (%s Scope)", lensScopeLabel(entry.Scope))
}

func lensScopeLabel(scope string) string {
	switch scope {
	case scan.ScopeRepo:
		return "Repo"
	case scan.ScopeUser:
		return "User"
	case "global":
		return "Global"
	default:
		if scope == "" {
			return "Unknown"
		}
		return strings.ToUpper(scope[:1]) + scope[1:]
	}
}

func lensDisplayPath(entry scan.ConfigEntry, scans []scan.Root) string {
	path := entry.Path
	root := lensRootForEntry(entry, scans)
	if root != "" {
		if rel, err := filepath.Rel(root, entry.Path); err == nil && rel != "." {
			path = rel
		}
	}
	return filepath.ToSlash(path)
}

func lensRootForEntry(entry scan.ConfigEntry, scans []scan.Root) string {
	var fallback string
	var best string
	for _, root := range scans {
		if root.Scope != entry.Scope {
			continue
		}
		if fallback == "" {
			fallback = root.Root
		}
		if pathWithinRoot(root.Root, entry.Path) && len(root.Root) > len(best) {
			best = root.Root
		}
	}
	if best != "" {
		return best
	}
	return fallback
}
