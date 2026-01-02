package main

import (
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
)

type modelResult struct {
	name    string
	content string
	err     error
}

type modelState int

const (
	stateThinking modelState = iota
	stateDone
	stateError
)

type oracleModel struct {
	prompt          string
	
	// Input mode components
	inputMode       bool
	textarea        textarea.Model
	
	// Execution components
	flashState      modelState
	flashOutput     string
	flashSpinner    spinner.Model
	
	proState        modelState
	proOutput       string
	proSpinner      spinner.Model
	
	synthState      modelState
	synthOutput     string
	synthSpinner    spinner.Model
	synthViewport   viewport.Model
	
	err             error
	
	// Channels
	flashResultChan chan modelResult
	proResultChan   chan modelResult
	synthResultChan chan modelResult
	
	// Metrics
	startTime       time.Time
	width           int
	height          int
}