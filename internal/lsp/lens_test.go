package lsp

import "testing"

func TestLensScopeLabel(t *testing.T) {
	if lensScopeLabel("repo") != "Repo" {
		t.Fatalf("expected Repo label")
	}
	if lensScopeLabel("user") != "User" {
		t.Fatalf("expected User label")
	}
	if lensScopeLabel("global") != "Global" {
		t.Fatalf("expected Global label")
	}
	if lensScopeLabel("") != "Unknown" {
		t.Fatalf("expected Unknown label")
	}
	if lensScopeLabel("custom") != "Custom" {
		t.Fatalf("expected Custom label")
	}
}
