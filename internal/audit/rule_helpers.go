package audit

import (
	"sort"

	"markdowntown-cli/internal/scan"
)

// ConfigEntryRef links a config entry to a tool.
type ConfigEntryRef struct {
	Entry scan.ConfigEntry
	Tool  scan.ToolEntry
}

func collectEntries(refs []ConfigEntryRef) []scan.ConfigEntry {
	entries := make([]scan.ConfigEntry, 0, len(refs))
	seen := make(map[string]struct{})
	for _, ref := range refs {
		path := ref.Entry.Path
		if _, ok := seen[path]; ok {
			continue
		}
		seen[path] = struct{}{}
		entries = append(entries, ref.Entry)
	}
	return entries
}

func issueForEntry(ruleID string, severity Severity, title, message, suggestion string, entry scan.ConfigEntry, redactor Redactor) Issue {
	paths := redactor.RedactPaths(entry.Scope, []string{entry.Path})
	return Issue{
		RuleID:     ruleID,
		Severity:   severity,
		Title:      title,
		Message:    message,
		Suggestion: suggestion,
		Paths:      paths,
		Tools:      toolIDs(entry),
		Evidence:   []Evidence{buildEvidence(entry, redactor)},
	}
}

func toolIDs(entry scan.ConfigEntry) []string {
	ids := make([]string, 0, len(entry.Tools))
	seen := make(map[string]struct{})
	for _, tool := range entry.Tools {
		if tool.ToolID == "" {
			continue
		}
		if _, ok := seen[tool.ToolID]; ok {
			continue
		}
		seen[tool.ToolID] = struct{}{}
		ids = append(ids, tool.ToolID)
	}
	sort.Strings(ids)
	return ids
}

func buildEvidence(entry scan.ConfigEntry, redactor Redactor) Evidence {
	gitignored := entry.Gitignored
	return Evidence{
		Path:             redactor.RedactPath(entry.Scope, entry.Path),
		Scope:            entry.Scope,
		Sha256:           entry.Sha256,
		Warning:          entry.Warning,
		Error:            entry.Error,
		FrontmatterError: entry.FrontmatterError,
		Gitignored:       &gitignored,
	}
}

func evidenceList(entries []scan.ConfigEntry, redactor Redactor) []Evidence {
	byPath := make(map[string]Evidence)
	keys := make([]string, 0, len(entries))
	for _, entry := range entries {
		evidence := buildEvidence(entry, redactor)
		if evidence.Path == "" {
			continue
		}
		if _, ok := byPath[evidence.Path]; ok {
			continue
		}
		byPath[evidence.Path] = evidence
		keys = append(keys, evidence.Path)
	}
	sort.Strings(keys)
	result := make([]Evidence, 0, len(keys))
	for _, key := range keys {
		result = append(result, byPath[key])
	}
	return result
}

func uniqueRedactedPaths(entries []scan.ConfigEntry, redactor Redactor) []string {
	seen := make(map[string]struct{})
	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		path := redactor.RedactPath(entry.Scope, entry.Path)
		if path == "" {
			continue
		}
		if _, ok := seen[path]; ok {
			continue
		}
		seen[path] = struct{}{}
		paths = append(paths, path)
	}
	sort.Strings(paths)
	return paths
}
