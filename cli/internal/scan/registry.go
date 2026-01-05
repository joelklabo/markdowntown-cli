// Package scan provides registry loading and file matching helpers.
package scan

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	// RegistryEnvVar overrides registry discovery with an explicit file path.
	RegistryEnvVar = "MARKDOWNTOWN_REGISTRY"
	// RegistryFile is the default registry filename.
	RegistryFile = "ai-config-patterns.json"
	// CustomPatternsFile is the optional overlay file name.
	CustomPatternsFile = "custom-patterns.json"
	// RegistrySubdir is the XDG config subdirectory for markdowntown.
	RegistrySubdir = "markdowntown"
	// RegistryEtcPath is the system-level registry directory.
	RegistryEtcPath = "/etc/markdowntown"
)

var (
	// ErrRegistryNotFound signals no registry was found in any candidate location.
	ErrRegistryNotFound = errors.New("registry not found")
	// ErrMultipleRegistries signals more than one registry was detected.
	ErrMultipleRegistries = errors.New("multiple registries found")
	// ErrRegistryPathMissing signals an explicit registry path does not exist.
	ErrRegistryPathMissing = errors.New("registry path does not exist")
)

// LoadRegistry reads and parses the registry JSON from the resolved path.
func LoadRegistry() (Registry, string, error) {
	path, err := ResolveRegistryPath()
	if err != nil {
		if errors.Is(err, ErrRegistryNotFound) {
			var reg Registry
			if jsonErr := json.Unmarshal([]byte(DefaultRegistryJSON), &reg); jsonErr != nil {
				return Registry{}, "", fmt.Errorf("parse default registry: %w", jsonErr)
			}
			// Load custom patterns if present (optional overlay on default)
			customReg, customPath, customErr := LoadCustomPatterns()
			if customErr == nil && len(customReg.Patterns) > 0 {
				reg = MergeRegistries(reg, customReg)
				return reg, customPath, nil
			}
			return reg, "(default)", nil
		}
		return Registry{}, "", err
	}

	data, err := ReadRegistryFile(path)
	if err != nil {
		return Registry{}, "", fmt.Errorf("read registry: %w", err)
	}

	var reg Registry
	if err := json.Unmarshal(data, &reg); err != nil {
		return Registry{}, "", fmt.Errorf("parse registry: %w", err)
	}

	customReg, customPath, err := LoadCustomPatterns()
	if err != nil {
		return Registry{}, "", fmt.Errorf("custom patterns (%s): %w", customPath, err)
	}
	if len(customReg.Patterns) > 0 {
		reg = MergeRegistries(reg, customReg)
	}

	return reg, path, nil
}

// ReadRegistryFile reads the raw registry JSON from disk.
func ReadRegistryFile(path string) ([]byte, error) {
	// #nosec G304 -- registry path comes from env override or well-known locations.
	return os.ReadFile(path)
}

// ResolveRegistryPath determines the single registry path to use.
func ResolveRegistryPath() (string, error) {
	if override := os.Getenv(RegistryEnvVar); override != "" {
		expanded, err := expandHome(override)
		if err != nil {
			return "", err
		}
		if _, err := os.Stat(expanded); err != nil {
			if os.IsNotExist(err) {
				return "", fmt.Errorf("%w: %s", ErrRegistryPathMissing, expanded)
			}
			return "", err
		}
		return expanded, nil
	}

	paths, err := discoverRegistryPaths()
	if err != nil {
		return "", err
	}

	switch len(paths) {
	case 0:
		return "", ErrRegistryNotFound
	case 1:
		return paths[0], nil
	default:
		return "", fmt.Errorf("%w: %s", ErrMultipleRegistries, strings.Join(paths, ", "))
	}
}

func discoverRegistryPaths() ([]string, error) {
	candidates, err := registryCandidates()
	if err != nil {
		return nil, err
	}

	found := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, err
		}
		if info.IsDir() {
			continue
		}
		found = append(found, candidate)
	}

	return found, nil
}

func registryCandidates() ([]string, error) {
	configHome, err := xdgConfigHome()
	if err != nil {
		return nil, err
	}

	var candidates []string
	candidates = append(candidates, filepath.Join(configHome, RegistrySubdir, RegistryFile))
	candidates = append(candidates, filepath.Join(RegistryEtcPath, RegistryFile))

	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), RegistryFile))
	}

	return candidates, nil
}

