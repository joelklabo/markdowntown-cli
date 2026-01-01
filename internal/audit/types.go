// Package audit provides schema types and helpers for audit output.
package audit

import "markdowntown-cli/internal/scan"

// Severity describes audit issue severity.
type Severity string

const (
	// SeverityError marks blocking issues.
	SeverityError Severity = "error"
	// SeverityWarning marks non-blocking issues.
	SeverityWarning Severity = "warning"
	// SeverityInfo marks informational issues.
	SeverityInfo Severity = "info"
)

// Output is the top-level audit output schema.
type Output struct {
	SchemaVersion       string        `json:"schemaVersion"`
	Audit               Meta          `json:"audit"`
	SourceScan          SourceScan    `json:"sourceScan"`
	RegistryVersionUsed string        `json:"registryVersionUsed"`
	PathRedaction       RedactionInfo `json:"pathRedaction"`
	Summary             Summary       `json:"summary"`
	Issues              []Issue       `json:"issues"`
	ScanWarnings        []ScanWarning `json:"scanWarnings,omitempty"`
}

// Meta captures metadata for the audit run.
type Meta struct {
	ToolVersion    string `json:"toolVersion"`
	AuditStartedAt int64  `json:"auditStartedAt"`
	GeneratedAt    int64  `json:"generatedAt"`
}

// SourceScan captures the scan metadata that audit consumes.
type SourceScan struct {
	SchemaVersion   string      `json:"schemaVersion"`
	ToolVersion     string      `json:"toolVersion"`
	RegistryVersion string      `json:"registryVersion"`
	RepoRoot        string      `json:"repoRoot"`
	ScanStartedAt   int64       `json:"scanStartedAt"`
	GeneratedAt     int64       `json:"generatedAt"`
	Scans           []scan.Root `json:"scans"`
}

// RedactionInfo reports the redaction mode used for this output.
type RedactionInfo struct {
	Mode    RedactMode `json:"mode"`
	Enabled bool       `json:"enabled"`
}

// Summary provides counts for emitted issues.
type Summary struct {
	IssueCounts SeverityCounts `json:"issueCounts"`
	RulesFired  []string       `json:"rulesFired,omitempty"`
}

// SeverityCounts provides per-severity totals.
type SeverityCounts struct {
	Error   int `json:"error"`
	Warning int `json:"warning"`
	Info    int `json:"info"`
}

// Issue represents a single audit issue.
type Issue struct {
	RuleID      string         `json:"ruleId"`
	Severity    Severity       `json:"severity"`
	Title       string         `json:"title,omitempty"`
	Message     string         `json:"message"`
	Suggestion  string         `json:"suggestion,omitempty"`
	Fingerprint string         `json:"fingerprint,omitempty"`
	Paths       []Path         `json:"paths"`
	Tools       []Tool         `json:"tools,omitempty"`
	Evidence    map[string]any `json:"evidence,omitempty"`
}

// Path describes an affected path in an issue.
type Path struct {
	Path     string `json:"path"`
	Scope    string `json:"scope"`
	Redacted bool   `json:"redacted"`
	PathID   string `json:"pathId,omitempty"`
}

// Tool describes a tool/kind pair associated with an issue.
type Tool struct {
	ToolID string `json:"toolId"`
	Kind   string `json:"kind"`
}

// ScanWarning is a pass-through warning from scan output.
type ScanWarning struct {
	Path    string `json:"path"`
	Code    string `json:"code"`
	Message string `json:"message"`
}
