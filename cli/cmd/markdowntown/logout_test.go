package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestLogoutHelp(t *testing.T) {
	var stdout, stderr bytes.Buffer
	err := runLogoutWithIO(&stdout, &stderr, []string{"--help"})
	if err != nil {
		t.Errorf("runLogout(--help) returned error: %v", err)
	}
	output := stdout.String()
	if output == "" {
		t.Error("runLogout(--help) produced empty output")
	}
	if !strings.Contains(output, "markdowntown logout") {
		t.Errorf("help text does not contain 'markdowntown logout'")
	}
}

func TestLogoutClearsToken(t *testing.T) {
	var stdout, stderr bytes.Buffer
	// Logout always succeeds even if no token exists
	err := runLogoutWithIO(&stdout, &stderr, []string{})
	if err != nil {
		t.Errorf("runLogout returned error: %v", err)
	}
	output := stdout.String()
	if output == "" {
		t.Error("runLogout produced empty output")
	}
	if !strings.Contains(output, "Logged out successfully") {
		t.Errorf("logout message does not contain success text, got: %s", output)
	}
}

func TestLogoutRejectsExtraArgs(t *testing.T) {
	var stdout, stderr bytes.Buffer
	err := runLogoutWithIO(&stdout, &stderr, []string{"extra"})
	if err == nil {
		t.Error("runLogout with unexpected arguments should return error")
	}
	if !strings.Contains(err.Error(), "unexpected arguments") {
		t.Errorf("expected 'unexpected arguments' error, got: %v", err)
	}
}
