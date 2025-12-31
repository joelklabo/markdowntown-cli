package audit

import (
	"testing"

	"markdowntown-cli/internal/scan"
)

func TestFilters(t *testing.T) {
	t.Run("rules", func(t *testing.T) {
		rules := []Rule{
			staticRule{id: "A"},
			staticRule{id: "B"},
		}

		filtered, err := FilterRules(rules, []string{"B"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(filtered) != 1 || filtered[0].ID() != "A" {
			t.Fatalf("unexpected filtered rules: %+v", filtered)
		}

		if _, err := FilterRules(rules, []string{"C"}); err == nil {
			t.Fatalf("expected error for unknown rule ID")
		}
	})

	t.Run("scan", func(t *testing.T) {
		scanOutput := scan.Output{
			Configs: []scan.ConfigEntry{
				{Path: "/repo/AGENTS.md"},
				{Path: "/repo/docs/readme.txt"},
				{Path: "/repo/keep.yaml"},
			},
			Warnings: []scan.Warning{
				{Path: "/repo/AGENTS.md"},
				{Path: "/repo/keep.yaml"},
			},
		}

		filtered, err := FilterScan(scanOutput, []string{"AGENTS.md", "*.txt"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(filtered.Configs) != 1 || filtered.Configs[0].Path != "/repo/keep.yaml" {
			t.Fatalf("unexpected configs after filter: %+v", filtered.Configs)
		}
		if len(filtered.Warnings) != 1 || filtered.Warnings[0].Path != "/repo/keep.yaml" {
			t.Fatalf("unexpected warnings after filter: %+v", filtered.Warnings)
		}

		if _, err := FilterScan(scanOutput, []string{"[invalid"}); err == nil {
			t.Fatalf("expected error for invalid pattern")
		}
	})

	t.Run("redact", func(t *testing.T) {
		redactor := Redactor{RepoRoot: "/repo", HomeDir: "/home/joel"}
		if got := redactor.RedactPath("repo", "/repo/docs/file.md"); got != "./docs/file.md" {
			t.Fatalf("unexpected repo redaction: %s", got)
		}
		if got := redactor.RedactPath("user", "/home/joel/.config/tool/config.json"); got != "~/.config/tool/config.json" {
			t.Fatalf("unexpected user redaction: %s", got)
		}
		if got := redactor.RedactPath("user", "/other/path/secret.txt"); got != "~/secret.txt" {
			t.Fatalf("unexpected fallback user redaction: %s", got)
		}
		if got := redactor.RedactPath("global", "/etc/markdowntown/config.json"); got != "/etc/markdowntown/config.json" {
			t.Fatalf("unexpected global redaction: %s", got)
		}
	})
}
