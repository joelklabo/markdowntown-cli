// Package suggest provides source registry and evidence helpers.
package suggest

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const (
	// SourcesEnvVar overrides source registry discovery with an explicit file path.
	SourcesEnvVar = "MARKDOWNTOWN_SOURCES"
	// SourcesFile is the default source registry filename.
	SourcesFile = "doc-sources.json"
	// SourcesSubdir is the XDG config subdirectory for markdowntown.
	SourcesSubdir = "markdowntown"
	// SourcesEtcPath is the system-level registry directory.
	SourcesEtcPath = "/etc/markdowntown"
)

var (
	// ErrSourcesNotFound signals no source registry was found in any candidate location.
	ErrSourcesNotFound = errors.New("source registry not found")
	// ErrMultipleSources signals more than one source registry was detected.
	ErrMultipleSources = errors.New("multiple source registries found")
	// ErrSourcesPathMissing signals an explicit registry path does not exist.
	ErrSourcesPathMissing = errors.New("source registry path does not exist")
)

// SourceRegistry defines the source registry schema.
type SourceRegistry struct {
	Version        string   `json:"version"`
	AllowlistHosts []string `json:"allowlistHosts"`
	Sources        []Source `json:"sources"`
}

// Source defines a documentation source entry.
type Source struct {
	ID           string   `json:"id"`
	Tier         string   `json:"tier"`
	Client       string   `json:"client"`
	URL          string   `json:"url"`
	RefreshHours int      `json:"refreshHours"`
	Tags         []string `json:"tags,omitempty"`
	Notes        string   `json:"notes,omitempty"`
}

// LoadSources reads and validates the registry JSON from the resolved path.
func LoadSources() (SourceRegistry, string, error) {
	path, err := ResolveSourcesPath()
	if err != nil {
		return SourceRegistry{}, "", err
	}

	data, err := ReadSourcesFile(path)
	if err != nil {
		return SourceRegistry{}, "", fmt.Errorf("read sources: %w", err)
	}

	var reg SourceRegistry
	if err := json.Unmarshal(data, &reg); err != nil {
		return SourceRegistry{}, "", fmt.Errorf("parse sources: %w", err)
	}

	if err := ValidateSources(reg); err != nil {
		return SourceRegistry{}, "", err
	}

	return reg, path, nil
}

// ReadSourcesFile reads the raw registry JSON from disk.
func ReadSourcesFile(path string) ([]byte, error) {
	// #nosec G304 -- source registry path comes from env override or well-known locations.
	return os.ReadFile(path)
}

// ResolveSourcesPath determines the single registry path to use.
func ResolveSourcesPath() (string, error) {
	if override := os.Getenv(SourcesEnvVar); override != "" {
		expanded, err := expandHome(override)
		if err != nil {
			return "", err
		}
		if _, err := os.Stat(expanded); err != nil {
			if os.IsNotExist(err) {
				return "", fmt.Errorf("%w: %s", ErrSourcesPathMissing, expanded)
			}
			return "", err
		}
		return expanded, nil
	}

	paths, err := discoverSourcesPaths()
	if err != nil {
		return "", err
	}

	switch len(paths) {
	case 0:
		return "", ErrSourcesNotFound
	case 1:
		return paths[0], nil
	default:
		return "", fmt.Errorf("%w: %s", ErrMultipleSources, strings.Join(paths, ", "))
	}
}

func discoverSourcesPaths() ([]string, error) {
	candidates, err := sourcesCandidates()
	if err != nil {
		return nil, err
	}

	var found []string
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

func sourcesCandidates() ([]string, error) {
	configHome, err := xdgConfigHome()
	if err != nil {
		return nil, err
	}

	var candidates []string
	candidates = append(candidates, filepath.Join(configHome, SourcesSubdir, SourcesFile))
	candidates = append(candidates, filepath.Join(SourcesEtcPath, SourcesFile))

	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), SourcesFile))
	}

	return candidates, nil
}

// ValidateSources enforces schema rules for a registry.
func ValidateSources(reg SourceRegistry) error {
	if strings.TrimSpace(reg.Version) == "" {
		return fmt.Errorf("sources registry missing version")
	}
	if len(reg.AllowlistHosts) == 0 {
		return fmt.Errorf("sources registry missing allowlistHosts")
	}
	if len(reg.Sources) == 0 {
		return fmt.Errorf("sources registry missing sources")
	}

	allowlist := make(map[string]struct{}, len(reg.AllowlistHosts))
	for _, host := range reg.AllowlistHosts {
		trimmed := strings.ToLower(strings.TrimSpace(host))
		if trimmed == "" {
			return fmt.Errorf("sources registry contains empty allowlist host")
		}
		if strings.Contains(trimmed, "://") || strings.Contains(trimmed, "/") || strings.Contains(trimmed, "\\") {
			return fmt.Errorf("allowlist host must be hostname only: %s", host)
		}
		parsedHost, err := url.Parse("https://" + trimmed)
		if err != nil || parsedHost.Hostname() == "" {
			return fmt.Errorf("allowlist host invalid: %s", host)
		}
		allowlist[strings.ToLower(parsedHost.Hostname())] = struct{}{}
	}

	seenIDs := map[string]struct{}{}
	seenURLs := map[string]struct{}{}

	for _, src := range reg.Sources {
		if strings.TrimSpace(src.ID) == "" {
			return fmt.Errorf("source missing id")
		}
		if _, exists := seenIDs[src.ID]; exists {
			return fmt.Errorf("duplicate source id: %s", src.ID)
		}
		seenIDs[src.ID] = struct{}{}

		if strings.TrimSpace(src.Client) == "" {
			return fmt.Errorf("source %s missing client", src.ID)
		}

		if !validTier(src.Tier) {
			return fmt.Errorf("source %s has invalid tier: %s", src.ID, src.Tier)
		}

		if strings.TrimSpace(src.URL) == "" {
			return fmt.Errorf("source %s missing url", src.ID)
		}
		if _, exists := seenURLs[src.URL]; exists {
			return fmt.Errorf("duplicate source url: %s", src.URL)
		}
		seenURLs[src.URL] = struct{}{}

		parsed, err := url.Parse(src.URL)
		if err != nil {
			return fmt.Errorf("source %s has invalid url: %w", src.ID, err)
		}
		if strings.ToLower(parsed.Scheme) != "https" {
			return fmt.Errorf("source %s has non-https url", src.ID)
		}
		host := strings.ToLower(parsed.Hostname())
		if host == "" {
			return fmt.Errorf("source %s missing host", src.ID)
		}
		if _, ok := allowlist[host]; !ok {
			return fmt.Errorf("source %s host not allowlisted: %s", src.ID, host)
		}
		if strings.Contains(parsed.Path, "\\") || strings.Contains(parsed.Path, "..") {
			return fmt.Errorf("source %s has unsafe path: %s", src.ID, parsed.Path)
		}
		if cleaned := path.Clean(parsed.Path); strings.HasPrefix(cleaned, "../") || cleaned == ".." {
			return fmt.Errorf("source %s has unsafe path: %s", src.ID, parsed.Path)
		}

		if src.RefreshHours <= 0 {
			return fmt.Errorf("source %s missing refreshHours", src.ID)
		}
	}

	return nil
}

func validTier(tier string) bool {
	switch tier {
	case "tier-0", "tier-1", "tier-2":
		return true
	default:
		return false
	}
}
