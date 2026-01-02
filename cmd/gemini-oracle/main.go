// Package main provides the gemini-oracle CLI tool.
package main

import (
	"fmt"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: gemini-oracle <prompt>")
		os.Exit(1)
	}

	// Join all args as prompt
	prompt := strings.Join(os.Args[1:], " ")

	p := tea.NewProgram(initialModel(prompt))
	m, err := p.Run()
	if err != nil {
		fmt.Printf("Alas, there's been an error: %v", err)
		os.Exit(1)
	}

	// Print final result to stdout after TUI closes

	finalModel := m.(oracleModel)

	if finalModel.synthState == stateDone {

		fmt.Println("\n--- Final Answer ---")

		out, err := glamour.Render(finalModel.synthOutput, "dark")

		if err != nil {

			// Fallback to plain text if rendering fails

			fmt.Print(finalModel.synthOutput)

		} else {

			fmt.Print(out)

		}

	} else {

		fmt.Println("\nOperation cancelled or failed.")

	}

}
