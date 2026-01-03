package scan

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestValidateRegistrySyntaxError(t *testing.T) {
	result := ValidateRegistry("/tmp/registry.json", []byte("{"))
	if result.Valid {
		t.Fatalf("expected invalid registry")
	}
	if result.Checks["syntax"].Passed {
		t.Fatalf("expected syntax check failure")
	}
}

func TestValidateRegistrySuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	t.Cleanup(server.Close)

	reg := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "p1",
				ToolID:       "tool-a",
				ToolName:     "Tool A",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{"AGENTS.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "auto",
				Docs:         []string{server.URL},
			},
		},
	}
	data, err := json.Marshal(reg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	result := ValidateRegistry("/tmp/registry.json", data)
	if !result.Valid {
		t.Fatalf("expected valid registry, got %+v", result)
	}
}
