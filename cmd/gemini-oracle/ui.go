package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/lipgloss"
)

// Styles
var (
	subtle    = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	dot       = lipgloss.NewStyle().Foreground(lipgloss.Color("236")).SetString(" • ")
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

	ta := textarea.New()
	ta.Placeholder = "Enter your prompt here..."
	ta.Focus()
	ta.CharLimit = 0 // Unlimited
	ta.SetHeight(5)
	ta.SetWidth(50)

	inputMode := prompt == ""

	return oracleModel{
		prompt:          prompt,
		inputMode:       inputMode,
		textarea:        ta,
		flashState:      stateThinking,
		flashSpinner:    s,
		proState:        stateThinking,
		proSpinner:      s,
		synthState:      stateThinking,
		synthSpinner:    s,
		synthViewport:   viewport.New(80, 20),
		flashResultChan: make(chan modelResult),
		proResultChan:   make(chan modelResult),
		synthResultChan: make(chan modelResult),
		startTime:       time.Now(),
	}
}

func (m oracleModel) Init() tea.Cmd {
	if m.inputMode {
		return textarea.Blink
	}
	return tea.Batch(
		m.flashSpinner.Tick,
		m.proSpinner.Tick,
		m.synthSpinner.Tick,
		runGemini("flash", m.prompt, m.flashResultChan),
		runGemini("pro", m.prompt, m.proResultChan),
		tickCmd(),
	)
}

type tickMsg time.Time

func tickCmd() tea.Cmd {
	return tea.Tick(time.Millisecond*100, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func (m oracleModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	// Handle input mode
	if m.inputMode {
		switch msg := msg.(type) {
		case tea.KeyMsg:
			if msg.Type == tea.KeyCtrlC || msg.Type == tea.KeyEsc {
				return m, tea.Quit
			}
			if msg.Type == tea.KeyEnter && !msg.Alt {
				m.inputMode = false
				m.prompt = m.textarea.Value()
				m.startTime = time.Now()
				cmds = append(cmds, 
					m.flashSpinner.Tick,
					m.proSpinner.Tick,
					m.synthSpinner.Tick,
					runGemini("flash", m.prompt, m.flashResultChan),
					runGemini("pro", m.prompt, m.proResultChan),
					tickCmd(),
				)
				return m, tea.Batch(cmds...)
		}
		}
		var cmd tea.Cmd
		m.textarea, cmd = m.textarea.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)
	}

	// Handle execution mode
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" || msg.String() == "q" {
			return m, tea.Quit
		}
		
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.synthViewport.Width = msg.Width - 4
		m.synthViewport.Height = msg.Height - 15 // Leave space for headers/status
		if m.synthState == stateDone {
			renderer, _ := glamour.NewTermRenderer(
				glamour.WithAutoStyle(),
				glamour.WithWordWrap(m.synthViewport.Width),
			)
			str, _ := renderer.Render(m.synthOutput)
			m.synthViewport.SetContent(str)
		}

	case modelResult:
		if msg.name == "flash" {
			m.flashState = stateDone
			m.flashOutput = msg.content
			if msg.err != nil {
				m.flashState = stateError
				m.flashOutput = msg.err.Error()
			}
		} else if msg.name == "pro" {
			m.proState = stateDone
			m.proOutput = msg.content
			if msg.err != nil {
				m.proState = stateError
				m.proOutput = msg.err.Error()
			}
		} else if msg.name == "synth" {
			m.synthState = stateDone
			m.synthOutput = msg.content
			if msg.err != nil {
				m.synthState = stateError
				m.synthOutput = msg.err.Error()
			}
			
			// Render Markdown
			renderer, _ := glamour.NewTermRenderer(
				glamour.WithAutoStyle(),
				glamour.WithWordWrap(m.synthViewport.Width),
			)
			str, _ := renderer.Render(m.synthOutput)
			m.synthViewport.SetContent(str)
			
			// Auto-scroll to top
			m.synthViewport.GotoTop()
			
			// We don't quit automatically anymore, letting user read the result
		}

		// Check if we can start synthesis
		if m.flashState != stateThinking && m.proState != stateThinking && m.synthState == stateThinking {
			// Both initial models finished
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
			
			cmds = append(cmds, runGemini("synth", synthPrompt, m.synthResultChan))
		}

	case tickMsg:
		if m.synthState != stateDone {
			cmds = append(cmds, tickCmd())
		}
		
	case spinner.TickMsg:
		var cmd tea.Cmd
		if m.flashState == stateThinking {
			m.flashSpinner, cmd = m.flashSpinner.Update(msg)
			cmds = append(cmds, cmd)
		}
		if m.proState == stateThinking {
			m.proSpinner, cmd = m.proSpinner.Update(msg)
			cmds = append(cmds, cmd)
		}
		if m.synthState == stateThinking {
			m.synthSpinner, cmd = m.synthSpinner.Update(msg)
			cmds = append(cmds, cmd)
		}
	}
	
	// Handle viewport updates if synth is done
	if m.synthState == stateDone {
		var cmd tea.Cmd
		m.synthViewport, cmd = m.synthViewport.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m oracleModel) View() string {
	if m.inputMode {
		return fmt.Sprintf(
			"%s\n\n%s\n\n%s",
			title.Render("Gemini Oracle"),
			m.textarea.View(),
			subtle.Render("(Press Enter to submit, Esc to quit)"),
		)
	}

	ss := strings.Builder{}

	ss.WriteString(title.Render("Gemini Oracle"))
	ss.WriteString("\n\n")

	// Grid layout simulated
	flashView := renderModelState("Flash", m.flashState, m.flashOutput, m.flashSpinner)
	proView := renderModelState("Pro", m.proState, m.proOutput, m.proSpinner)
	
	ss.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, flashView, proView))
	ss.WriteString("\n\n")

	if m.synthState == stateDone {
		ss.WriteString(modelName.Render("Gemini 3 Pro Preview (Synthesizer)"))
		ss.WriteString("\n")
		ss.WriteString(box.Render(m.synthViewport.View()))
	} else if m.flashState != stateThinking && m.proState != stateThinking {
		// Synthesis in progress
		ss.WriteString(fmt.Sprintf("%s %s", m.synthSpinner.View(), subtle.Render("Synthesizing final answer with Gemini 3 Pro Preview...")))
	} else {
		ss.WriteString(subtle.Render("Waiting for analysis models to finish..."))
	}

	ss.WriteString("\n\n")
	ss.WriteString(subtle.Render(fmt.Sprintf("Time elapsed: %s", time.Since(m.startTime).Round(time.Second))))
	
	if m.synthState == stateDone {
		ss.WriteString(subtle.Render(" • Press q to quit • Scroll with ↑/↓"))
	} else {
		ss.WriteString(subtle.Render(" • Press q to quit"))
	}

	return box.Render(ss.String())
}

func renderModelState(name string, state modelState, output string, spin spinner.Model) string {
	header := modelName.Render(name)
	var content string

	switch state {
	case stateThinking:
		content = fmt.Sprintf("%s Thinking...", spin.View())
	case stateDone:
		// Truncate output for preview
		preview := strings.ReplaceAll(output, "\n", " ")
		if len(preview) > 150 {
			preview = preview[:150] + "..."
		}
		content = status.Render("Complete") + "\n" + subtle.Render(preview)
	case stateError:
		content = errStyle.Render("Error: " + output)
	}

	return lipgloss.NewStyle().Width(38).Height(6).Border(lipgloss.NormalBorder()).Padding(0, 1).Render(
		header + "\n" + content,
	)
}