func xdgConfigHome() (string, error) {
	if path := os.Getenv("XDG_CONFIG_HOME"); path != "" {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config"), nil
}

func expandHome(path string) (string, error) {
	if path == "" {
		return path, nil
	}
	if path[0] != '~' {
		return path, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	if path == "~" {
		return home, nil
	}
	if len(path) > 1 && (path[1] == '/' || path[1] == '\\') {
		return filepath.Join(home, path[2:]), nil
	}

	return path, nil
}

func expandRegistryPath(path string) (string, error) {
	expanded, err := expandHome(path)
	if err != nil {
		return "", err
	}
	return expandXDGConfigHome(expanded), nil
}

func expandRegistryPathRegex(path string) (string, error) {
	expanded, err := expandHome(path)
	if err != nil {
		return "", err
	}
	return expandXDGConfigHomeRaw(expanded), nil
}

func expandXDGConfigHome(path string) string {
	xdg := os.Getenv("XDG_CONFIG_HOME")
	if xdg == "" {
		return filepath.Clean(filepath.FromSlash(path))
	}
	path = strings.ReplaceAll(path, "${XDG_CONFIG_HOME}", xdg)
	path = strings.ReplaceAll(path, "$XDG_CONFIG_HOME", xdg)
	return filepath.Clean(filepath.FromSlash(path))
}

func expandXDGConfigHomeRaw(path string) string {
	xdg := os.Getenv("XDG_CONFIG_HOME")
	if xdg == "" {
		return path
	}
	path = strings.ReplaceAll(path, "${XDG_CONFIG_HOME}", xdg)
	return strings.ReplaceAll(path, "$XDG_CONFIG_HOME", xdg)
}

// LoadCustomPatterns loads optional custom pattern overlays from XDG config.
func LoadCustomPatterns() (Registry, string, error) {
	path, err := customPatternsPath()
	if err != nil {
		return Registry{}, "", err
	}

	data, err := ReadRegistryFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Registry{}, path, nil
		}
		return Registry{}, path, err
	}

	var reg Registry
	if err := json.Unmarshal(data, &reg); err != nil {
		return Registry{}, path, fmt.Errorf("parse custom patterns: %w", err)
	}

	if err := validateCustomRegistry(reg); err != nil {
		return Registry{}, path, err
	}

	return reg, path, nil
}

// MergeRegistries overlays patterns from overlay on top of base deterministically.
func MergeRegistries(base Registry, overlay Registry) Registry {
	if len(overlay.Patterns) == 0 {
		return base
	}

	merged := Registry{
		Version:  base.Version,
		Patterns: append([]Pattern(nil), base.Patterns...),
	}
	if merged.Version == "" {
		merged.Version = overlay.Version
	}

	index := make(map[string]int, len(merged.Patterns))
	for i, pattern := range merged.Patterns {
		if pattern.ID == "" {
			continue
		}
		if _, ok := index[pattern.ID]; !ok {
			index[pattern.ID] = i
		}
	}

	for _, pattern := range overlay.Patterns {
		if pattern.ID != "" {
			if idx, ok := index[pattern.ID]; ok {
				merged.Patterns[idx] = pattern
				continue
			}
		}
		merged.Patterns = append(merged.Patterns, pattern)
	}

	return merged
}

func customPatternsPath() (string, error) {
	configHome, err := xdgConfigHome()
	if err != nil {
		return "", err
	}
	return filepath.Join(configHome, RegistrySubdir, CustomPatternsFile), nil
}

func validateCustomRegistry(reg Registry) error {
	details := validateSchema(reg)
	details = append(details, validatePatterns(reg)...)
	details = append(details, validateUniqueIDs(reg)...)
	if len(details) == 0 {
		return nil
	}

	first := details[0]
	message := first.Error
	if first.PatternID != "" {
		message = fmt.Sprintf("pattern %s: %s", first.PatternID, message)
	}
	if first.Field != "" {
		message = fmt.Sprintf("%s (field %s)", message, first.Field)
	}
	if message == "" {
		message = "invalid custom patterns"
	}
	return errors.New(message)
}
