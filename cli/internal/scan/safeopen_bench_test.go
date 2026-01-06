//go:build !windows && !js

package scan

import (
	"crypto/rand"
	"os"
	"path/filepath"
	"testing"
)

// BenchmarkSafeOpenDepth measures the overhead of safe-open vs. standard read
// across different directory depths. Safe-open walks each path component with
// O_NOFOLLOW verification (or openat2 RESOLVE_NO_SYMLINKS on Linux 5.6+).
//
// Benchmark results on Linux 6.x / AMD64 / i9-9900K:
//
//	BenchmarkSafeOpenDepth/depth-1/safe-        5216 ns/op    696 B/op   6 allocs/op
//	BenchmarkSafeOpenDepth/depth-1/standard-    5651 ns/op    888 B/op   5 allocs/op
//	BenchmarkSafeOpenDepth/depth-6/safe-        5730 ns/op    824 B/op   7 allocs/op
//	BenchmarkSafeOpenDepth/depth-6/standard-    5806 ns/op    904 B/op   5 allocs/op
//	BenchmarkSafeOpenDepth/depth-10/safe-       6246 ns/op    936 B/op   7 allocs/op
//	BenchmarkSafeOpenDepth/depth-10/standard-   6207 ns/op    920 B/op   5 allocs/op
//
// Analysis: Safe-open has minimal overhead across depths (~0-10% vs standard).
// This is due to openat2 with RESOLVE_NO_SYMLINKS being an efficient single syscall
// rather than per-component O_NOFOLLOW + verify. On older kernels without openat2,
// expect ~2-5x overhead for deep paths due to per-component verification.
func BenchmarkSafeOpenDepth(b *testing.B) {
	depths := []int{1, 3, 6, 10}
	content := []byte("test content\n")

	for _, depth := range depths {
		depth := depth
		b.Run(formatDepth(depth), func(b *testing.B) {
			root := b.TempDir()
			path := createNestedFile(b, root, depth, content)
			relPath, err := filepath.Rel(root, path)
			if err != nil {
				b.Fatalf("rel path: %v", err)
			}

			b.Run("safe", func(b *testing.B) {
				b.ReportAllocs()
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					data, err := safeReadFilePath(root, path)
					if err != nil {
						b.Fatalf("safeReadFilePath: %v", err)
					}
					if len(data) != len(content) {
						b.Fatalf("wrong length: got %d, want %d", len(data), len(content))
					}
				}
			})

			b.Run("standard", func(b *testing.B) {
				fullPath := filepath.Join(root, relPath)
				b.ReportAllocs()
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
									// #nosec G304 -- benchmark uses trusted local files
												// #nosec G304 -- benchmark uses trusted local files
												data, err := os.ReadFile(fullPath)
												if err != nil {
													b.Fatalf("os.ReadFile: %v", err)
												}
														if len(data) != len(content) {
						b.Fatalf("wrong length: got %d, want %d", len(data), len(content))
					}
				}
			})
		})
	}
}

