package instructions

import "testing"

func TestAdapterClients(t *testing.T) {
	if (CodexAdapter{}).Client() != ClientCodex {
		t.Fatalf("expected codex client")
	}
	if (CopilotAdapter{}).Client() != ClientCopilot {
		t.Fatalf("expected copilot client")
	}
	if (VSCodeAdapter{}).Client() != ClientVSCode {
		t.Fatalf("expected vscode client")
	}
	if (ClaudeAdapter{}).Client() != ClientClaude {
		t.Fatalf("expected claude client")
	}
	if (GeminiAdapter{}).Client() != ClientGemini {
		t.Fatalf("expected gemini client")
	}
}
