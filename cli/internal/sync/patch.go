package sync

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"markdowntown-cli/internal/git"
	"markdowntown-cli/internal/version"
)

const patchStateDir = "markdowntown"
const patchStateFile = "patches.json"
const devNullPath = "/dev/null" // #nosec G101 -- git diff sentinel path.

// Patch describes a patch returned from the CLI sync API.
type Patch struct {
	ID           string     `json:"id"`
	SnapshotID   string     `json:"snapshotId"`
	Path         string     `json:"path"`
	BaseBlobHash string     `json:"baseBlobHash"`
	PatchFormat  string     `json:"patchFormat"`
	PatchBody    string     `json:"patchBody,omitempty"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"createdAt"`
	AppliedAt    *time.Time `json:"appliedAt,omitempty"`
}

type patchListResponse struct {
	Patches []Patch `json:"patches"`
	Error   string  `json:"error,omitempty"`
}

type patchResponse struct {
	Patch Patch  `json:"patch"`
	Error string `json:"error,omitempty"`
}

// PatchApplyStatus is the outcome of applying a patch.
type PatchApplyStatus string

// PatchApplyStatus values describe patch apply outcomes.
const (
	PatchApplied  PatchApplyStatus = "applied"
	PatchDryRun   PatchApplyStatus = "dry-run"
	PatchSkipped  PatchApplyStatus = "skipped"
	PatchConflict PatchApplyStatus = "conflict"
	PatchFailed   PatchApplyStatus = "failed"
)

// ApplyOptions configures patch apply behavior.
type ApplyOptions struct {
	DryRun bool
	Force  bool
}

// ApplyResult captures the result of applying a patch.
type ApplyResult struct {
	Patch  Patch
	Status PatchApplyStatus
	Err    error
}

// FetchPatches retrieves patches for a snapshot.
func FetchPatches(ctx context.Context, client *Client, snapshotID string) ([]Patch, error) {
	query := url.Values{}
	query.Set("snapshotId", snapshotID)
	query.Set("includeBody", "1")
	status, body, err := client.getJSON(ctx, "/api/cli/patches", query)
	if err != nil {
		return nil, err
	}
	if status >= http.StatusBadRequest {
		return nil, parseAPIError(status, body)
	}
	var resp patchListResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	if resp.Error != "" {
		return nil, &APIError{Status: status, Message: resp.Error}
	}
	return resp.Patches, nil
}

// FetchPatch retrieves a single patch by ID.
func FetchPatch(ctx context.Context, client *Client, patchID string) (Patch, error) {
	query := url.Values{}
	query.Set("patchId", patchID)
	status, body, err := client.getJSON(ctx, "/api/cli/patches", query)
	if err != nil {
		return Patch{}, err
	}
	if status >= http.StatusBadRequest {
		return Patch{}, parseAPIError(status, body)
	}
	var resp patchResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return Patch{}, err
	}
	if resp.Error != "" {
		return Patch{}, &APIError{Status: status, Message: resp.Error}
	}
	if resp.Patch.ID == "" {
		return Patch{}, errors.New("patch response missing id")
	}
	return resp.Patch, nil
}

