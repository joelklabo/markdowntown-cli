package context //nolint:revive

import (
	"bufio"
	"strings"

	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/scan"

	"github.com/spf13/afero"
)

// SearchResult captures a single match in an instruction file.
type SearchResult struct {
	Client instructions.Client `json:"client"`
	Path   string              `json:"path"`
	Line   int                 `json:"line"`
	Text   string              `json:"text"`
}

// SearchInstructions searches for a query across all instruction files in the repo and user scope.
func SearchInstructions(repoRoot string, registry scan.Registry, query string) ([]SearchResult, error) {
	if query == "" {
		return nil, nil
	}

	// 1. Scan to find all instruction files
	scanRes, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		Registry:       registry,
		IncludeContent: true,
		Fs:             afero.NewOsFs(),
	})
	if err != nil {
		return nil, err
	}

	var results []SearchResult
	queryLower := strings.ToLower(query)

	for _, entry := range scanRes.Entries {
		if entry.Content == nil {
			continue
		}

		// We need to map scan entries back to clients.
		// A single entry might belong to multiple clients.
		clients := clientsForEntry(entry)

		scanner := bufio.NewScanner(strings.NewReader(*entry.Content))
		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := scanner.Text()
			if strings.Contains(strings.ToLower(line), queryLower) {
				for _, client := range clients {
					results = append(results, SearchResult{
						Client: client,
						Path:   entry.Path,
						Line:   lineNum,
						Text:   strings.TrimSpace(line),
					})
				}
			}
		}
	}

	return results, nil
}

func clientsForEntry(entry scan.ConfigEntry) []instructions.Client {
	var clients []instructions.Client

	for _, tool := range entry.Tools {
		var client instructions.Client
		switch tool.ToolID {
		case "gemini-cli":
			client = instructions.ClientGemini
		case "claude-code":
			client = instructions.ClientClaude
		case "codex":
			client = instructions.ClientCodex
		case "github-copilot", "github-copilot-cli":
			client = instructions.ClientCopilot
		case "vscode":
			client = instructions.ClientVSCode
		default:
			continue
		}

		found := false
		for _, c := range clients {
			if c == client {
				found = true
				break
			}
		}
		if !found {
			clients = append(clients, client)
		}
	}

	return clients
}
