// Package instructions resolves effective instruction chains for supported clients.
package instructions

// Client identifies a supported instruction client.
type Client string

const (
	ClientCodex   Client = "codex"
	ClientCopilot Client = "copilot"
	ClientVSCode  Client = "vscode"
	ClientClaude  Client = "claude"
	ClientGemini  Client = "gemini"
)

// OrderGuarantee describes whether a merge order is deterministic.
type OrderGuarantee string

const (
	OrderDeterministic OrderGuarantee = "deterministic"
	OrderUndefined     OrderGuarantee = "undefined"
)

// Scope identifies where an instruction file originates.
type Scope string

const (
	ScopeUser Scope = "user"
	ScopeRepo Scope = "repo"
)

// InstructionReason captures why a specific file was selected.
type InstructionReason string

const (
	ReasonOverride InstructionReason = "override"
	ReasonPrimary  InstructionReason = "primary"
	ReasonFallback InstructionReason = "fallback"
)

// ResolveOptions configures adapter resolution inputs.
type ResolveOptions struct {
	RepoRoot   string
	Cwd        string
	TargetPath string
	Settings   map[string]bool
}

// Resolution captures the resolved instruction chain and metadata.
type Resolution struct {
	Client           Client
	RepoRoot         string
	Cwd              string
	TargetPath       string
	Applied          []InstructionFile
	OrderGuarantee   OrderGuarantee
	Conflicts        []Conflict
	SettingsRequired []string
	SizeLimits       []SizeLimit
	Warnings         []string

	CodexHome         string
	ConfigPath        string
	FallbackFilenames []string
}

// InstructionFile records a resolved instruction file.
type InstructionFile struct {
	Path          string
	Scope         Scope
	Dir           string
	Reason        InstructionReason
	Bytes         int64
	IncludedBytes int64
	Truncated     bool
}

// Conflict describes an ordering or instruction conflict.
type Conflict struct {
	Reason string
	Paths  []string
}

// SizeLimit captures an enforced size constraint.
type SizeLimit struct {
	Name   string
	Bytes  int64
	Scope  Scope
	Source string
}

// Adapter resolves instruction chains for a client.
type Adapter interface {
	Client() Client
	Resolve(opts ResolveOptions) (Resolution, error)
}
