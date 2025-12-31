// Package audit provides deterministic audit output for scan results.
package audit

import "markdowntown-cli/internal/scan"

// SchemaVersion is the output schema version for audit results.
const SchemaVersion = "1.0"

// Severity describes the severity of an audit issue.
type Severity string

const (
	SeverityError Severity = "error"
	SeverityWarn  Severity = "warn"
	SeverityInfo  Severity = "info"
)

// Output is the top-level audit JSON structure.
type Output struct {
	SchemaVersion   string    `json:"schemaVersion"`
	ToolVersion     string    `json:"toolVersion"`
	RegistryVersion string    `json:"registryVersion"`
	AuditStartedAt  int64     `json:"auditStartedAt"`
	GeneratedAt     int64     `json:"generatedAt"`
	Input           InputMeta `json:"input"`
	Summary         Summary   `json:"summary"`
	Issues          []Issue   `json:"issues"`
}

// InputMeta captures the scan metadata used for the audit.
type InputMeta struct {
	RepoRoot        string   `json:"repoRoot"`
	ScanStartedAt   int64    `json:"scanStartedAt"`
	ScanGeneratedAt int64    `json:"scanGeneratedAt"`
	Scans           []string `json:"scans"`
}

// Summary reports total issue counts per severity.
type Summary struct {
	Total int `json:"total"`
	Error int `json:"error"`
	Warn  int `json:"warn"`
	Info  int `json:"info"`
}

// Issue describes a single audit finding.
type Issue struct {
	RuleID     string     `json:"ruleId"`
	Severity   Severity   `json:"severity"`
	Title      string     `json:"title"`
	Message    string     `json:"message"`
	Suggestion string     `json:"suggestion"`
	Paths      []string   `json:"paths"`
	Tools      []string   `json:"tools"`
	Evidence   []Evidence `json:"evidence"`
}

// Evidence attaches supporting metadata for an issue.
type Evidence struct {
	Path             string  `json:"path"`
	Scope            string  `json:"scope"`
	Sha256           *string `json:"sha256"`
	Warning          *string `json:"warning"`
	Error            *string `json:"error"`
	FrontmatterError *string `json:"frontmatterError"`
	Gitignored       *bool   `json:"gitignored"`
}

// Context carries scan output to rule implementations.
type Context struct {
	Scan scan.Output
}

// Rule evaluates scan output and returns zero or more issues.
type Rule interface {
	ID() string
	Apply(ctx Context) ([]Issue, error)
}
