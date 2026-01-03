package lsp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/afero"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

func TestCodeActionDisableRuleCreatesSettings(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	s.rootPath = repoRoot
	s.fs = afero.NewOsFs()

	settingsDir := filepath.Join(repoRoot, ".vscode")
	if err := os.MkdirAll(settingsDir, 0o700); err != nil {
		t.Fatalf("mkdir settings dir: %v", err)
	}

	diag := protocol.Diagnostic{Code: &protocol.IntegerOrString{Value: "MD005"}}
	action := s.codeActionDisableRule(diag, filepath.Join(repoRoot, "AGENTS.md"))
	if action == nil {
		t.Fatal("expected code action")
	}
	if action.Edit == nil || len(action.Edit.DocumentChanges) == 0 {
		t.Fatalf("expected document changes for new settings file")
	}

	payload := extractSettingsPayload(t, action)
	settings := map[string]any{}
	if err := json.Unmarshal([]byte(payload), &settings); err != nil {
		t.Fatalf("unmarshal settings: %v", err)
	}
	rules := parseStringSlice(settings["markdowntown.diagnostics.rulesDisabled"])
	if len(rules) != 1 || rules[0] != "MD005" {
		t.Fatalf("expected rulesDisabled to include MD005, got %#v", rules)
	}
}

func TestCodeActionDisableRuleUpdatesSettings(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	s.rootPath = repoRoot
	s.fs = afero.NewOsFs()

	settingsDir := filepath.Join(repoRoot, ".vscode")
	if err := os.MkdirAll(settingsDir, 0o700); err != nil {
		t.Fatalf("mkdir settings dir: %v", err)
	}
	settingsPath := filepath.Join(settingsDir, "settings.json")
	if err := os.WriteFile(settingsPath, []byte("{\"markdowntown.diagnostics.rulesDisabled\":[\"MD002\"]}\n"), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}

	diag := protocol.Diagnostic{Code: &protocol.IntegerOrString{Value: "MD005"}}
	action := s.codeActionDisableRule(diag, filepath.Join(repoRoot, "AGENTS.md"))
	if action == nil {
		t.Fatal("expected code action")
	}
	if action.Edit == nil || len(action.Edit.Changes) == 0 {
		t.Fatalf("expected changes for existing settings file")
	}

	payload := extractSettingsPayload(t, action)
	settings := map[string]any{}
	if err := json.Unmarshal([]byte(payload), &settings); err != nil {
		t.Fatalf("unmarshal settings: %v", err)
	}
	rules := parseStringSlice(settings["markdowntown.diagnostics.rulesDisabled"])
	if len(rules) != 2 || rules[0] != "MD002" || rules[1] != "MD005" {
		t.Fatalf("expected sorted rulesDisabled to include MD002 and MD005, got %#v", rules)
	}

	if err := os.WriteFile(settingsPath, []byte(payload), 0o600); err != nil {
		t.Fatalf("apply settings payload: %v", err)
	}
	already := s.codeActionDisableRule(diag, filepath.Join(repoRoot, "AGENTS.md"))
	if already != nil {
		t.Fatalf("expected no action when rule already disabled")
	}
}

func TestDefaultQuickFixesForRule(t *testing.T) {
	cases := map[string]string{
		"MD002": quickFixAllowGitignore,
		"MD003": quickFixRemoveFrontmatter,
		"MD004": quickFixInsertPlaceholder,
		"MD005": quickFixCreateRepoConfig,
		"MD007": quickFixRemoveDuplicateFM,
		"MD012": quickFixInsertFrontmatterID,
		"MD015": quickFixReplaceToolID,
	}
	for ruleID, want := range cases {
		fixes := defaultQuickFixesForRule(ruleID)
		if len(fixes) != 1 || fixes[0] != want {
			t.Fatalf("rule %s expected %q, got %#v", ruleID, want, fixes)
		}
	}
	if fixes := defaultQuickFixesForRule("MD999"); fixes != nil {
		t.Fatalf("expected unknown rule to return nil, got %#v", fixes)
	}
}

func extractSettingsPayload(t *testing.T, action *protocol.CodeAction) string {
	t.Helper()
	if action == nil || action.Edit == nil {
		t.Fatal("expected action edit")
	}
	for _, edits := range action.Edit.Changes {
		if len(edits) == 0 {
			continue
		}
		return edits[0].NewText
	}
	for _, change := range action.Edit.DocumentChanges {
		edit, ok := change.(protocol.TextDocumentEdit)
		if !ok {
			continue
		}
		for _, editAny := range edit.Edits {
			if textEdit, ok := editAny.(protocol.TextEdit); ok {
				return textEdit.NewText
			}
		}
	}
	t.Fatal("no text edit payload found")
	return ""
}
