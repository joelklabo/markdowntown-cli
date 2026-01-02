package main

import (
	"bytes"
	"os/exec"

	tea "github.com/charmbracelet/bubbletea"
)

func runGemini(name string, prompt string, ch chan modelResult) tea.Cmd {
	return func() tea.Msg {
		modelArg := ""
		switch name {
		case "flash":
			modelArg = "flash"
		case "pro":
			modelArg = "pro"
		case "synth":
			modelArg = "gemini-3-pro-preview"
		}

		// Use --approval-mode yolo to prevent blocking on confirmations
		cmd := exec.Command("gemini", "-m", modelArg, prompt, "--output-format", "text", "--approval-mode", "yolo")
		var out bytes.Buffer
		var stderr bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &stderr

		err := cmd.Run()
		content := out.String()
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