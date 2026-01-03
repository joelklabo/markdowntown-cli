package lsp

import (
	"encoding/json"
	"fmt"
	"strings"

	"markdowntown-cli/internal/audit"
)

const defaultDiagnosticsDelayMs = 500

// Settings captures configuration supplied via initializationOptions or didChangeConfiguration.
type Settings struct {
	Diagnostics DiagnosticsSettings
}

// DiagnosticCapabilities captures client support for diagnostic metadata.
type DiagnosticCapabilities struct {
	RelatedInformation bool
	CodeDescription    bool
	Tags               bool
}

// DiagnosticsSettings controls diagnostic output and filtering.
type DiagnosticsSettings struct {
	Enabled            bool
	DelayMs            int
	RulesEnabled       []string
	RulesDisabled      []string
	SeverityOverrides  map[string]audit.Severity
	IncludeRelatedInfo bool
	IncludeEvidence    bool
	RedactPaths        audit.RedactMode
}

// DefaultSettings returns the baseline configuration.
func DefaultSettings() Settings {
	return Settings{
		Diagnostics: DiagnosticsSettings{
			Enabled:            true,
			DelayMs:            defaultDiagnosticsDelayMs,
			RulesEnabled:       nil,
			RulesDisabled:      nil,
			SeverityOverrides:  map[string]audit.Severity{},
			IncludeRelatedInfo: true,
			IncludeEvidence:    true,
			RedactPaths:        audit.RedactNever,
		},
	}
}

// ParseSettings reads settings from a generic input payload.
func ParseSettings(input any) (Settings, []string) {
	settings := DefaultSettings()
	if input == nil {
		return settings, nil
	}

	root, ok := input.(map[string]any)
	if !ok {
		return settings, nil
	}

	if nested, ok := root["markdowntown"].(map[string]any); ok {
		root = nested
	}

	diagRaw, ok := root["diagnostics"]
	if !ok {
		return settings, nil
	}

	diag, ok := diagRaw.(map[string]any)
	if !ok {
		return settings, []string{"diagnostics settings must be an object"}
	}

	var warnings []string

	if value, ok := readBool(diag, "enabled"); ok {
		settings.Diagnostics.Enabled = value
	}
	if value, ok := readInt(diag, "delayMs"); ok {
		if value < 0 {
			warnings = append(warnings, "diagnostics.delayMs must be >= 0")
		} else {
			settings.Diagnostics.DelayMs = value
		}
	}
	if value, ok := readBool(diag, "includeRelatedInfo"); ok {
		settings.Diagnostics.IncludeRelatedInfo = value
	}
	if value, ok := readBool(diag, "includeEvidence"); ok {
		settings.Diagnostics.IncludeEvidence = value
	}
	if value, ok := readString(diag, "redactPaths"); ok {
		mode, err := audit.ParseRedactMode(value)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("diagnostics.redactPaths: %v", err))
		} else {
			settings.Diagnostics.RedactPaths = mode
		}
	}

	if value, ok := diag["rulesEnabled"]; ok {
		settings.Diagnostics.RulesEnabled = parseStringSlice(value)
	}
	if value, ok := diag["rulesDisabled"]; ok {
		settings.Diagnostics.RulesDisabled = parseStringSlice(value)
	}
	if value, ok := diag["severityOverrides"]; ok {
		settings.Diagnostics.SeverityOverrides = parseSeverityOverrides(value, &warnings)
	}

	return settings, warnings
}

func readBool(source map[string]any, key string) (bool, bool) {
	value, ok := source[key]
	if !ok {
		return false, false
	}
	typed, ok := value.(bool)
	return typed, ok
}

func readInt(source map[string]any, key string) (int, bool) {
	value, ok := source[key]
	if !ok {
		return 0, false
	}
	switch typed := value.(type) {
	case int:
		return typed, true
	case int32:
		return int(typed), true
	case int64:
		return int(typed), true
	case float64:
		return int(typed), true
	case float32:
		return int(typed), true
	case json.Number:
		if parsed, err := typed.Int64(); err == nil {
			return int(parsed), true
		}
	}
	return 0, false
}

func readString(source map[string]any, key string) (string, bool) {
	value, ok := source[key]
	if !ok {
		return "", false
	}
	typed, ok := value.(string)
	if !ok {
		return "", false
	}
	return strings.TrimSpace(typed), true
}

func parseStringSlice(value any) []string {
	switch typed := value.(type) {
	case []string:
		return normalizeStrings(typed)
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			str, ok := item.(string)
			if !ok {
				continue
			}
			out = append(out, str)
		}
		return normalizeStrings(out)
	case string:
		return normalizeStrings([]string{typed})
	default:
		return nil
	}
}

func normalizeStrings(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		out = append(out, value)
	}
	return out
}

func parseSeverityOverrides(value any, warnings *[]string) map[string]audit.Severity {
	switch typed := value.(type) {
	case map[string]any:
		return parseSeverityOverridesMap(typed, warnings)
	case map[string]string:
		raw := make(map[string]any, len(typed))
		for key, val := range typed {
			raw[key] = val
		}
		return parseSeverityOverridesMap(raw, warnings)
	default:
		return map[string]audit.Severity{}
	}
}

func parseSeverityOverridesMap(raw map[string]any, warnings *[]string) map[string]audit.Severity {
	overrides := make(map[string]audit.Severity, len(raw))
	for key, rawValue := range raw {
		ruleID := strings.ToUpper(strings.TrimSpace(key))
		if ruleID == "" {
			continue
		}
		rawString, ok := rawValue.(string)
		if !ok {
			if warnings != nil {
				*warnings = append(*warnings, fmt.Sprintf("diagnostics.severityOverrides[%s] must be a string", ruleID))
			}
			continue
		}
		sev, err := audit.ParseSeverity(rawString)
		if err != nil {
			if warnings != nil {
				*warnings = append(*warnings, fmt.Sprintf("diagnostics.severityOverrides[%s]: %v", ruleID, err))
			}
			continue
		}
		overrides[ruleID] = sev
	}
	return overrides
}
