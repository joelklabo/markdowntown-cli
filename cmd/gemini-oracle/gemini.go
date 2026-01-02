package main

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func runGemini(name string, prompt string, _ chan modelResult) tea.Cmd {
	return func() tea.Msg {
		modelArg := ""
		timeout := 30 * time.Second

		switch name {
		case "flash":
			modelArg = "flash"
			timeout = 30 * time.Second
		case "pro":
			modelArg = "pro"
			timeout = 90 * time.Second
		case "synth":
			modelArg = "gemini-3-pro-preview"
			timeout = 180 * time.Second
		}

		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		// Use --approval-mode yolo to prevent blocking on confirmations
		cmd := exec.CommandContext(ctx, "gemini", "-m", modelArg, prompt, "--output-format", "text", "--approval-mode", "yolo")
		var out bytes.Buffer
		var stderr bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &stderr

		err := cmd.Run()
		content := out.String()

		if ctx.Err() == context.DeadlineExceeded {
			return modelResult{name: name, content: "", err: fmt.Errorf("timeout after %v", timeout)}
		}

		if err != nil {
			// Fallback to error message from stderr if available
			if stderr.Len() > 0 {
				content = stderr.String()
			}
			return modelResult{name: name, content: content, err: err}
		}

		return modelResult{name: name, content: content, err: nil}
	}
}
