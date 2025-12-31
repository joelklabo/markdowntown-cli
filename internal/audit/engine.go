package audit

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
)

// Engine provides core helpers for audit output normalization.
type Engine struct {
	Redactor *Redactor
}

// NewEngine returns an Engine configured with the provided redactor.
func NewEngine(redactor *Redactor) *Engine {
	return &Engine{Redactor: redactor}
}

// NormalizeIssues sorts nested fields, applies fingerprints, and sorts the issue list.
func (e *Engine) NormalizeIssues(issues []Issue) []Issue {
	if issues == nil {
		return []Issue{}
	}
	for i := range issues {
		sortPaths(issues[i].Paths)
		sortTools(issues[i].Tools)
		issues[i].Fingerprint = FingerprintIssue(issues[i])
	}
	sortIssues(issues)
	return issues
}

// SeverityRank returns the ordering rank for severity (lower is higher priority).
func SeverityRank(severity Severity) int {
	switch severity {
	case SeverityError:
		return 0
	case SeverityWarning:
		return 1
	case SeverityInfo:
		return 2
	default:
		return 3
	}
}

func sortIssues(issues []Issue) {
	sort.SliceStable(issues, func(i, j int) bool {
		left := issues[i]
		right := issues[j]
		if SeverityRank(left.Severity) != SeverityRank(right.Severity) {
			return SeverityRank(left.Severity) < SeverityRank(right.Severity)
		}
		if left.RuleID != right.RuleID {
			return left.RuleID < right.RuleID
		}
		leftPath := primaryPath(left.Paths)
		rightPath := primaryPath(right.Paths)
		if leftPath != rightPath {
			return leftPath < rightPath
		}
		leftTool := primaryTool(left.Tools)
		rightTool := primaryTool(right.Tools)
		if leftTool != rightTool {
			return leftTool < rightTool
		}
		return primaryKind(left.Tools) < primaryKind(right.Tools)
	})
}

func sortPaths(paths []Path) {
	sort.SliceStable(paths, func(i, j int) bool {
		if paths[i].Path != paths[j].Path {
			return paths[i].Path < paths[j].Path
		}
		if paths[i].Scope != paths[j].Scope {
			return paths[i].Scope < paths[j].Scope
		}
		return paths[i].PathID < paths[j].PathID
	})
}

func sortTools(tools []Tool) {
	sort.SliceStable(tools, func(i, j int) bool {
		if tools[i].ToolID != tools[j].ToolID {
			return tools[i].ToolID < tools[j].ToolID
		}
		return tools[i].Kind < tools[j].Kind
	})
}

func primaryPath(paths []Path) string {
	if len(paths) == 0 {
		return ""
	}
	return paths[0].Path
}

func primaryTool(tools []Tool) string {
	if len(tools) == 0 {
		return ""
	}
	return tools[0].ToolID
}

func primaryKind(tools []Tool) string {
	if len(tools) == 0 {
		return ""
	}
	return tools[0].Kind
}

// FingerprintIssue returns a deterministic fingerprint for the issue.
func FingerprintIssue(issue Issue) string {
	input := fingerprintInput{
		RuleID:   issue.RuleID,
		Severity: issue.Severity,
		Paths:    fingerprintPaths(issue.Paths),
		Tools:    fingerprintTools(issue.Tools),
	}
	if len(issue.Evidence) > 0 {
		input.Evidence = fingerprintEvidence(issue.Evidence)
	}
	encoded, _ := json.Marshal(input)
	sum := sha256.Sum256(encoded)
	return "sha256:" + hex.EncodeToString(sum[:])
}

type fingerprintInput struct {
	RuleID   string            `json:"ruleId"`
	Severity Severity          `json:"severity"`
	Paths    []fingerprintPath `json:"paths"`
	Tools    []fingerprintTool `json:"tools"`
	Evidence []evidencePair    `json:"evidence,omitempty"`
}

type fingerprintPath struct {
	Key   string `json:"key"`
	Scope string `json:"scope"`
	ID    string `json:"id,omitempty"`
}

type fingerprintTool struct {
	ToolID string `json:"toolId"`
	Kind   string `json:"kind"`
}

type evidencePair struct {
	Key   string          `json:"key"`
	Value json.RawMessage `json:"value"`
}

func fingerprintPaths(paths []Path) []fingerprintPath {
	fp := make([]fingerprintPath, 0, len(paths))
	for _, path := range paths {
		key := path.Path
		if path.Scope != "repo" && path.PathID != "" {
			key = path.PathID
		}
		fp = append(fp, fingerprintPath{Key: key, Scope: path.Scope, ID: path.PathID})
	}
	sort.SliceStable(fp, func(i, j int) bool {
		if fp[i].Key != fp[j].Key {
			return fp[i].Key < fp[j].Key
		}
		return fp[i].Scope < fp[j].Scope
	})
	return fp
}

func fingerprintTools(tools []Tool) []fingerprintTool {
	fp := make([]fingerprintTool, 0, len(tools))
	for _, tool := range tools {
		fp = append(fp, fingerprintTool{ToolID: tool.ToolID, Kind: tool.Kind})
	}
	sort.SliceStable(fp, func(i, j int) bool {
		if fp[i].ToolID != fp[j].ToolID {
			return fp[i].ToolID < fp[j].ToolID
		}
		return fp[i].Kind < fp[j].Kind
	})
	return fp
}

func fingerprintEvidence(evidence map[string]any) []evidencePair {
	keys := make([]string, 0, len(evidence))
	for key := range evidence {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	pairs := make([]evidencePair, 0, len(keys))
	for _, key := range keys {
		valueBytes, _ := json.Marshal(evidence[key])
		pairs = append(pairs, evidencePair{Key: key, Value: valueBytes})
	}
	return pairs
}
