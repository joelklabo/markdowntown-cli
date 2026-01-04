// Package worker provides the native engine worker HTTP service.
package worker

import (
	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/suggest"
)

// RunType identifies the kind of worker run.
type RunType string

const (
	// RunTypeAudit requests an audit run.
	RunTypeAudit RunType = "audit"
	// RunTypeSuggest requests a suggest run.
	RunTypeSuggest RunType = "suggest"
)

// RunRequest defines a worker run invocation.
type RunRequest struct {
	ID        string          `json:"id,omitempty"`
	Type      RunType         `json:"type"`
	TimeoutMs int64           `json:"timeoutMs,omitempty"`
	Audit     *AuditRequest   `json:"audit,omitempty"`
	Suggest   *SuggestRequest `json:"suggest,omitempty"`
}

// AuditRequest describes an audit run input.
type AuditRequest struct {
	Scan                scan.Output               `json:"scan"`
	RedactMode          audit.RedactMode          `json:"redactMode,omitempty"`
	IncludeScanWarnings bool                      `json:"includeScanWarnings,omitempty"`
	OnlyRules           []string                  `json:"onlyRules,omitempty"`
	IgnoreRules         []string                  `json:"ignoreRules,omitempty"`
	ExcludePaths        []string                  `json:"excludePaths,omitempty"`
	SeverityOverrides   map[string]audit.Severity `json:"severityOverrides,omitempty"`
	HomeDir             string                    `json:"homeDir,omitempty"`
	XDGConfigHome       string                    `json:"xdgConfigHome,omitempty"`
}

// SuggestRequest describes a suggest run input.
type SuggestRequest struct {
	Client  string `json:"client"`
	Refresh bool   `json:"refresh,omitempty"`
	Offline bool   `json:"offline,omitempty"`
	Explain bool   `json:"explain,omitempty"`
}

// RunResponse captures the worker response.
type RunResponse struct {
	ID         string         `json:"id,omitempty"`
	Type       RunType        `json:"type,omitempty"`
	Ok         bool           `json:"ok"`
	DurationMs int64          `json:"durationMs,omitempty"`
	Audit      *AuditResult   `json:"audit,omitempty"`
	Suggest    *SuggestResult `json:"suggest,omitempty"`
	Error      *Error         `json:"error,omitempty"`
}

// AuditResult wraps audit output.
type AuditResult struct {
	Output audit.Output `json:"output"`
}

// SuggestResult wraps suggest output.
type SuggestResult struct {
	Report suggest.Report `json:"report"`
}

// Error conveys structured errors.
type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

const (
	// ErrCodeInvalidRequest indicates malformed or missing inputs.
	ErrCodeInvalidRequest = "invalid_request"
	// ErrCodeTimeout indicates the request exceeded its deadline.
	ErrCodeTimeout = "timeout"
	// ErrCodeUnsupported indicates an unsupported run type or method.
	ErrCodeUnsupported = "unsupported"
	// ErrCodeInternal indicates an internal failure.
	ErrCodeInternal = "internal_error"
	// ErrCodeConfig indicates a configuration problem (registry/sources).
	ErrCodeConfig = "config_error"
)
