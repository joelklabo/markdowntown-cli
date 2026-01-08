package context //nolint:revive

import (
	"fmt"
	"strings"
	"testing"

	"markdowntown-cli/internal/instructions"
)

func TestWriteJSON(t *testing.T) {
	res := UnifiedResolution{
		RepoRoot: "/repo",
		FilePath: "src/main.go",
		Results: map[instructions.Client]ClientResult{
			instructions.ClientGemini: {
				Resolution: &instructions.Resolution{
					Applied: []instructions.InstructionFile{
						{Path: "/repo/GEMINI.md", Scope: instructions.ScopeRepo, Reason: instructions.ReasonPrimary},
					},
					Warnings: []string{"warning 1"},
				},
			},
			instructions.ClientClaude: {
				Error: fmt.Errorf("some error"),
			},
		},
	}

	var sb strings.Builder
	err := WriteJSON(&sb, res)
	if err != nil {
		t.Fatalf("WriteJSON failed: %v", err)
	}

	output := sb.String()

	// Check for schema version
	if !strings.Contains(output, "\"schemaVersion\": \"1.0\"") {
		t.Errorf("missing schemaVersion")
	}

	// Check for all 5 clients
	clients := []string{"gemini", "claude", "codex", "copilot", "vscode"}
	for _, client := range clients {
		if !strings.Contains(output, fmt.Sprintf("\"%s\":", client)) {
			t.Errorf("missing client: %s", client)
		}
	}

	// Check for error in claude
	if !strings.Contains(output, "\"error\": \"some error\"") {
		t.Errorf("missing or incorrect error for claude")
	}

	// Check for applied file in gemini
	if !strings.Contains(output, "/repo/GEMINI.md") {
		t.Errorf("missing applied file for gemini")
	}

	// Check for warnings in gemini
	if !strings.Contains(output, "warning 1") {
		t.Errorf("missing warning for gemini")
	}
}
