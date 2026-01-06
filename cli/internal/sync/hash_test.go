package sync

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHashFileWithLimit(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.txt")
	content := "hello world"
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	t.Run("UnderLimit", func(t *testing.T) {
		hash, err := HashFileWithLimit(path, int64(len(content)+1))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if hash == "" {
			t.Fatal("expected hash, got empty string")
		}
	})

	t.Run("AtLimit", func(t *testing.T) {
		hash, err := HashFileWithLimit(path, int64(len(content)))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if hash == "" {
			t.Fatal("expected hash, got empty string")
		}
	})

	t.Run("OverLimit", func(t *testing.T) {
		_, err := HashFileWithLimit(path, int64(len(content)-1))
		if err == nil {
			t.Fatal("expected error for file over limit, got nil")
		}
		if err.Error() != "file exceeds maximum size of 10 bytes" {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("NoLimit", func(t *testing.T) {
		hash, err := HashFileWithLimit(path, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if hash == "" {
			t.Fatal("expected hash, got empty string")
		}
	})
}
