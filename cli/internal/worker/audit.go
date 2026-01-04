package worker

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/engine"
	"markdowntown-cli/internal/version"
)

func (s *Server) runAudit(ctx context.Context, req AuditRequest) (AuditResult, *workerError) {
	if req.Scan.SchemaVersion == "" {
		return AuditResult{}, newWorkerError(ErrCodeInvalidRequest, "scan schemaVersion is required", http.StatusBadRequest, nil)
	}
	if req.Scan.RepoRoot == "" {
		return AuditResult{}, newWorkerError(ErrCodeInvalidRequest, "scan repoRoot is required", http.StatusBadRequest, nil)
	}
	if s.registry.Version == "" {
		return AuditResult{}, newWorkerError(ErrCodeConfig, "registry version missing", http.StatusInternalServerError, nil)
	}

	redactMode := req.RedactMode
	if redactMode == "" {
		redactMode = audit.RedactAuto
	}

	rules, err := audit.FilterRules(audit.DefaultRules(), req.OnlyRules, req.IgnoreRules)
	if err != nil {
		return AuditResult{}, newWorkerError(ErrCodeInvalidRequest, err.Error(), http.StatusBadRequest, nil)
	}
	if len(req.SeverityOverrides) > 0 {
		updated, err := audit.ApplySeverityOverrides(rules, req.SeverityOverrides)
		if err != nil {
			return AuditResult{}, newWorkerError(ErrCodeInvalidRequest, err.Error(), http.StatusBadRequest, nil)
		}
		rules = updated
	}

	filtered, err := audit.FilterOutput(req.Scan, req.ExcludePaths)
	if err != nil {
		return AuditResult{}, newWorkerError(ErrCodeInvalidRequest, err.Error(), http.StatusBadRequest, nil)
	}

	xdgConfigHome := req.XDGConfigHome
	if xdgConfigHome == "" && req.HomeDir != "" {
		xdgConfigHome = filepath.Join(req.HomeDir, ".config")
	}

	redactor := audit.NewRedactor(filtered.RepoRoot, req.HomeDir, xdgConfigHome, redactMode)
	ctxAudit := audit.Context{
		Scan:     filtered,
		Registry: s.registry,
		Redactor: redactor,
	}

	auditStartedAt := time.Now()
	issues, err := engine.RunWithContext(ctx, ctxAudit, rules)
	if err != nil {
		return AuditResult{}, mapContextError(err)
	}

	normalizer := audit.NewEngine(redactor)
	issues = normalizer.NormalizeIssues(issues)

	generatedAt := time.Now()
	output := audit.Output{
		SchemaVersion:       version.AuditSchemaVersion,
		Audit:               audit.Meta{ToolVersion: version.ToolVersion, AuditStartedAt: auditStartedAt.UnixMilli(), GeneratedAt: generatedAt.UnixMilli()},
		SourceScan:          audit.SourceScan{SchemaVersion: filtered.SchemaVersion, ToolVersion: filtered.ToolVersion, RegistryVersion: filtered.RegistryVersion, RepoRoot: filtered.RepoRoot, ScanStartedAt: filtered.ScanStartedAt, GeneratedAt: filtered.GeneratedAt, Scans: filtered.Scans},
		RegistryVersionUsed: s.registry.Version,
		PathRedaction:       audit.RedactionInfo{Mode: redactMode, Enabled: redactMode != audit.RedactNever},
		Summary:             audit.BuildSummary(issues),
		Issues:              issues,
	}
	if req.IncludeScanWarnings {
		output.ScanWarnings = audit.BuildScanWarnings(filtered.Warnings, issues, redactor, filtered.RepoRoot)
	}

	return AuditResult{Output: output}, nil
}

func mapContextError(err error) *workerError {
	if errors.Is(err, context.DeadlineExceeded) {
		return newWorkerError(ErrCodeTimeout, "request timeout exceeded", http.StatusGatewayTimeout, nil)
	}
	if errors.Is(err, context.Canceled) {
		return newWorkerError(ErrCodeTimeout, "request canceled", http.StatusRequestTimeout, nil)
	}
	return newWorkerError(ErrCodeInternal, fmt.Sprintf("audit failed: %v", err), http.StatusInternalServerError, nil)
}
