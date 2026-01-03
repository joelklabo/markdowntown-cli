package scan

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ValidationResult describes the registry validation output schema.
type ValidationResult struct {
	Valid        bool                   `json:"valid"`
	RegistryPath string                 `json:"registryPath"`
	Version      string                 `json:"version"`
	PatternCount int                    `json:"patternCount"`
	ToolCount    int                    `json:"toolCount"`
	Checks       map[string]CheckResult `json:"checks"`
}

// CheckResult captures an individual validation check.
type CheckResult struct {
	Passed  bool          `json:"passed"`
	Details []CheckDetail `json:"details,omitempty"`
}

// CheckDetail provides per-item validation details.
type CheckDetail struct {
	PatternID string `json:"patternId,omitempty"`
	URL       string `json:"url,omitempty"`
	Field     string `json:"field,omitempty"`
	Error     string `json:"error,omitempty"`
	Pattern   string `json:"pattern,omitempty"`
}

// ValidateRegistry runs schema and pattern checks on raw registry JSON.
func ValidateRegistry(path string, data []byte) ValidationResult {
	result := ValidationResult{
		RegistryPath: path,
		Checks:       make(map[string]CheckResult),
	}

	var reg Registry
	if err := json.Unmarshal(data, &reg); err != nil {
		result.Checks["syntax"] = CheckResult{
			Passed: false,
			Details: []CheckDetail{{
				Error: err.Error(),
			}},
		}
		result.Checks["schema"] = CheckResult{Passed: false}
		result.Checks["patterns"] = CheckResult{Passed: false}
		result.Checks["uniqueIds"] = CheckResult{Passed: false}
		result.Checks["docsReachable"] = CheckResult{Passed: false}
		result.Valid = false
		return result
	}

	result.Checks["syntax"] = CheckResult{Passed: true}
	result.Version = reg.Version
	result.PatternCount = len(reg.Patterns)
	result.ToolCount = countTools(reg)

	schemaDetails := validateSchema(reg)
	result.Checks["schema"] = CheckResult{
		Passed:  len(schemaDetails) == 0,
		Details: schemaDetails,
	}

	patternDetails := validatePatterns(reg)
	result.Checks["patterns"] = CheckResult{
		Passed:  len(patternDetails) == 0,
		Details: patternDetails,
	}

	uniqueDetails := validateUniqueIDs(reg)
	result.Checks["uniqueIds"] = CheckResult{
		Passed:  len(uniqueDetails) == 0,
		Details: uniqueDetails,
	}

	docsDetails := validateDocs(reg)
	result.Checks["docsReachable"] = CheckResult{
		Passed:  len(docsDetails) == 0,
		Details: docsDetails,
	}

	result.Valid = result.Checks["schema"].Passed &&
		result.Checks["patterns"].Passed &&
		result.Checks["uniqueIds"].Passed &&
		result.Checks["docsReachable"].Passed

	return result
}

func countTools(reg Registry) int {
	seen := make(map[string]struct{})
	for _, pattern := range reg.Patterns {
		if pattern.ToolID == "" {
			continue
		}
		seen[pattern.ToolID] = struct{}{}
	}
	return len(seen)
}

func validateSchema(reg Registry) []CheckDetail {
	var details []CheckDetail
	if strings.TrimSpace(reg.Version) == "" {
		details = append(details, CheckDetail{
			Field: "version",
			Error: "missing registry version",
		})
	}

	for i, pattern := range reg.Patterns {
		id := pattern.ID
		if id == "" {
			id = fmt.Sprintf("index-%d", i)
		}
		patternDump := dumpPattern(pattern)
		if strings.TrimSpace(pattern.ID) == "" {
			details = append(details, CheckDetail{PatternID: id, Field: "id", Error: "missing id", Pattern: patternDump})
		}
		if strings.TrimSpace(pattern.ToolID) == "" {
			details = append(details, CheckDetail{PatternID: id, Field: "toolId", Error: "missing toolId", Pattern: patternDump})
		}
		if strings.TrimSpace(pattern.ToolName) == "" {
			details = append(details, CheckDetail{PatternID: id, Field: "toolName", Error: "missing toolName", Pattern: patternDump})
		}
		if strings.TrimSpace(pattern.Kind) == "" {
			details = append(details, CheckDetail{PatternID: id, Field: "kind", Error: "missing kind", Pattern: patternDump})
		}
		if strings.TrimSpace(pattern.Scope) == "" {
			details = append(details, CheckDetail{PatternID: id, Field: "scope", Error: "missing scope", Pattern: patternDump})
		}
		if len(pattern.Paths) == 0 {
			details = append(details, CheckDetail{PatternID: id, Field: "paths", Error: "missing paths", Pattern: patternDump})
		}
		if strings.TrimSpace(pattern.LoadBehavior) == "" {
			details = append(details, CheckDetail{PatternID: id, Field: "loadBehavior", Error: "missing loadBehavior", Pattern: patternDump})
		}
		if strings.TrimSpace(pattern.Application) == "" {
			details = append(details, CheckDetail{PatternID: id, Field: "application", Error: "missing application", Pattern: patternDump})
		}
		if len(pattern.Docs) == 0 {
			details = append(details, CheckDetail{PatternID: id, Field: "docs", Error: "missing docs", Pattern: patternDump})
		}
	}

	return details
}

func validatePatterns(reg Registry) []CheckDetail {
	var details []CheckDetail
	for i, pattern := range reg.Patterns {
		id := pattern.ID
		if id == "" {
			id = fmt.Sprintf("index-%d", i)
		}
		patternType := strings.ToLower(strings.TrimSpace(pattern.Type))
		if patternType == "" {
			patternType = "glob"
		}

		for _, rawPath := range pattern.Paths {
			if _, err := compilePath(patternType, rawPath); err != nil {
				details = append(details, CheckDetail{
					PatternID: id,
					Error:     err.Error(),
					Pattern:   dumpPattern(pattern),
				})
			}
		}
	}

	return details
}

func validateUniqueIDs(reg Registry) []CheckDetail {
	seen := make(map[string]struct{})
	var details []CheckDetail
	for _, pattern := range reg.Patterns {
		if pattern.ID == "" {
			continue
		}
		if _, ok := seen[pattern.ID]; ok {
			details = append(details, CheckDetail{
				PatternID: pattern.ID,
				Error:     "duplicate id",
			})
			continue
		}
		seen[pattern.ID] = struct{}{}
	}
	return details
}

func validateDocs(reg Registry) []CheckDetail {
	client := http.Client{Timeout: 10 * time.Second}
	var details []CheckDetail

	for _, pattern := range reg.Patterns {
		for _, doc := range pattern.Docs {
			if doc == "" {
				continue
			}
			resp, err := client.Get(doc)
			if err != nil {
				details = append(details, CheckDetail{
					PatternID: pattern.ID,
					URL:       doc,
					Error:     err.Error(),
				})
				continue
			}
			_ = resp.Body.Close()
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				details = append(details, CheckDetail{
					PatternID: pattern.ID,
					URL:       doc,
					Error:     resp.Status,
				})
			}
		}
	}

	return details
}

func dumpPattern(pattern Pattern) string {
	data, err := json.Marshal(pattern)
	if err != nil {
		return ""
	}
	return string(data)
}
