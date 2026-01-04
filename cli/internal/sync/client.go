// Package sync provides helpers for CLI sync workflows.
package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"markdowntown-cli/internal/version"
)

const defaultClientTimeout = 30 * time.Second

// Client is a minimal API client for the CLI upload endpoints.
type Client struct {
	BaseURL   string
	Token     string
	TokenType string
	Client    *http.Client
}

// UploadManifestEntry is sent as part of the upload handshake.
type UploadManifestEntry struct {
	Path        string `json:"path"`
	BlobHash    string `json:"blobHash"`
	SizeBytes   int64  `json:"sizeBytes"`
	Mode        int64  `json:"mode,omitempty"`
	Mtime       int64  `json:"mtime,omitempty"`
	IsDeleted   bool   `json:"isDeleted,omitempty"`
	ContentType string `json:"contentType,omitempty"`
	IsBinary    bool   `json:"isBinary,omitempty"`
}

// UploadHandshakeRequest is sent to the handshake endpoint.
type UploadHandshakeRequest struct {
	ProjectID       string                `json:"projectId,omitempty"`
	ProjectSlug     string                `json:"projectSlug,omitempty"`
	ProjectName     string                `json:"projectName,omitempty"`
	Provider        string                `json:"provider,omitempty"`
	RepoRoot        string                `json:"repoRoot,omitempty"`
	ProtocolVersion string                `json:"protocolVersion,omitempty"`
	IdempotencyKey  string                `json:"idempotencyKey,omitempty"`
	BaseSnapshotID  string                `json:"baseSnapshotId,omitempty"`
	ManifestHash    string                `json:"manifestHash,omitempty"`
	Metadata        any                   `json:"metadata,omitempty"`
	Manifest        []UploadManifestEntry `json:"manifest"`
}

// UploadHandshakeResponse is returned from the handshake endpoint.
type UploadHandshakeResponse struct {
	SnapshotID   string     `json:"snapshotId"`
	MissingBlobs []string   `json:"missingBlobs"`
	Upload       UploadPlan `json:"upload"`
}

// UploadPlan describes how blobs should be uploaded.
type UploadPlan struct {
	Mode    string            `json:"mode"`
	URL     string            `json:"url,omitempty"`
	Uploads []PresignedUpload `json:"uploads,omitempty"`
}

// PresignedUpload describes a single presigned upload.
type PresignedUpload struct {
	Hash       string              `json:"hash"`
	URL        string              `json:"url"`
	Method     string              `json:"method"`
	Headers    map[string]string   `json:"headers,omitempty"`
	StorageKey string              `json:"storageKey"`
	ExpiresIn  int                 `json:"expiresIn"`
	Multipart  *PresignedMultipart `json:"multipart,omitempty"`
}

// PresignedMultipart contains multipart upload info.
type PresignedMultipart struct {
	UploadID string          `json:"uploadId"`
	Parts    []PresignedPart `json:"parts"`
}

// PresignedPart contains a multipart part upload URL.
type PresignedPart struct {
	PartNumber int    `json:"partNumber"`
	URL        string `json:"url"`
}

// UploadBlobRequest registers blob content.
type UploadBlobRequest struct {
	SnapshotID    string `json:"snapshotId"`
	Sha256        string `json:"sha256"`
	SizeBytes     int64  `json:"sizeBytes"`
	ContentBase64 string `json:"contentBase64,omitempty"`
	StorageKey    string `json:"storageKey,omitempty"`
	ContentType   string `json:"contentType,omitempty"`
}

// UploadBlobResponse is returned after registering a blob.
type UploadBlobResponse struct {
	Status string `json:"status"`
	BlobID string `json:"blobId"`
	Error  string `json:"error,omitempty"`
}

// FinalizeResponse is returned after completing an upload.
type FinalizeResponse struct {
	Status       string   `json:"status"`
	SnapshotID   string   `json:"snapshotId"`
	MissingBlobs []string `json:"missingBlobs,omitempty"`
	Error        string   `json:"error,omitempty"`
}

// APIError captures a non-2xx response.
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message == "" {
		return fmt.Sprintf("request failed: status %d", e.Status)
	}
	return fmt.Sprintf("request failed: %s (status %d)", e.Message, e.Status)
}

// MissingBlobsError indicates the finalize endpoint needs more blobs.
type MissingBlobsError struct {
	Missing []string
	Status  int
}

func (e *MissingBlobsError) Error() string {
	if e == nil {
		return ""
	}
	if len(e.Missing) == 0 {
		return fmt.Sprintf("missing blobs (status %d)", e.Status)
	}
	return fmt.Sprintf("missing %d blobs (status %d)", len(e.Missing), e.Status)
}

