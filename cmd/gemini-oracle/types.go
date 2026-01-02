// Package main provides the gemini-oracle CLI tool.
package main

import (
	"time"

	"github.com/charmbracelet/bubbles/spinner"
)

type modelState int

const (
	stateThinking modelState = iota
	stateDone
	stateError
)

type modelResult struct {
	name    string
	content string
	err     error
}

type oracleModel struct {
	prompt      string
	flashState  modelState
	flashOutput string
	proState    modelState
	proOutput   string
	synthState  modelState
	synthOutput string
	startTime   time.Time
	spinner     spinner.Model
	width       int
	height      int

	// Configuration
	flashModel string
	proModel   string
	synthModel string
}
