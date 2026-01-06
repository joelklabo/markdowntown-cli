// Package upload coordinates scanning and snapshot uploads.
package upload

import (
	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/version"
	"time"
)

// ScanPayload wraps scan results for upload metadata.
type ScanPayload struct {
	SchemaVersion   string      `json:"schemaVersion"`
	ToolVersion     string      `json:"toolVersion"`
	RegistryVersion string      `json:"registryVersion"`
	ScanStartedAt   int64       `json:"scanStartedAt"`
	GeneratedAt     int64       `json:"generatedAt"`
	Result          scan.Result `json:"result"`
}

// NewScanPayload creates a payload from a scan result.
func NewScanPayload(result scan.Result, registryVersion string, startedAt, generatedAt time.Time) ScanPayload {
	return ScanPayload{
		SchemaVersion:   version.SchemaVersion,
		ToolVersion:     version.ToolVersion,
		RegistryVersion: registryVersion,
		ScanStartedAt:   startedAt.UnixMilli(),
		GeneratedAt:     generatedAt.UnixMilli(),
		Result:          result,
	}
}
