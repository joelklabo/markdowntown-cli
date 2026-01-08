package context //nolint:revive

import (
	"context"
	"errors"
	"testing"

	"markdowntown-cli/internal/instructions"
)

type mockAdapter struct {
	client instructions.Client
	res    instructions.Resolution
	err    error
}

func (m mockAdapter) Client() instructions.Client {
	return m.client
}

func (m mockAdapter) Resolve(_ instructions.ResolveOptions) (instructions.Resolution, error) {
	return m.res, m.err
}

func TestResolveContext(t *testing.T) {
	tests := []struct {
		name           string
		opts           ResolveOptions
		adapterFactory func(instructions.Client) (instructions.Adapter, error)
		wantResults    int
		wantErr        bool
	}{
		{
			name: "multiple clients success",
			opts: ResolveOptions{
				RepoRoot: "/repo",
				FilePath: "main.go",
				Clients:  []instructions.Client{instructions.ClientGemini, instructions.ClientClaude},
			},
			adapterFactory: func(c instructions.Client) (instructions.Adapter, error) {
				return mockAdapter{
					client: c,
					res:    instructions.Resolution{Client: c},
				}, nil
			},
			wantResults: 2,
		},
		{
			name: "adapter factory failure",
			opts: ResolveOptions{
				RepoRoot: "/repo",
				FilePath: "main.go",
				Clients:  []instructions.Client{instructions.ClientGemini},
			},
			adapterFactory: func(_ instructions.Client) (instructions.Adapter, error) {
				return nil, errors.New("factory error")
			},
			wantResults: 1,
		},
		{
			name: "adapter resolve failure",
			opts: ResolveOptions{
				RepoRoot: "/repo",
				FilePath: "main.go",
				Clients:  []instructions.Client{instructions.ClientGemini},
			},
			adapterFactory: func(c instructions.Client) (instructions.Adapter, error) {
				return mockAdapter{
					client: c,
					err:    errors.New("resolve error"),
				}, nil
			},
			wantResults: 1,
		},
		{
			name: "empty clients",
			opts: ResolveOptions{
				RepoRoot: "/repo",
				FilePath: "main.go",
				Clients:  []instructions.Client{},
			},
			adapterFactory: func(_ instructions.Client) (instructions.Adapter, error) {
				return nil, nil
			},
			wantResults: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := &Resolver{
				AdapterFactory: tt.adapterFactory,
			}
			got, err := e.ResolveContext(context.Background(), tt.opts)
			if (err != nil) != tt.wantErr {
				t.Errorf("ResolveContext() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if len(got.Results) != tt.wantResults {
				t.Errorf("ResolveContext() results len = %v, want %v", len(got.Results), tt.wantResults)
			}

			if tt.name == "adapter factory failure" {
				if got.Results[instructions.ClientGemini].Error == nil {
					t.Errorf("expected factory error, got nil")
				}
			}

			if tt.name == "adapter resolve failure" {
				if got.Results[instructions.ClientGemini].Error == nil {
					t.Errorf("expected resolve error, got nil")
				}
			}
		})
	}
}

func TestNewEngine(t *testing.T) {
	e := NewEngine()
	if e == nil {
		t.Fatal("NewEngine() returned nil")
	}
	if e.AdapterFactory == nil {
		t.Error("NewEngine() returned resolver with nil AdapterFactory")
	}

	// Test a few clients to ensure the factory works
	clients := []instructions.Client{
		instructions.ClientGemini,
		instructions.ClientClaude,
		instructions.ClientCodex,
		instructions.ClientCopilot,
		instructions.ClientVSCode,
	}

	for _, c := range clients {
		adapter, err := e.AdapterFactory(c)
		if err != nil {
			t.Errorf("AdapterFactory failed for client %v: %v", c, err)
		}
		if adapter == nil {
			t.Errorf("AdapterFactory returned nil adapter for client %v", c)
		}
	}

	_, err := e.AdapterFactory("unknown")
	if err == nil {
		t.Error("AdapterFactory should have failed for unknown client")
	}
}

func TestResolveContext_Cancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	e := &Resolver{
		AdapterFactory: func(c instructions.Client) (instructions.Adapter, error) {
			return mockAdapter{client: c}, nil
		},
	}

	opts := ResolveOptions{
		RepoRoot: "/repo",
		FilePath: "main.go",
		Clients:  []instructions.Client{instructions.ClientGemini},
	}

	_, err := e.ResolveContext(ctx, opts)
	if err == nil {
		t.Error("expected error due to cancellation, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled error, got %v", err)
	}
}
