package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	"markdowntown-cli/internal/scan"
)

func TestAuditCLI(t *testing.T) {
	input := scan.Output{
		SchemaVersion:   "1.0",
		RegistryVersion: "1.0",
		ToolVersion:     "0.1.0",
		ScanStartedAt:   1,
		GeneratedAt:     2,
		RepoRoot:        "/repo",
		Scans:           []scan.Root{{Scope: "repo", Root: "/repo", Exists: true}},
		Configs:         nil,
		Warnings:        nil,
	}
	payload, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal input: %v", err)
	}

	stdinReader, stdinWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdin: %v", err)
	}
	stdoutReader, stdoutWriter, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe stdout: %v", err)
	}

	oldStdin := os.Stdin
	oldStdout := os.Stdout
	os.Stdin = stdinReader
	os.Stdout = stdoutWriter
	defer func() {
		os.Stdin = oldStdin
		os.Stdout = oldStdout
	}()

	go func() {
		_, _ = stdinWriter.Write(payload)
		_ = stdinWriter.Close()
	}()

	code, err := runAudit([]string{"--input", "-", "--format", "json", "--compact"})
	_ = stdoutWriter.Close()
	if err != nil {
		t.Fatalf("runAudit error: %v", err)
	}
	if code != 0 {
		t.Fatalf("expected exit code 0, got %d", code)
	}

	outBytes, err := io.ReadAll(stdoutReader)
	if err != nil {
		t.Fatalf("read stdout: %v", err)
	}
	output := strings.TrimSpace(string(outBytes))
	if output == "" {
		t.Fatalf("expected output")
	}
	if !strings.Contains(output, "\"schemaVersion\"") {
		t.Fatalf("expected schemaVersion in output, got %s", output)
	}
	if !strings.Contains(output, "\"issues\":[") {
		t.Fatalf("expected issues array in output, got %s", output)
	}

	if !bytes.HasSuffix(outBytes, []byte("\n")) {
		t.Fatalf("expected trailing newline in output")
	}
}
