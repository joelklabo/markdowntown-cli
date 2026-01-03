package scan

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func BenchmarkScanParallel(b *testing.B) {
	repoRoot := copyFixtureBench(b, "integration")
	userRoot := b.TempDir()
	writeTestFileBench(b, filepath.Join(userRoot, "AGENTS.md"), "User instructions")

	registry := integrationRegistry()
	workerCounts := []int{1, 4, runtime.NumCPU()}
	seen := make(map[int]struct{}, len(workerCounts))

	for _, workers := range workerCounts {
		if workers < 1 {
			continue
		}
		if _, ok := seen[workers]; ok {
			continue
		}
		seen[workers] = struct{}{}

		b.Run(fmt.Sprintf("workers-%d", workers), func(b *testing.B) {
			opts := Options{
				RepoRoot:       repoRoot,
				UserRoots:      []string{userRoot},
				Registry:       registry,
				IncludeContent: true,
				ScanWorkers:    workers,
			}
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				if _, err := Scan(opts); err != nil {
					b.Fatalf("scan: %v", err)
				}
			}
		})
	}
}

func copyFixtureBench(b *testing.B, name string) string {
	b.Helper()
	root := b.TempDir()
	src := filepath.Join("..", "..", "testdata", "repos", name)
	if err := copyDir(src, root); err != nil {
		b.Fatalf("copy fixture: %v", err)
	}
	return root
}

func writeTestFileBench(b *testing.B, path string, content string) {
	b.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		b.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		b.Fatalf("write file: %v", err)
	}
}
