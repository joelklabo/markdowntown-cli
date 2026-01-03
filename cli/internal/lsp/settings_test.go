package lsp

import (
	"testing"

	"markdowntown-cli/internal/audit"
)

func TestParseSettingsDefaults(t *testing.T) {
	settings, warnings := ParseSettings(nil)
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %#v", warnings)
	}
	if !settings.Diagnostics.Enabled {
		t.Fatalf("expected diagnostics enabled by default")
	}
	if settings.Diagnostics.DelayMs != defaultDiagnosticsDelayMs {
		t.Fatalf("expected default delay %d, got %d", defaultDiagnosticsDelayMs, settings.Diagnostics.DelayMs)
	}
	if settings.Diagnostics.RedactPaths != audit.RedactNever {
		t.Fatalf("expected default redaction mode %s, got %s", audit.RedactNever, settings.Diagnostics.RedactPaths)
	}
}

func TestParseSettingsOverrides(t *testing.T) {
	input := map[string]any{
		"diagnostics": map[string]any{
			"enabled":            false,
			"delayMs":            250,
			"rulesEnabled":       []any{"MD001", "md002"},
			"rulesDisabled":      []string{"MD003"},
			"severityOverrides":  map[string]any{"MD002": "error"},
			"includeRelatedInfo": false,
			"includeEvidence":    false,
			"redactPaths":        "auto",
		},
	}

	settings, warnings := ParseSettings(input)
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %#v", warnings)
	}
	if settings.Diagnostics.Enabled {
		t.Fatalf("expected diagnostics disabled")
	}
	if settings.Diagnostics.DelayMs != 250 {
		t.Fatalf("expected delay 250, got %d", settings.Diagnostics.DelayMs)
	}
	if settings.Diagnostics.IncludeRelatedInfo {
		t.Fatalf("expected related info disabled")
	}
	if settings.Diagnostics.IncludeEvidence {
		t.Fatalf("expected evidence disabled")
	}
	if settings.Diagnostics.RedactPaths != audit.RedactAuto {
		t.Fatalf("expected redaction mode auto, got %s", settings.Diagnostics.RedactPaths)
	}
	if settings.Diagnostics.SeverityOverrides["MD002"] != audit.SeverityError {
		t.Fatalf("expected severity override for MD002")
	}
	if len(settings.Diagnostics.RulesEnabled) != 2 {
		t.Fatalf("expected rulesEnabled length 2, got %d", len(settings.Diagnostics.RulesEnabled))
	}
	if len(settings.Diagnostics.RulesDisabled) != 1 {
		t.Fatalf("expected rulesDisabled length 1, got %d", len(settings.Diagnostics.RulesDisabled))
	}
}

func TestParseSettingsWarnings(t *testing.T) {
	input := map[string]any{
		"diagnostics": map[string]any{
			"delayMs":           -1,
			"redactPaths":       "invalid",
			"severityOverrides": map[string]any{"MD001": "nope", "MD002": 3},
		},
	}

	settings, warnings := ParseSettings(input)
	if len(warnings) == 0 {
		t.Fatalf("expected warnings for invalid settings")
	}
	if settings.Diagnostics.DelayMs != defaultDiagnosticsDelayMs {
		t.Fatalf("expected delayMs to remain default, got %d", settings.Diagnostics.DelayMs)
	}
	if settings.Diagnostics.RedactPaths != audit.RedactNever {
		t.Fatalf("expected redactPaths to remain default, got %s", settings.Diagnostics.RedactPaths)
	}
}
