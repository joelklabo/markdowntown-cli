package main

import (
	"fmt"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	// Join all args as prompt
	prompt := ""
	if len(os.Args) > 1 {
		prompt = strings.Join(os.Args[1:], " ")
	}

	p := tea.NewProgram(initialModel(prompt), tea.WithAltScreen())
	m, err := p.Run()
	if err != nil {
		fmt.Printf("Alas, there's been an error: %v", err)
		os.Exit(1)
	}

	// Print final result to stdout if it finished (optional, as TUI shows it now)
	finalModel := m.(oracleModel)
	if finalModel.synthState == stateDone {
		// We could output raw text here if needed, but TUI handles it nicely.
		// Un-commenting below would duplicate output after TUI exit.
		// fmt.Println(finalModel.synthOutput)
	}
}