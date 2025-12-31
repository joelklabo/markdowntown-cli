package scan

import "testing"

func FuzzCompileAndMatch(f *testing.F) {
	f.Add("glob", "**/AGENTS.md", "/repo/AGENTS.md", "AGENTS.md")
	f.Add("glob", ".cursor/rules/*.md", "/repo/.cursor/rules/main.md", ".cursor/rules/main.md")
	f.Add("glob", "~/Documents/Cline/Rules/**/*.md", "/Users/test/Documents/Cline/Rules/foo.md", "Documents/Cline/Rules/foo.md")
	f.Add("regex", ".*agents\\.md$", "/repo/AGENTS.md", "AGENTS.md")
	f.Add("regex", "(?i).*\\.md$", "/repo/README.md", "README.md")
	f.Add("regex", "^/repo/.*\\.toml$", "/repo/.codex/config.toml", ".codex/config.toml")

	f.Fuzz(func(t *testing.T, kind, raw, absPath, relPath string) {
		switch kind {
		case "", "glob", "regex":
			if kind == "" {
				kind = "glob"
			}
		default:
			if len(kind)%2 == 0 {
				kind = "glob"
			} else {
				kind = "regex"
			}
		}

		pm, err := compilePath(kind, raw)
		if err != nil {
			return
		}

		first, firstErr := pm.Match(absPath, relPath)
		second, secondErr := pm.Match(absPath, relPath)
		if firstErr != nil || secondErr != nil {
			t.Fatalf("match error: %v %v", firstErr, secondErr)
		}
		if first != second {
			t.Fatalf("non-deterministic match result: %v vs %v", first, second)
		}
	})
}