// ApplyPatches applies patches to the repo, optionally as a dry run.
func ApplyPatches(repoRoot string, patches []Patch, options ApplyOptions) ([]ApplyResult, error) {
	state, err := loadPatchState(repoRoot)
	if err != nil {
		return nil, err
	}

	results := make([]ApplyResult, 0, len(patches))
	checkedClean := false
	for _, patch := range patches {
		if patch.ID == "" {
			return results, errors.New("patch missing id")
		}
		if !strings.EqualFold(patch.Status, "PROPOSED") && patch.Status != "" {
			results = append(results, ApplyResult{Patch: patch, Status: PatchSkipped})
			continue
		}
		if state.has(patch.ID) {
			results = append(results, ApplyResult{Patch: patch, Status: PatchSkipped})
			continue
		}
		if strings.TrimSpace(patch.PatchBody) == "" {
			return results, fmt.Errorf("patch %s missing body", patch.ID)
		}
		if err := validatePatchPaths(patch.PatchBody); err != nil {
			wrapped := fmt.Errorf("patch %s has invalid paths: %w", patch.ID, err)
			results = append(results, ApplyResult{Patch: patch, Status: PatchFailed, Err: wrapped})
			return results, wrapped
		}
		if !options.DryRun && !options.Force && !checkedClean {
			clean, err := git.IsClean(repoRoot)
			if err != nil {
				results = append(results, ApplyResult{Patch: patch, Status: PatchFailed, Err: err})
				return results, err
			}
			checkedClean = true
			if !clean {
				err := errors.New("working tree has uncommitted changes; commit/stash or use --force")
				results = append(results, ApplyResult{Patch: patch, Status: PatchFailed, Err: err})
				return results, err
			}
		}

		err := git.ApplyPatch(repoRoot, []byte(patch.PatchBody), git.ApplyOptions{DryRun: options.DryRun})
		if err != nil {
			status := PatchFailed
			if errors.Is(err, git.ErrPatchConflict) {
				status = PatchConflict
			}
			results = append(results, ApplyResult{Patch: patch, Status: status, Err: err})
			return results, err
		}

		status := PatchApplied
		if options.DryRun {
			status = PatchDryRun
		} else {
			state.record(patch)
			if err := savePatchState(repoRoot, state); err != nil {
				results = append(results, ApplyResult{Patch: patch, Status: PatchFailed, Err: err})
				return results, err
			}
		}
		results = append(results, ApplyResult{Patch: patch, Status: status})
	}

	return results, nil
}

func validatePatchPaths(patchBody string) error {
	scanner := bufio.NewScanner(strings.NewReader(patchBody))
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "diff --git "):
			fields, err := splitPatchFields(line)
			if err != nil {
				return err
			}
			if len(fields) >= 4 {
				if err := validatePatchPathToken(normalizePatchPath(fields[2])); err != nil {
					return err
				}
				if err := validatePatchPathToken(normalizePatchPath(fields[3])); err != nil {
					return err
				}
			}
		case strings.HasPrefix(line, "--- ") || strings.HasPrefix(line, "+++ "):
			trimmed := strings.TrimSpace(line[4:])
			if trimmed == "" {
				continue
			}
			fields, err := splitPatchFields(trimmed)
			if err != nil {
				return err
			}
			if len(fields) >= 1 {
				if err := validatePatchPathToken(normalizePatchPath(fields[0])); err != nil {
					return err
				}
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return nil
}

func splitPatchFields(line string) ([]string, error) {
	var fields []string
	var current strings.Builder
	inQuote := false
	escaped := false

	for i := 0; i < len(line); i++ {
		ch := line[i]
		if escaped {
			current.WriteByte(ch)
			escaped = false
			continue
		}
		if inQuote && ch == '\\' {
			escaped = true
			continue
		}
		if ch == '"' {
			inQuote = !inQuote
			continue
		}
		if !inQuote && (ch == ' ' || ch == '\t') {
			if current.Len() > 0 {
				fields = append(fields, current.String())
				current.Reset()
			}
			continue
		}
		current.WriteByte(ch)
	}

	if escaped {
		return nil, errors.New("unterminated escape in patch path")
	}
	if inQuote {
		return nil, errors.New("unterminated quote in patch path")
	}
	if current.Len() > 0 {
		fields = append(fields, current.String())
	}
	return fields, nil
}

func normalizePatchPath(token string) string {
	token = strings.TrimSpace(token)
	if token == devNullPath {
		return token
	}
	if strings.HasPrefix(token, "a/") || strings.HasPrefix(token, "b/") {
		return token[2:]
	}
	return token
}

