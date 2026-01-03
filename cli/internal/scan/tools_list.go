package scan

import "sort"

// ToolSummary aggregates registry patterns by tool.
type ToolSummary struct {
	ToolID       string   `json:"toolId"`
	ToolName     string   `json:"toolName"`
	PatternCount int      `json:"patternCount"`
	Docs         []string `json:"docs"`
}

// BuildToolSummaries groups registry patterns into tool summaries.
func BuildToolSummaries(reg Registry) []ToolSummary {
	byID := make(map[string]*ToolSummary)
	docsByID := make(map[string]map[string]struct{})

	for _, pattern := range reg.Patterns {
		summary, ok := byID[pattern.ToolID]
		if !ok {
			summary = &ToolSummary{
				ToolID:   pattern.ToolID,
				ToolName: pattern.ToolName,
			}
			byID[pattern.ToolID] = summary
			docsByID[pattern.ToolID] = make(map[string]struct{})
		}
		summary.PatternCount++

		for _, doc := range pattern.Docs {
			if doc == "" {
				continue
			}
			docsByID[pattern.ToolID][doc] = struct{}{}
		}
	}

	items := make([]ToolSummary, 0, len(byID))
	for id, summary := range byID {
		docs := make([]string, 0, len(docsByID[id]))
		for doc := range docsByID[id] {
			docs = append(docs, doc)
		}
		sort.Strings(docs)
		summary.Docs = docs
		items = append(items, *summary)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ToolID < items[j].ToolID
	})

	return items
}
