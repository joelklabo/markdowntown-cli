package main

import (
	"bytes"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	context_pkg "markdowntown-cli/internal/context"
)

func TestContextJSONSearchFlagFiltersResults(t *testing.T) {
	repo := setupContextRepo(t)
	target := filepath.Join(repo, "AGENTS.md")

	var out bytes.Buffer
	if err := runContextWithIO(&out, []string{"--json", "--repo", repo, "--search", "deterministic", target}); err != nil {
		t.Fatalf("runContextWithIO: %v", err)
	}

	var payload context_pkg.JSONOutput
	if err := json.Unmarshal(out.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal context JSON: %v", err)
	}

	if len(payload.Search) == 0 {
		t.Fatalf("expected search results, got none")
	}

	for _, res := range payload.Search {
		if !strings.Contains(strings.ToLower(res.Text), "deterministic") {
			t.Fatalf("search result missing query text: %v", res)
		}
	}
}

func TestContextJSONCompareFlagEmitsDiff(t *testing.T) {
	repo := setupContextRepo(t)
	target := filepath.Join(repo, "AGENTS.md")

	var out bytes.Buffer
	if err := runContextWithIO(&out, []string{"--json", "--repo", repo, "--compare", "gemini,claude", target}); err != nil {
		t.Fatalf("runContextWithIO: %v", err)
	}

	var payload context_pkg.JSONOutput
	if err := json.Unmarshal(out.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal context JSON: %v", err)
	}

	if payload.Differences == nil {
		t.Fatalf("expected differences in output")
	}

	if len(payload.Differences.OnlyInA) == 0 && len(payload.Differences.OnlyInB) == 0 && len(payload.Differences.Changed) == 0 {
		clients := payload.Clients
		t.Fatalf("expected non-empty diff results, got %#v (gemini applied=%d, claude applied=%d)", payload.Differences, len(clients["gemini"].Applied), len(clients["claude"].Applied))
	}
}

func setupContextRepo(t *testing.T) string {
	t.Helper()

	repo := t.TempDir()
	fixtures := filepath.Join(repoRootFromCaller(t), "testdata", "repos", "integration")
	copyDir(t, fixtures, repo)
	initGitRepo(t, repo)

	t.Setenv("CODEX_HOME", filepath.Join(repo, ".codex"))
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(repo, "xdg", "config"))
	t.Setenv("XDG_CACHE_HOME", filepath.Join(repo, "xdg", "cache"))
	t.Setenv("XDG_DATA_HOME", filepath.Join(repo, "xdg", "data"))

	return repo
}