func validatePatchPathToken(token string) error {
	if token == "" {
		return errors.New("patch path is empty")
	}
	if token == devNullPath {
		return nil
	}
	if strings.Contains(token, "\\") {
		return fmt.Errorf("patch path contains backslash: %s", token)
	}
	if path.IsAbs(token) {
		return fmt.Errorf("patch path is absolute: %s", token)
	}
	clean := path.Clean(token)
	if clean == "." {
		return errors.New("patch path is empty")
	}
	if clean == ".." || strings.HasPrefix(clean, "../") {
		return fmt.Errorf("patch path escapes repo: %s", token)
	}
	lower := strings.ToLower(clean)
	if lower == ".git" || strings.HasPrefix(lower, ".git/") {
		return fmt.Errorf("patch path targets .git: %s", token)
	}
	return nil
}

func (c *Client) getJSON(ctx context.Context, endpoint string, query url.Values) (int, []byte, error) {
	urlStr, err := c.resolveEndpoint(endpoint)
	if err != nil {
		return 0, nil, err
	}

	if len(query) > 0 {
		parsed, err := url.Parse(urlStr)
		if err != nil {
			return 0, nil, err
		}
		parsed.RawQuery = query.Encode()
		urlStr = parsed.String()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return 0, nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("markdowntown-cli/%s", version.ToolVersion))
	if token := strings.TrimSpace(c.Token); token != "" {
		req.Header.Set("Authorization", formatAuthHeader(c.TokenType, token))
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}

	return resp.StatusCode, data, nil
}

type patchState struct {
	Applied []appliedPatch `json:"applied"`
}

type appliedPatch struct {
	PatchID    string    `json:"patchId"`
	SnapshotID string    `json:"snapshotId"`
	Path       string    `json:"path"`
	AppliedAt  time.Time `json:"appliedAt"`
}

func (state patchState) has(patchID string) bool {
	for _, entry := range state.Applied {
		if entry.PatchID == patchID {
			return true
		}
	}
	return false
}

func (state *patchState) record(patch Patch) {
	if state == nil {
		return
	}
	for i, entry := range state.Applied {
		if entry.PatchID == patch.ID {
			state.Applied[i].AppliedAt = time.Now()
			return
		}
	}
	state.Applied = append(state.Applied, appliedPatch{
		PatchID:    patch.ID,
		SnapshotID: patch.SnapshotID,
		Path:       patch.Path,
		AppliedAt:  time.Now(),
	})
}

func loadPatchState(repoRoot string) (patchState, error) {
	path, err := patchStatePath(repoRoot)
	if err != nil {
		return patchState{}, err
	}

	// #nosec G304 -- path is derived from the repo git dir.
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return patchState{}, nil
		}
		return patchState{}, err
	}

	var state patchState
	if err := json.Unmarshal(data, &state); err != nil {
		return patchState{}, err
	}
	return state, nil
}

func savePatchState(repoRoot string, state patchState) error {
	path, err := patchStatePath(repoRoot)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	data, err := json.Marshal(state)
	if err != nil {
		return err
	}

	if err := os.WriteFile(path, data, 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func patchStatePath(repoRoot string) (string, error) {
	gitDir, err := resolveGitDir(repoRoot)
	if err != nil {
		return "", err
	}
	return filepath.Join(gitDir, patchStateDir, patchStateFile), nil
}

func resolveGitDir(repoRoot string) (string, error) {
	gitPath := filepath.Join(repoRoot, ".git")
	info, err := os.Stat(gitPath)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return gitPath, nil
	}
	// #nosec G304 -- path is derived from the repo root.
	data, err := os.ReadFile(gitPath)
	if err != nil {
		return "", err
	}
	line := strings.TrimSpace(string(data))
	const prefix = "gitdir:"
	if strings.HasPrefix(line, prefix) {
		dir := strings.TrimSpace(strings.TrimPrefix(line, prefix))
		if dir == "" {
			return "", errors.New("gitdir is empty")
		}
		if !filepath.IsAbs(dir) {
			dir = filepath.Join(repoRoot, dir)
		}
		return dir, nil
	}
	return "", errors.New("unable to resolve git dir")
}
