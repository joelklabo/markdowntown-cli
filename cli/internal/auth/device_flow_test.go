package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDeviceFlowStart(t *testing.T) {
	var got DeviceStartRequest

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/cli/device/start" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Errorf("decode body: %v", err)
		}
		_ = json.NewEncoder(w).Encode(DeviceStartResponse{
			DeviceCode:              "device-code",
			UserCode:                "USER-CODE",
			VerificationURI:         "https://example.com/device",
			VerificationURIComplete: "https://example.com/device?code=USER-CODE",
			Interval:                5,
			ExpiresIn:               600,
			Scopes:                  []string{"cli:upload"},
		})
	}))
	t.Cleanup(server.Close)

	client := NewDeviceFlowClient(server.URL, server.Client())
	resp, err := client.Start(context.Background(), DeviceStartRequest{
		ClientID:   "client-id",
		CliVersion: "1.0.0",
		DeviceName: "laptop",
		Scopes:     []string{"cli:upload"},
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	if resp.DeviceCode != "device-code" {
		t.Fatalf("expected device code")
	}
	if got.ClientID != "client-id" {
		t.Fatalf("expected client id, got %q", got.ClientID)
	}
	if got.DeviceName != "laptop" {
		t.Fatalf("expected device name, got %q", got.DeviceName)
	}
	if len(got.Scopes) != 1 || got.Scopes[0] != "cli:upload" {
		t.Fatalf("expected scopes")
	}
}

func TestDeviceFlowPollToken(t *testing.T) {
	var got map[string]string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/cli/device/poll" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Errorf("decode body: %v", err)
		}
		_ = json.NewEncoder(w).Encode(DevicePollResponse{
			AccessToken: "token",
			TokenType:   "Bearer",
			ExpiresIn:   3600,
			Scopes:      []string{"cli:upload"},
		})
	}))
	t.Cleanup(server.Close)

	client := NewDeviceFlowClient(server.URL, server.Client())
	resp, err := client.Poll(context.Background(), "device-code")
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
	if resp.AccessToken != "token" {
		t.Fatalf("expected token")
	}
	if got["device_code"] != "device-code" {
		t.Fatalf("expected device code payload")
	}
}
