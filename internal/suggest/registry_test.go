package suggest

import "testing"

func TestRegistry(t *testing.T) {
	base := SourceRegistry{
		Version:        "1.0",
		AllowlistHosts: []string{"example.com"},
		Sources: []Source{
			{
				ID:           "example",
				Tier:         "tier-0",
				Client:       "codex",
				URL:          "https://example.com/docs",
				RefreshHours: 24,
			},
		},
	}

	t.Run("valid", func(t *testing.T) {
		if err := ValidateSources(base); err != nil {
			t.Fatalf("expected valid registry, got %v", err)
		}
	})

	t.Run("invalid tier", func(t *testing.T) {
		reg := base
		reg.Sources[0].Tier = "tier-x"
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for invalid tier")
		}
	})

	t.Run("duplicate url", func(t *testing.T) {
		reg := base
		reg.Sources = append(reg.Sources, Source{
			ID:           "dup",
			Tier:         "tier-1",
			Client:       "codex",
			URL:          "https://example.com/docs",
			RefreshHours: 24,
		})
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for duplicate url")
		}
	})

	t.Run("missing version", func(t *testing.T) {
		reg := base
		reg.Version = ""
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for missing version")
		}
	})

	t.Run("invalid allowlist host", func(t *testing.T) {
		reg := base
		reg.AllowlistHosts = []string{"https://example.com"}
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for allowlist host with scheme")
		}
	})

	t.Run("non-https source", func(t *testing.T) {
		reg := base
		reg.Sources[0].URL = "http://example.com/docs"
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for non-https url")
		}
	})

	t.Run("unsafe path", func(t *testing.T) {
		reg := base
		reg.Sources[0].URL = "https://example.com/../secret"
		if err := ValidateSources(reg); err == nil {
			t.Fatal("expected error for unsafe path")
		}
	})
}
