// Package context provides the engine for resolving file context.
package context //nolint:revive

import (
	"context"
	"fmt"
	"markdowntown-cli/internal/instructions"
)

// Engine defines the interface for retrieving context for a file.
type Engine interface {
	// ResolveContext returns the aggregated context for a specific file path
	// across requested clients.
	ResolveContext(ctx context.Context, opts ResolveOptions) (UnifiedResolution, error)
}

// ResolveOptions configures the context resolution.
type ResolveOptions struct {
	RepoRoot string
	FilePath string
	Clients  []instructions.Client // e.g. [ClientCodex, ClientGemini]
}

// UnifiedResolution contains the resolution results for multiple clients.
type UnifiedResolution struct {
	RepoRoot string
	FilePath string
	Results  map[instructions.Client]ClientResult
}

// ClientResult captures the outcome for a single client.
type ClientResult struct {
	Resolution *instructions.Resolution
	Error      error // Critical error preventing resolution (e.g. malformed config)
}

// Resolver implements the Engine interface.
type Resolver struct {
	// AdapterFactory allows creating adapters for different clients.
	AdapterFactory func(instructions.Client) (instructions.Adapter, error)
}

// NewEngine creates a standard Resolver.
func NewEngine() *Resolver {
	return &Resolver{
		AdapterFactory: func(c instructions.Client) (instructions.Adapter, error) {
			switch c {
			case instructions.ClientGemini:
				return instructions.GeminiAdapter{}, nil
			case instructions.ClientCodex:
				return instructions.CodexAdapter{}, nil
			case instructions.ClientCopilot:
				return instructions.CopilotAdapter{}, nil
			case instructions.ClientVSCode:
				return instructions.VSCodeAdapter{}, nil
			case instructions.ClientClaude:
				return instructions.ClaudeAdapter{}, nil
			default:
				return nil, fmt.Errorf("unsupported client: %s", c)
			}
		},
	}
}

// ResolveContext implements Engine.
func (e *Resolver) ResolveContext(_ context.Context, opts ResolveOptions) (UnifiedResolution, error) {
	unified := UnifiedResolution{
		RepoRoot: opts.RepoRoot,
		FilePath: opts.FilePath,
		Results:  make(map[instructions.Client]ClientResult),
	}

	for _, client := range opts.Clients {
		adapter, err := e.AdapterFactory(client)
		if err != nil {
			unified.Results[client] = ClientResult{Error: err}
			continue
		}

		res, err := adapter.Resolve(instructions.ResolveOptions{
			RepoRoot:   opts.RepoRoot,
			TargetPath: opts.FilePath,
		})

		unified.Results[client] = ClientResult{
			Resolution: &res,
			Error:      err,
		}
	}

	return unified, nil
}
