package instructions

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	codexAgentsFilename            = "AGENTS.md"
	codexAgentsOverrideFilename    = "AGENTS.override.md"
	codexConfigFilename            = "config.toml"
	defaultCodexProjectDocMaxBytes = int64(32768)
)

var (
	// ErrRepoRootMissing is returned when no repo root is provided or inferred.
	ErrRepoRootMissing = errors.New("repo root required")
	// ErrRepoRootMismatch is returned when the target path is outside the repo root.
	ErrRepoRootMismatch = errors.New("target path is outside repo root")
)

// CodexAdapter resolves instructions following Codex discovery rules.
type CodexAdapter struct{}

// Client returns the client identifier.
func (CodexAdapter) Client() Client {
	return ClientCodex
}

// Resolve applies Codex instruction discovery for the provided options.
func (CodexAdapter) Resolve(opts ResolveOptions) (Resolution, error) {
	repoRoot, cwd, targetPath, err := normalizeResolvePaths(opts)
	if err != nil {
		return Resolution{}, err
	}

	codexHome, err := resolveCodexHome()
	if err != nil {
		return Resolution{}, err
	}

	cfg, cfgPath, err := loadCodexConfig(codexHome)
	if err != nil {
		return Resolution{}, err
	}

	resolution := Resolution{
		Client:            ClientCodex,
		RepoRoot:          repoRoot,
		Cwd:               cwd,
		TargetPath:        targetPath,
		OrderGuarantee:    OrderDeterministic,
		CodexHome:         codexHome,
		ConfigPath:        cfgPath,
		FallbackFilenames: append([]string(nil), cfg.ProjectDocFallbackFilenames...),
	}

	if cfg.ProjectDocMaxBytes > 0 {
		resolution.SizeLimits = append(resolution.SizeLimits, SizeLimit{
			Name:   "project_doc_max_bytes",
			Bytes:  cfg.ProjectDocMaxBytes,
			Scope:  ScopeRepo,
			Source: cfg.MaxBytesSource,
		})
	}

	if codexHome != "" {
		userInstruction, err := resolveCodexInstruction(codexHome, ScopeUser, nil, 0, false)
		if err != nil {
			return resolution, err
		}
		if userInstruction != nil {
			resolution.Applied = append(resolution.Applied, *userInstruction)
		}
	}

	dirs, err := ancestorDirs(repoRoot, cwd)
	if err != nil {
		return resolution, err
	}

	for _, dir := range dirs {
		instruction, err := resolveCodexInstruction(dir, ScopeRepo, cfg.ProjectDocFallbackFilenames, cfg.ProjectDocMaxBytes, true)
		if err != nil {
			return resolution, err
		}
		if instruction != nil {
			resolution.Applied = append(resolution.Applied, *instruction)
		}
	}

	return resolution, nil
}

type codexConfig struct {
	ProjectDocMaxBytes          int64
	ProjectDocFallbackFilenames []string
	MaxBytesSource              string
}

func resolveCodexHome() (string, error) {
	if path := os.Getenv("CODEX_HOME"); path != "" {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".codex"), nil
}

func loadCodexConfig(codexHome string) (codexConfig, string, error) {
	cfg := codexConfig{
		ProjectDocMaxBytes: defaultCodexProjectDocMaxBytes,
		MaxBytesSource:     "default",
	}

	if codexHome == "" {
		return cfg, "", nil
	}

	path := filepath.Join(codexHome, codexConfigFilename)
	// #nosec G304 -- path is derived from codex home/config file.
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, "", nil
		}
		return cfg, path, err
	}

	parsed, err := parseCodexConfig(data)
	if err != nil {
		return cfg, path, err
	}

	if parsed.ProjectDocMaxBytes > 0 {
		cfg.ProjectDocMaxBytes = parsed.ProjectDocMaxBytes
		cfg.MaxBytesSource = "config"
	}

	if len(parsed.ProjectDocFallbackFilenames) > 0 {
		cfg.ProjectDocFallbackFilenames = append([]string(nil), parsed.ProjectDocFallbackFilenames...)
	}

	return cfg, path, nil
}

func parseCodexConfig(data []byte) (codexConfig, error) {
	var cfg codexConfig
	var table string

	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#") {
			continue
		}

		if idx := strings.Index(line, "#"); idx >= 0 {
			line = strings.TrimSpace(line[:idx])
			if line == "" {
				continue
			}
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			table = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(line, "["), "]"))
			continue
		}

		if table != "" {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		switch key {
		case "project_doc_max_bytes":
			parsed, err := strconv.ParseInt(strings.Trim(value, "\""), 10, 64)
			if err != nil {
				return cfg, fmt.Errorf("parse project_doc_max_bytes: %w", err)
			}
			cfg.ProjectDocMaxBytes = parsed
		case "project_doc_fallback_filenames":
			parsed, err := parseStringArray(value)
			if err != nil {
				return cfg, fmt.Errorf("parse project_doc_fallback_filenames: %w", err)
			}
			cfg.ProjectDocFallbackFilenames = parsed
		}
	}

	if err := scanner.Err(); err != nil {
		return cfg, err
	}

	return cfg, nil
}

