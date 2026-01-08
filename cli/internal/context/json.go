package context //nolint:revive

import (
	"encoding/json"
	"io"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/instructions"
)

// JSONOutput represents the structured JSON output for the context command.
type JSONOutput struct {
	SchemaVersion string                  `json:"schemaVersion"`
	RepoRoot      string                  `json:"repoRoot"`
	FilePath      string                  `json:"filePath"`
	Clients       map[string]ClientOutput `json:"clients"`
	Differences   *Diff                   `json:"differences,omitempty"`
	Search        []SearchResult          `json:"search,omitempty"`
}

// ClientOutput represents the context resolution for a single client in JSON.
type ClientOutput struct {
	Applied     []AppliedFile `json:"applied"`
	Warnings    []string      `json:"warnings"`
	Diagnostics []audit.Issue `json:"diagnostics,omitempty"`
	Error       *string       `json:"error"`
}

// AppliedFile represents an applied instruction file in JSON.
type AppliedFile struct {
	Path   string `json:"path"`
	Scope  string `json:"scope"`
	Reason string `json:"reason"`
}

// WriteJSON writes the UnifiedResolution as structured JSON to the provided writer.
func WriteJSON(w io.Writer, res UnifiedResolution) error {
	return WriteJSONWithFullResults(w, res, nil, nil)
}

// WriteJSONWithDiff writes the UnifiedResolution and ContextDiff as structured JSON to the provided writer.
func WriteJSONWithDiff(w io.Writer, res UnifiedResolution, diff Diff) error {
	return WriteJSONWithFullResults(w, res, &diff, nil)
}

// WriteJSONWithFullResults writes the UnifiedResolution, ContextDiff and SearchResults as structured JSON to the provided writer.
func WriteJSONWithFullResults(w io.Writer, res UnifiedResolution, diff *Diff, search []SearchResult) error {
	output := JSONOutput{
		SchemaVersion: "1.0",
		RepoRoot:      res.RepoRoot,
		FilePath:      res.FilePath,
		Clients:       make(map[string]ClientOutput),
		Differences:   diff,
		Search:        search,
	}

	// Ensure all supported clients are present in output
	allClients := instructions.AllClients()

	for _, client := range allClients {
		clientName := string(client)
		result, ok := res.Results[client]

		if !ok {
			output.Clients[clientName] = ClientOutput{
				Applied:  []AppliedFile{},
				Warnings: []string{},
				Error:    nil,
			}
			continue
		}

		clientOut := ClientOutput{
			Applied:  []AppliedFile{},
			Warnings: []string{},
		}

		if result.Error != nil {
			errStr := result.Error.Error()
			clientOut.Error = &errStr
		}

		if result.Resolution != nil {
			for _, file := range result.Resolution.Applied {
				clientOut.Applied = append(clientOut.Applied, AppliedFile{
					Path:   file.Path,
					Scope:  string(file.Scope),
					Reason: string(file.Reason),
				})
			}
			clientOut.Warnings = result.Resolution.Warnings
			if clientOut.Warnings == nil {
				clientOut.Warnings = []string{}
			}
			if issues, ok := res.Diagnostics[client]; ok {
				clientOut.Diagnostics = issues
			}
		}

		output.Clients[clientName] = clientOut
	}

	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	return enc.Encode(output)
}
