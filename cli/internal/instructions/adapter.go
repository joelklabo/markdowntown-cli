// Package instructions resolves effective instruction chains for supported clients.
package instructions

import (
	"fmt"
	"strings"
)

// Client identifies a supported instruction client.
type Client string

const (
	// ClientCodex identifies the Codex client.
	ClientCodex Client = "codex"
	// ClientCopilot identifies the GitHub Copilot client.
	ClientCopilot Client = "copilot"
	// ClientVSCode identifies the VS Code client.
	ClientVSCode Client = "vscode"
	// ClientClaude identifies the Claude client.
	ClientClaude Client = "claude"
	// ClientGemini identifies the Gemini client.
	ClientGemini Client = "gemini"
)

// AllClients returns all supported instruction clients.
func AllClients() []Client {
	return []Client{
		ClientGemini,
		ClientClaude,
		ClientCodex,
		ClientCopilot,
		ClientVSCode,
	}
}

// ParseClient converts a string into a Client identifier.
func ParseClient(value string) (Client, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "codex":
		return ClientCodex, nil
	case "copilot":
		return ClientCopilot, nil
	case "vscode":
		return ClientVSCode, nil
	case "claude":
		return ClientClaude, nil
	case "gemini":
		return ClientGemini, nil
	default:
		return "", fmt.Errorf("unknown client: %s", value)
	}
}

// OrderGuarantee describes whether a merge order is deterministic.
type OrderGuarantee string

const (
	// OrderDeterministic indicates a deterministic merge order.
	OrderDeterministic OrderGuarantee = "deterministic"
	// OrderUndefined indicates no guaranteed merge order.
	OrderUndefined OrderGuarantee = "undefined"
)

// Scope identifies where an instruction file originates.
type Scope string

const (
	// ScopeUser indicates a user-scope instruction file.
	ScopeUser Scope = "user"
	// ScopeRepo indicates a repo-scope instruction file.
	ScopeRepo Scope = "repo"
)

// InstructionReason captures why a specific file was selected.
type InstructionReason string

const (
	// ReasonOverride indicates an override file took precedence.
	ReasonOverride InstructionReason = "override"
	// ReasonPrimary indicates a primary instruction file.
	ReasonPrimary InstructionReason = "primary"
	// ReasonFallback indicates a fallback instruction file.
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
	Client           Client            `json:"client"`
	RepoRoot         string            `json:"repoRoot"`
	Cwd              string            `json:"cwd"`
	TargetPath       string            `json:"targetPath,omitempty"`
	Applied          []InstructionFile `json:"applied"`
	OrderGuarantee   OrderGuarantee    `json:"orderGuarantee"`
	Conflicts        []Conflict        `json:"conflicts,omitempty"`
	SettingsRequired []string          `json:"settingsRequired,omitempty"`
	SizeLimits       []SizeLimit       `json:"sizeLimits,omitempty"`
	Warnings         []string          `json:"warnings,omitempty"`

	CodexHome         string   `json:"codexHome,omitempty"`
	ConfigPath        string   `json:"configPath,omitempty"`
	FallbackFilenames []string `json:"fallbackFilenames,omitempty"`
}

// InstructionFile records a resolved instruction file.
type InstructionFile struct {
	Path          string            `json:"path"`
	Scope         Scope             `json:"scope"`
	Dir           string            `json:"dir"`
	Reason        InstructionReason `json:"reason"`
	Bytes         int64             `json:"bytes"`
	IncludedBytes int64             `json:"includedBytes"`
	Truncated     bool              `json:"truncated"`
}

// Conflict describes an ordering or instruction conflict.
type Conflict struct {
	Reason string   `json:"reason"`
	Paths  []string `json:"paths"`
}

// SizeLimit captures an enforced size constraint.
type SizeLimit struct {
	Name   string `json:"name"`
	Bytes  int64  `json:"bytes"`
	Scope  Scope  `json:"scope"`
	Source string `json:"source"`
}

// Adapter resolves instruction chains for a client.
type Adapter interface {
	Client() Client
	Resolve(opts ResolveOptions) (Resolution, error)
}