func parseStringArray(value string) ([]string, error) {
	trimmed := strings.TrimSpace(value)
	if !strings.HasPrefix(trimmed, "[") || !strings.HasSuffix(trimmed, "]") {
		return nil, fmt.Errorf("expected array, got %q", value)
	}

	inner := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(trimmed, "["), "]"))
	if inner == "" {
		return nil, nil
	}

	parts := strings.Split(inner, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		item = strings.Trim(item, "\"'")
		if item == "" {
			continue
		}
		out = append(out, item)
	}
	return out, nil
}

func resolveCodexInstruction(dir string, scope Scope, fallback []string, maxBytes int64, allowFallback bool) (*InstructionFile, error) {
	candidates := []struct {
		name   string
		reason InstructionReason
	}{
		{name: codexAgentsOverrideFilename, reason: ReasonOverride},
		{name: codexAgentsFilename, reason: ReasonPrimary},
	}

	if allowFallback {
		for _, fallbackName := range fallback {
			fallbackName = strings.TrimSpace(fallbackName)
			if fallbackName == "" {
				continue
			}
			candidates = append(candidates, struct {
				name   string
				reason InstructionReason
			}{name: fallbackName, reason: ReasonFallback})
		}
	}

	for _, candidate := range candidates {
		path := filepath.Join(dir, candidate.name)
		info, err := os.Stat(path)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, err
		}
		if info.IsDir() {
			continue
		}
		if info.Size() == 0 {
			continue
		}

		instruction := InstructionFile{
			Path:          path,
			Scope:         scope,
			Dir:           dir,
			Reason:        candidate.reason,
			Bytes:         info.Size(),
			IncludedBytes: info.Size(),
		}

		if scope == ScopeRepo && maxBytes > 0 && info.Size() > maxBytes {
			instruction.IncludedBytes = maxBytes
			instruction.Truncated = true
		}

		return &instruction, nil
	}

	return nil, nil
}

func normalizeResolvePaths(opts ResolveOptions) (string, string, string, error) {
	repoRoot := strings.TrimSpace(opts.RepoRoot)
	cwd := strings.TrimSpace(opts.Cwd)
	targetPath := strings.TrimSpace(opts.TargetPath)

	if repoRoot == "" && cwd == "" {
		wd, err := os.Getwd()
		if err != nil {
			return "", "", "", err
		}
		cwd = wd
	}

	if cwd == "" {
		cwd = repoRoot
	}

	if repoRoot == "" {
		repoRoot = cwd
	}

	var err error
	if repoRoot != "" && !filepath.IsAbs(repoRoot) {
		repoRoot, err = filepath.Abs(repoRoot)
		if err != nil {
			return "", "", "", err
		}
	}

	if cwd != "" && !filepath.IsAbs(cwd) {
		cwd, err = filepath.Abs(cwd)
		if err != nil {
			return "", "", "", err
		}
	}

	if targetPath != "" {
		if !filepath.IsAbs(targetPath) {
			base := cwd
			if base == "" {
				base = repoRoot
			}
			if base == "" {
				base, err = os.Getwd()
				if err != nil {
					return "", "", "", err
				}
			}
			targetPath = filepath.Join(base, targetPath)
		}
		targetPath = filepath.Clean(targetPath)
		cwd = filepath.Dir(targetPath)
	}

	if repoRoot == "" {
		return "", "", "", ErrRepoRootMissing
	}

	if repoRoot != "" {
		info, err := os.Stat(repoRoot)
		if err != nil {
			return "", "", "", err
		}
		if !info.IsDir() {
			return "", "", "", fmt.Errorf("repo root is not a directory: %s", repoRoot)
		}
	}

	if cwd == "" {
		return "", "", "", ErrRepoRootMissing
	}

	repoRoot = filepath.Clean(repoRoot)
	cwd = filepath.Clean(cwd)

	rel, err := filepath.Rel(repoRoot, cwd)
	if err != nil {
		return "", "", "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", "", "", ErrRepoRootMismatch
	}

	return repoRoot, cwd, targetPath, nil
}

func ancestorDirs(repoRoot, cwd string) ([]string, error) {
	rel, err := filepath.Rel(repoRoot, cwd)
	if err != nil {
		return nil, err
	}

	if rel == "." {
		return []string{repoRoot}, nil
	}

	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return nil, ErrRepoRootMismatch
	}

	parts := strings.Split(rel, string(filepath.Separator))
	dirs := make([]string, 0, len(parts)+1)
	current := repoRoot
	dirs = append(dirs, current)
	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		current = filepath.Join(current, part)
		dirs = append(dirs, current)
	}

	return dirs, nil
}
