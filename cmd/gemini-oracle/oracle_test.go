// Package main provides the gemini-oracle CLI tool.
package main

import (
	"errors"
	"strings"
	"testing"
)

func TestInitialModel(t *testing.T) {
	prompt := "What is the meaning of life?"
	m := initialModel(prompt)

	if m.prompt != prompt {
		t.Errorf("expected prompt %q, got %q", prompt, m.prompt)
	}
	if m.flashState != stateThinking || m.proState != stateThinking || m.synthState != stateThinking {
		t.Errorf("initial states should be stateThinking")
	}
}

func TestUpdateModelResult(t *testing.T) {
	prompt := "test prompt"
	m := initialModel(prompt)

	// Simulate flash finishing
	m2, _ := m.Update(modelResult{name: "flash", content: "flash response"})
	m = m2.(oracleModel)

	if m.flashState != stateDone {
		t.Errorf("expected flashState to be stateDone")
	}
	if m.flashOutput != "flash response" {
		t.Errorf("expected flashOutput to be 'flash response'")
	}

	// Simulate pro finishing
	m2, cmd := m.Update(modelResult{name: "pro", content: "pro response"})
	m = m2.(oracleModel)

	if m.proState != stateDone {
		t.Errorf("expected proState to be stateDone")
	}
	if m.proOutput != "pro response" {
		t.Errorf("expected proOutput to be 'pro response'")
	}

	// Check if synth command was triggered
	if cmd == nil {
		t.Errorf("expected synthesis command to be triggered after both flash and pro are done")
	}
}

func TestSynthesisError(t *testing.T) {
	prompt := "test prompt"
	m := initialModel(prompt)
	m.flashState = stateDone
	m.proState = stateDone

	// Simulate synth error
	m2, _ := m.Update(modelResult{name: "synth", content: "some error", err: errors.New("test error")})
	m = m2.(oracleModel)

	if m.synthState != stateError {
		t.Errorf("expected synthState to be stateError")
	}
}

func TestRenderModelState(t *testing.T) {
	m := initialModel("test")

	// Test thinking
	thinking := renderModelState("Test", stateThinking, "", m.flashSpinner, 0)
	if !strings.Contains(thinking, "Thinking...") {
		t.Errorf("rendered thinking state should contain 'Thinking...'")
	}

	// Test done
	done := renderModelState("Test", stateDone, "some output", m.flashSpinner, 0)
	if !strings.Contains(done, "Complete") || !strings.Contains(done, "some output") {
		t.Errorf("rendered done state should contain 'Complete' and output")
	}

	// Test error
	err := renderModelState("Test", stateError, "error message", m.flashSpinner, 0)
	if !strings.Contains(err, "Error: error message") {
		t.Errorf("rendered error state should contain error message")
	}
}