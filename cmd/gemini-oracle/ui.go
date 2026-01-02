// Package main provides the gemini-oracle CLI tool.
package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Styles
var (
	subtle    = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	title     = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("212")).MarginBottom(1)
	modelName = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("63"))
	status    = lipgloss.NewStyle().Foreground(lipgloss.Color("86"))
	errStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
	box       = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).Padding(0, 1)
)

func initialModel(prompt string) oracleModel {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	return oracleModel{
		prompt:     prompt,
		flashState: stateThinking,
		proState:   stateThinking,
		synthState: stateThinking,
		startTime:  time.Now(),
		spinner:    s,

		flashModel: "flash",
		proModel:   "pro",
		synthModel: "gemini-3-pro-preview",
	}
}

func (m oracleModel) Init() tea.Cmd {
	return tea.Batch(
		runGemini("flash", m.prompt, m.flashModel),
		runGemini("pro", m.prompt, m.proModel),
		m.spinner.Tick,
	)
}

func (m oracleModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		if msg.String() == "ctrl+c" || msg.String() == "q" {
			return m, tea.Quit
		}

	case modelResult:
		switch msg.name {
		case "flash":
			m.flashState = stateDone
			m.flashOutput = msg.content
			if msg.err != nil {
				m.flashState = stateError
				m.flashOutput = msg.err.Error()
			}
		case "pro":
			m.proState = stateDone
			m.proOutput = msg.content
			if msg.err != nil {
				m.proState = stateError
				m.proOutput = msg.err.Error()
			}
		case "synth":
			m.synthState = stateDone
			m.synthOutput = msg.content
			if msg.err != nil {
				m.synthState = stateError
				m.synthOutput = msg.err.Error()
			}
			return m, tea.Quit
		}

		// Check if we can start synthesis
		if m.flashState != stateThinking && m.proState != stateThinking && m.synthState == stateThinking {
			synthPrompt := fmt.Sprintf(`I have gathered responses from different models for the following prompt:
---
%s
---

### Flash Model Response:
%s

### Pro Model Response:
%s

---
Please analyze these responses, resolve any contradictions, and provide a single, comprehensive, high-quality final answer. Use your deep thinking capabilities.`, m.prompt, m.flashOutput, m.proOutput)

			return m, runGemini("synth", synthPrompt, m.synthModel)
		}

	case spinner.TickMsg:
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}

	return m, nil
}

func (m oracleModel) View() string {
	if m.width == 0 || m.height == 0 {
		return "Initializing..."
	}

	s := strings.Builder{}

	s.WriteString(title.Render("Gemini Oracle"))
	s.WriteString("\n")

	// Calculate widths for the two initial model boxes
	boxWidth := (m.width - 6) / 2
	if boxWidth < 20 {
		boxWidth = 20
	}

	flashView := m.renderModelState("Flash", m.flashState, m.flashOutput, boxWidth)
	proView := m.renderModelState("Pro", m.proState, m.proOutput, boxWidth)

	s.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, flashView, proView))
	s.WriteString("\n")

	if m.flashState != stateThinking && m.proState != stateThinking {
		synthView := m.renderModelState(fmt.Sprintf("Synthesizer (%s)", m.synthModel), m.synthState, m.synthOutput, m.width-4)
		s.WriteString(synthView)
	} else {
		s.WriteString(subtle.Render(" Waiting for analysis models to finish..."))
	}

	s.WriteString("\n")
	elapsed := fmt.Sprintf("Time elapsed: %s", time.Since(m.startTime).Round(time.Second))
	help := "Press q to quit"

	// Right align help
	statusLine := elapsed + strings.Repeat(" ", max(0, m.width-len(elapsed)-len(help)-4)) + help
	s.WriteString(subtle.Render(statusLine))

	return box.Width(m.width - 2).Render(s.String())
}

func (m oracleModel) renderModelState(name string, state modelState, output string, width int) string {
	header := modelName.Render(name)
	var content string

	switch state {
	case stateThinking:
		content = fmt.Sprintf("%s Thinking...", m.spinner.View())
	case stateDone:
		// Truncate output for preview
		preview := output
		maxChars := width * 4 // Rough estimate for 4 lines
		if len(preview) > maxChars {
			preview = preview[:maxChars] + "..."
		}
		content = status.Render("Complete") + "\n" + subtle.Render(preview)
	case stateError:
		content = errStyle.Render("Error: " + output)
	}

	return lipgloss.NewStyle().Width(width).Height(8).Border(lipgloss.NormalBorder()).Padding(0, 1).Render(
		header + "\n" + content,
	)
}