// NewClient constructs a sync API client.
func NewClient(baseURL, token, tokenType string, client *http.Client) (*Client, error) {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return nil, errors.New("base url required")
	}
	if client == nil {
		client = &http.Client{Timeout: defaultClientTimeout}
	}
	return &Client{
		BaseURL:   strings.TrimRight(trimmed, "/"),
		Token:     token,
		TokenType: tokenType,
		Client:    client,
	}, nil
}

// Handshake creates a snapshot and returns missing blobs.
func (c *Client) Handshake(ctx context.Context, req UploadHandshakeRequest) (UploadHandshakeResponse, error) {
	var resp UploadHandshakeResponse
	status, body, err := c.postJSON(ctx, "/api/cli/upload/handshake", req)
	if err != nil {
		return resp, err
	}
	if status >= http.StatusBadRequest {
		return resp, parseAPIError(status, body)
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return resp, err
	}
	if resp.SnapshotID == "" {
		return resp, errors.New("handshake response missing snapshot id")
	}
	return resp, nil
}

// UploadBlob registers blob content using the provided endpoint.
func (c *Client) UploadBlob(ctx context.Context, endpoint string, req UploadBlobRequest) error {
	status, body, err := c.postJSON(ctx, endpoint, req)
	if err != nil {
		return err
	}
	if status >= http.StatusBadRequest {
		return parseAPIError(status, body)
	}
	if len(body) == 0 {
		return nil
	}
	var resp UploadBlobResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return err
	}
	if resp.Error != "" {
		return &APIError{Status: status, Message: resp.Error}
	}
	return nil
}

// Finalize marks the snapshot as ready after uploads complete.
func (c *Client) Finalize(ctx context.Context, snapshotID string) (FinalizeResponse, error) {
	var resp FinalizeResponse
	status, body, err := c.postJSON(ctx, "/api/cli/upload/complete", map[string]string{"snapshotId": snapshotID})
	if err != nil {
		return resp, err
	}
	if status == http.StatusConflict {
		if err := parseMissingBlobs(status, body, &resp); err != nil {
			return resp, err
		}
		if len(resp.MissingBlobs) > 0 {
			return resp, &MissingBlobsError{Missing: resp.MissingBlobs, Status: status}
		}
		return resp, &APIError{Status: status, Message: "missing blobs"}
	}
	if status >= http.StatusBadRequest {
		return resp, parseAPIError(status, body)
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return resp, err
	}
	if resp.SnapshotID == "" {
		resp.SnapshotID = snapshotID
	}
	if resp.Error != "" {
		return resp, &APIError{Status: status, Message: resp.Error}
	}
	return resp, nil
}

type apiErrorResponse struct {
	Error        string   `json:"error"`
	MissingBlobs []string `json:"missingBlobs,omitempty"`
}

func parseAPIError(status int, body []byte) error {
	var parsed apiErrorResponse
	if len(body) > 0 && json.Unmarshal(body, &parsed) == nil {
		if len(parsed.MissingBlobs) > 0 {
			return &MissingBlobsError{Missing: parsed.MissingBlobs, Status: status}
		}
		if parsed.Error != "" {
			return &APIError{Status: status, Message: parsed.Error}
		}
	}
	message := strings.TrimSpace(string(body))
	if message == "" {
		message = http.StatusText(status)
	}
	return &APIError{Status: status, Message: message}
}

func parseMissingBlobs(status int, body []byte, resp *FinalizeResponse) error {
	if resp == nil {
		return parseAPIError(status, body)
	}
	if len(body) == 0 {
		return nil
	}
	if err := json.Unmarshal(body, resp); err != nil {
		return err
	}
	return nil
}

func (c *Client) postJSON(ctx context.Context, endpoint string, payload any) (int, []byte, error) {
	urlStr, err := c.resolveEndpoint(endpoint)
	if err != nil {
		return 0, nil, err
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, urlStr, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}

	req.Header.Set("Content-Type", "application/json")
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

func (c *Client) resolveEndpoint(endpoint string) (string, error) {
	trimmed := strings.TrimSpace(endpoint)
	if trimmed == "" {
		return "", errors.New("endpoint required")
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed, nil
	}
	return url.JoinPath(c.BaseURL, trimmed)
}

func formatAuthHeader(tokenType, token string) string {
	scheme := strings.TrimSpace(tokenType)
	if scheme == "" {
		scheme = "Bearer"
	} else if strings.EqualFold(scheme, "bearer") {
		scheme = "Bearer"
	}
	return fmt.Sprintf("%s %s", scheme, token)
}
