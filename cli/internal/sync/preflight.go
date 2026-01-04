package sync

import "fmt"

// PreflightResult summarizes repo snapshot size information.
type PreflightResult struct {
	FileCount    int
	TotalBytes   int64
	MaxFileBytes int64
}

// PreflightErrorKind identifies which limit was exceeded.
type PreflightErrorKind string

// PreflightMaxFiles, PreflightMaxTotalBytes, and PreflightMaxFileBytes identify limit violations.
const (
	PreflightMaxFiles      PreflightErrorKind = "max_files"
	PreflightMaxTotalBytes PreflightErrorKind = "max_total_bytes"
	PreflightMaxFileBytes  PreflightErrorKind = "max_file_bytes"
)

// PreflightError describes a preflight limit violation.
type PreflightError struct {
	Kind   PreflightErrorKind
	Limit  int64
	Actual int64
}

func (err *PreflightError) Error() string {
	switch err.Kind {
	case PreflightMaxFiles:
		return fmt.Sprintf("preflight limit exceeded: file count %d > %d", err.Actual, err.Limit)
	case PreflightMaxTotalBytes:
		return fmt.Sprintf("preflight limit exceeded: total bytes %d > %d", err.Actual, err.Limit)
	case PreflightMaxFileBytes:
		return fmt.Sprintf("preflight limit exceeded: max file bytes %d > %d", err.Actual, err.Limit)
	default:
		return "preflight limit exceeded"
	}
}

// Preflight scans the repo to compute file counts and size totals.
func Preflight(opts ManifestOptions) (PreflightResult, error) {
	repoRoot, err := normalizeRepoRoot(opts.RepoRoot)
	if err != nil {
		return PreflightResult{}, err
	}

	records, err := collectFileRecords(repoRoot)
	if err != nil {
		return PreflightResult{}, err
	}

	records, err = filterGitIgnored(repoRoot, records, opts.IncludeGitIgnored)
	if err != nil {
		return PreflightResult{}, err
	}

	return summarizeRecords(records, opts)
}

func summarizeRecords(records []fileRecord, opts ManifestOptions) (PreflightResult, error) {
	result := PreflightResult{}
	var maxFile int64

	for _, record := range records {
		size := record.info.Size()
		result.FileCount++
		result.TotalBytes += size
		if size > maxFile {
			maxFile = size
		}
	}

	result.MaxFileBytes = maxFile

	if opts.MaxFileBytes > 0 && maxFile > opts.MaxFileBytes {
		return result, &PreflightError{
			Kind:   PreflightMaxFileBytes,
			Limit:  opts.MaxFileBytes,
			Actual: maxFile,
		}
	}
	if opts.MaxFiles > 0 && result.FileCount > opts.MaxFiles {
		return result, &PreflightError{
			Kind:   PreflightMaxFiles,
			Limit:  int64(opts.MaxFiles),
			Actual: int64(result.FileCount),
		}
	}
	if opts.MaxTotalBytes > 0 && result.TotalBytes > opts.MaxTotalBytes {
		return result, &PreflightError{
			Kind:   PreflightMaxTotalBytes,
			Limit:  opts.MaxTotalBytes,
			Actual: result.TotalBytes,
		}
	}

	return result, nil
}
