package audit

import (
	"strings"
	"testing"

	"markdowntown-cli/internal/scan"
)

func TestRules(t *testing.T) {
	redactor := Redactor{RepoRoot: "/repo", HomeDir: "/home/joel"}

	t.Run("missing instructions", func(t *testing.T) {
		ctx := Context{
			Scan: scan.Output{
				RepoRoot: "/repo",
				Configs: []scan.ConfigEntry{
					{
						Path:  "/repo/.github/copilot.json",
						Scope: "repo",
						Tools: []scan.ToolEntry{{ToolID: "github-copilot", ToolName: "GitHub Copilot", Kind: "config"}},
					},
				},
			},
			Redactor: redactor,
		}

		issues, err := missingInstructionsRule{}.Apply(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 1 {
			t.Fatalf("expected 1 issue, got %d", len(issues))
		}
		issue := issues[0]
		if issue.RuleID != ruleMissingInstructions {
			t.Fatalf("unexpected rule ID: %s", issue.RuleID)
		}
		if issue.Severity != SeverityWarn {
			t.Fatalf("unexpected severity: %s", issue.Severity)
		}
		if len(issue.Paths) != 1 || issue.Paths[0] != "./.github/copilot.json" {
			t.Fatalf("unexpected paths: %+v", issue.Paths)
		}
	})

	t.Run("frontmatter error", func(t *testing.T) {
		errText := "bad yaml"
		ctx := Context{
			Scan: scan.Output{
				Configs: []scan.ConfigEntry{{
					Path:             "/repo/AGENTS.md",
					Scope:            "repo",
					FrontmatterError: &errText,
					Tools:            []scan.ToolEntry{{ToolID: "codex", ToolName: "Codex", Kind: "instructions"}},
				}},
			},
			Redactor: redactor,
		}
		issues, err := frontmatterErrorRule{}.Apply(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 1 || issues[0].RuleID != ruleFrontmatterError {
			t.Fatalf("unexpected issues: %+v", issues)
		}
	})

	t.Run("empty file", func(t *testing.T) {
		warning := "empty"
		ctx := Context{
			Scan: scan.Output{
				Configs: []scan.ConfigEntry{{
					Path:    "/repo/AGENTS.md",
					Scope:   "repo",
					Warning: &warning,
					Tools:   []scan.ToolEntry{{ToolID: "codex", ToolName: "Codex", Kind: "instructions"}},
				}},
			},
			Redactor: redactor,
		}
		issues, err := emptyFileRule{}.Apply(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 1 || issues[0].RuleID != ruleEmptyFile {
			t.Fatalf("unexpected issues: %+v", issues)
		}
	})

	t.Run("gitignored", func(t *testing.T) {
		ctx := Context{
			Scan: scan.Output{
				Configs: []scan.ConfigEntry{{
					Path:       "/repo/.github/copilot-instructions.md",
					Scope:      "repo",
					Gitignored: true,
					Tools:      []scan.ToolEntry{{ToolID: "github-copilot", ToolName: "GitHub Copilot", Kind: "instructions"}},
				}},
			},
			Redactor: redactor,
		}
		issues, err := gitignoredRule{}.Apply(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 1 || issues[0].RuleID != ruleGitignored {
			t.Fatalf("unexpected issues: %+v", issues)
		}
	})

	t.Run("requires setting", func(t *testing.T) {
		ctx := Context{
			Scan: scan.Output{
				Configs: []scan.ConfigEntry{{
					Path:  "/repo/.github/copilot-instructions.md",
					Scope: "repo",
					Tools: []scan.ToolEntry{{
						ToolID:   "github-copilot",
						ToolName: "GitHub Copilot",
						Kind:     "instructions",
						Hints: []scan.PatternHint{{
							Type:    "requires-setting",
							Setting: "github.copilot.chat.codeGeneration.useInstructionFiles",
						}},
					}},
				}},
			},
			Redactor: redactor,
		}
		issues, err := requiresSettingRule{}.Apply(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 1 || issues[0].RuleID != ruleRequiresSetting {
			t.Fatalf("unexpected issues: %+v", issues)
		}
		if !strings.Contains(issues[0].Message, "github.copilot") {
			t.Fatalf("unexpected message: %s", issues[0].Message)
		}
	})
}