// BenchmarkSafeOpenSize measures safe-open overhead for different file sizes.
// At small sizes, overhead is dominated by path-walk syscalls. At larger sizes,
// safe-open shows higher memory allocation overhead due to intermediate buffers.
//
// Benchmark results on Linux 6.x / AMD64 / i9-9900K (depth=6):
//
//	BenchmarkSafeOpenSize/100B/safe-        5841 ns/op    17.12 MB/s     808 B/op    7 allocs/op
//	BenchmarkSafeOpenSize/100B/standard-    5819 ns/op    17.19 MB/s     904 B/op    5 allocs/op
//	BenchmarkSafeOpenSize/1KB/safe-         7183 ns/op   142.55 MB/s    3112 B/op    9 allocs/op
//	BenchmarkSafeOpenSize/1KB/standard-     6088 ns/op   168.20 MB/s    1544 B/op    5 allocs/op
//	BenchmarkSafeOpenSize/10KB/safe-       15646 ns/op   654.47 MB/s   46376 B/op   16 allocs/op
//	BenchmarkSafeOpenSize/10KB/standard-    7302 ns/op  1402.40 MB/s   11272 B/op    5 allocs/op
//	BenchmarkSafeOpenSize/100KB/safe-      71784 ns/op  1426.50 MB/s  514601 B/op   24 allocs/op
//	BenchmarkSafeOpenSize/100KB/standard-  18549 ns/op  5520.57 MB/s  106888 B/op    5 allocs/op
//	BenchmarkSafeOpenSize/1MB/safe-       901594 ns/op  1163.03 MB/s 5241397 B/op   33 allocs/op
//	BenchmarkSafeOpenSize/1MB/standard-   143777 ns/op  7293.08 MB/s 1057168 B/op    5 allocs/op
//
// Analysis: Safe-open overhead increases with file size:
//   - Small files (<1KB): ~0-18% overhead, dominated by path-walk syscalls
//   - Medium files (10KB): ~114% overhead, showing allocation impact
//   - Large files (100KB+): ~287-527% overhead due to 5x memory allocation growth
//
// For typical AI config files (<10KB), the overhead is acceptable. For large files,
// consider caching or using standard read if symlink safety is not critical.
func BenchmarkSafeOpenSize(b *testing.B) {
	sizes := []int{
		100,         // small config file
		1024,        // 1KB
		10 * 1024,   // 10KB
		100 * 1024,  // 100KB
		1024 * 1024, // 1MB
	}

	const depth = 6

	for _, size := range sizes {
		size := size
		b.Run(formatSize(size), func(b *testing.B) {
			root := b.TempDir()
			content := make([]byte, size)
			if _, err := rand.Read(content); err != nil {
				b.Fatalf("generate content: %v", err)
			}
			path := createNestedFile(b, root, depth, content)
			relPath, err := filepath.Rel(root, path)
			if err != nil {
				b.Fatalf("rel path: %v", err)
			}

			b.Run("safe", func(b *testing.B) {
				b.SetBytes(int64(size))
				b.ReportAllocs()
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					data, err := safeReadFilePath(root, path)
					if err != nil {
						b.Fatalf("safeReadFilePath: %v", err)
					}
					if len(data) != size {
						b.Fatalf("wrong length: got %d, want %d", len(data), size)
					}
				}
			})

			b.Run("standard", func(b *testing.B) {
				fullPath := filepath.Join(root, relPath)
				b.SetBytes(int64(size))
				b.ReportAllocs()
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					data, err := os.ReadFile(fullPath)
					if err != nil {
						b.Fatalf("os.ReadFile: %v", err)
					}
					if len(data) != size {
						b.Fatalf("wrong length: got %d, want %d", len(data), size)
					}
				}
			})
		})
	}
}

// createNestedFile creates a file at the specified depth with the given content.
// Returns the absolute path to the created file.
func createNestedFile(tb testing.TB, root string, depth int, content []byte) string {
	tb.Helper()
	if depth < 1 {
		tb.Fatalf("depth must be >= 1, got %d", depth)
	}

	// Build nested directory structure: root/d0/d1/.../dN-1/file.txt
	parts := make([]string, 0, depth+1)
	parts = append(parts, root)
	for i := 0; i < depth-1; i++ {
		parts = append(parts, formatDir(i))
	}
	dirPath := filepath.Join(parts...)
	if err := os.MkdirAll(dirPath, 0o700); err != nil {
		tb.Fatalf("mkdir: %v", err)
	}

	filePath := filepath.Join(dirPath, "file.txt")
	if err := os.WriteFile(filePath, content, 0o600); err != nil {
		tb.Fatalf("write file: %v", err)
	}
	return filePath
}

func formatDepth(depth int) string {
	switch depth {
	case 1:
		return "depth-1"
	case 3:
		return "depth-3"
	case 6:
		return "depth-6"
	case 10:
		return "depth-10"
	default:
		return "depth-" + string(rune('0'+depth))
	}
}

func formatSize(size int) string {
	switch {
	case size < 1024:
		return "100B"
	case size < 10*1024:
		return "1KB"
	case size < 100*1024:
		return "10KB"
	case size < 1024*1024:
		return "100KB"
	default:
		return "1MB"
	}
}

func formatDir(i int) string {
	return "d" + string(rune('0'+i))
}
