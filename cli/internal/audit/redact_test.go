package audit

import "testing"

func TestRedactorRepoPath(t *testing.T) {
	redactor := NewRedactor("/repo", "/home/user", "/home/user/.config", RedactAuto)

	path := redactor.RedactPath("/repo/AGENTS.md", "repo")
	if path.Path != "./AGENTS.md" {
		t.Fatalf("expected repo-relative path, got %q", path.Path)
	}
	if path.Redacted {
		t.Fatalf("expected repo path not redacted")
	}
}

func TestRedactorNonRepoPaths(t *testing.T) {
	redactor := NewRedactor("/repo", "/home/user", "/home/user/.config", RedactAuto)

	homePath := redactor.RedactPath("/home/user/.copilot/config.json", "user")
	if homePath.Path != "$HOME/.copilot/config.json" {
		t.Fatalf("expected home redaction, got %q", homePath.Path)
	}
	if !homePath.Redacted || homePath.PathID == "" {
		t.Fatalf("expected redacted home path with pathId")
	}

	xdgPath := redactor.RedactPath("/home/user/.config/markdowntown/config.json", "user")
	if xdgPath.Path != "$XDG_CONFIG_HOME/markdowntown/config.json" {
		t.Fatalf("expected xdg redaction, got %q", xdgPath.Path)
	}
	if !xdgPath.Redacted || xdgPath.PathID == "" {
		t.Fatalf("expected redacted xdg path with pathId")
	}

	otherPath := redactor.RedactPath("/opt/secret.txt", "user")
	if otherPath.Path != "<ABS_PATH_1>" {
		t.Fatalf("expected placeholder, got %q", otherPath.Path)
	}
	if !otherPath.Redacted || otherPath.PathID == "" {
		t.Fatalf("expected redacted placeholder with pathId")
	}

	otherPathAgain := redactor.RedactPath("/opt/secret.txt", "user")
	if otherPathAgain.Path != otherPath.Path {
		t.Fatalf("expected stable placeholder for same path")
	}
}

func TestRedactorNever(t *testing.T) {
	redactor := NewRedactor("/repo", "/home/user", "/home/user/.config", RedactNever)
	path := redactor.RedactPath("/home/user/.copilot/config.json", "user")
	if path.Path != "/home/user/.copilot/config.json" {
		t.Fatalf("expected raw path, got %q", path.Path)
	}
	if path.Redacted {
		t.Fatalf("expected redacted=false for redact never")
	}
}
