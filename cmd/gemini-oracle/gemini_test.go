package main

import (
	"context"
	"os"
	"os/exec"
	"testing"
)

func TestRunGeminiSuccess(t *testing.T) {
	withGeminiHelper(t, "stdout")

	cmd := runGemini("flash", "hello", nil)
	msg := cmd()
	res, ok := msg.(modelResult)
	if !ok {
		t.Fatalf("expected modelResult, got %T", msg)
	}
	if res.err != nil {
		t.Fatalf("expected no error, got %v", res.err)
	}
	if res.content != "ok" {
		t.Fatalf("expected content ok, got %q", res.content)
	}
}

func TestRunGeminiErrorUsesStderr(t *testing.T) {
	withGeminiHelper(t, "stderr")

	cmd := runGemini("pro", "hello", nil)
	msg := cmd()
	res, ok := msg.(modelResult)
	if !ok {
		t.Fatalf("expected modelResult, got %T", msg)
	}
	if res.err == nil {
		t.Fatalf("expected error")
	}
	if res.content != "boom" {
		t.Fatalf("expected content boom, got %q", res.content)
	}
}

func TestRunGeminiDefaultModel(t *testing.T) {
	withGeminiHelper(t, "stdout")

	cmd := runGemini("unknown", "hello", nil)
	msg := cmd()
	res, ok := msg.(modelResult)
	if !ok {
		t.Fatalf("expected modelResult, got %T", msg)
	}
	if res.err != nil {
		t.Fatalf("expected no error, got %v", res.err)
	}
	if res.content != "ok" {
		t.Fatalf("expected content ok, got %q", res.content)
	}
}

func TestGeminiHelperProcess(_ *testing.T) {
	if os.Getenv("GO_WANT_GEMINI_HELPER") != "1" {
		return
	}
	switch os.Getenv("GEMINI_HELPER_MODE") {
	case "stdout":
		_, _ = os.Stdout.WriteString("ok")
		os.Exit(0)
	case "stderr":
		_, _ = os.Stderr.WriteString("boom")
		os.Exit(1)
	default:
		os.Exit(2)
	}
}

func withGeminiHelper(t *testing.T, mode string) {
	t.Helper()
	execCommandContext = func(ctx context.Context, _ string, _ ...string) *exec.Cmd {
		//nolint:gosec // test helper uses current test binary
		cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=TestGeminiHelperProcess")
		cmd.Env = append(os.Environ(),
			"GO_WANT_GEMINI_HELPER=1",
			"GEMINI_HELPER_MODE="+mode,
		)
		return cmd
	}
	t.Cleanup(func() { execCommandContext = exec.CommandContext })
}
