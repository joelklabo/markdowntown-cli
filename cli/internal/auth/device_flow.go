// Package auth provides CLI authentication helpers.
package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"markdowntown-cli/internal/version"
)

// DefaultBaseURL is the default web app origin used for device flow.
const (
	DefaultBaseURL     = "https://markdowntown.app"
	BaseURLEnvVar      = "MARKDOWNTOWN_BASE_URL"
	FallbackBaseURLEnv = "MARKDOWNTOWN_API_BASE_URL"
	DefaultClientID    = "markdowntown-cli"
)

// DeviceFlowClient talks to the CLI device flow endpoints.
type DeviceFlowClient struct {
	BaseURL string
	Client  *http.Client
}

// DeviceStartRequest is sent to /api/cli/device/start.
type DeviceStartRequest struct {
	ClientID   string   `json:"clientId,omitempty"`
	CliVersion string   `json:"cliVersion,omitempty"`
	DeviceName string   `json:"deviceName,omitempty"`
	Scopes     []string `json:"scopes,omitempty"`
}

// DeviceStartResponse is returned by /api/cli/device/start.
type DeviceStartResponse struct {
	DeviceCode              string   `json:"device_code"`
	UserCode                string   `json:"user_code"`
	VerificationURI         string   `json:"verification_uri"`
	VerificationURIComplete string   `json:"verification_uri_complete"`
	Interval                int      `json:"interval"`
	ExpiresIn               int      `json:"expires_in"`
	Scopes                  []string `json:"scopes"`
	Error                   string   `json:"error"`
}

// DevicePollResponse is returned by /api/cli/device/poll.
type DevicePollResponse struct {
	AccessToken string   `json:"access_token"`
	TokenType   string   `json:"token_type"`
	ExpiresIn   int      `json:"expires_in"`
	Scopes      []string `json:"scopes"`
	Interval    int      `json:"interval"`
	Error       string   `json:"error"`
}

// ResolveBaseURL resolves the base URL from flags/env/defaults.
func ResolveBaseURL(input string) (string, error) {
	base := strings.TrimSpace(input)
	if base == "" {
		if env := strings.TrimSpace(os.Getenv(BaseURLEnvVar)); env != "" {
			base = env
		}
	}
	if base == "" {
		if env := strings.TrimSpace(os.Getenv(FallbackBaseURLEnv)); env != "" {
			base = env
		}
	}
	if base == "" {
		base = DefaultBaseURL
	}

	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("invalid base url: %s", base)
	}

	return strings.TrimRight(base, "/"), nil
}

// NewDeviceFlowClient constructs a device flow client.
func NewDeviceFlowClient(baseURL string, client *http.Client) *DeviceFlowClient {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return &DeviceFlowClient{
		BaseURL: strings.TrimRight(baseURL, "/"),
		Client:  client,
	}
}

// Start requests a device code and user code.
func (c *DeviceFlowClient) Start(ctx context.Context, req DeviceStartRequest) (DeviceStartResponse, error) {
	if req.CliVersion == "" {
		req.CliVersion = version.ToolVersion
	}
	if req.ClientID == "" {
		req.ClientID = DefaultClientID
	}

	var resp DeviceStartResponse
	status, err := c.post(ctx, "/api/cli/device/start", req, &resp)
	if err != nil {
		return DeviceStartResponse{}, err
	}
	if status >= http.StatusBadRequest {
		if resp.Error != "" {
			return DeviceStartResponse{}, fmt.Errorf("device start failed: %s", resp.Error)
		}
		return DeviceStartResponse{}, fmt.Errorf("device start failed: status %d", status)
	}
	if resp.Error != "" {
		return DeviceStartResponse{}, fmt.Errorf("device start failed: %s", resp.Error)
	}
	if resp.DeviceCode == "" || resp.UserCode == "" || resp.VerificationURI == "" {
		return DeviceStartResponse{}, fmt.Errorf("device start failed: incomplete response")
	}

	return resp, nil
}

// Poll checks the device flow status.
func (c *DeviceFlowClient) Poll(ctx context.Context, deviceCode string) (DevicePollResponse, error) {
	payload := map[string]string{"device_code": deviceCode}
	var resp DevicePollResponse
	_, err := c.post(ctx, "/api/cli/device/poll", payload, &resp)
	if err != nil {
		return DevicePollResponse{}, err
	}
	return resp, nil
}

func (c *DeviceFlowClient) post(ctx context.Context, path string, payload any, out any) (int, error) {
	endpoint, err := url.JoinPath(c.BaseURL, path)
	if err != nil {
		return 0, err
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return 0, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("markdowntown-cli/%s", version.ToolVersion))

	resp, err := c.Client.Do(req)
	if err != nil {
		return 0, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	decoder := json.NewDecoder(resp.Body)
	if err := decoder.Decode(out); err != nil {
		return resp.StatusCode, err
	}

	return resp.StatusCode, nil
}
