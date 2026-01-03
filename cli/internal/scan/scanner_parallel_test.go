package scan

import (
	"path/filepath"
	"reflect"
	"strconv"
	"testing"
)

func TestScanParallelDeterministic(t *testing.T) {
	repoRoot := copyFixture(t, "integration")
	userRoot := t.TempDir()
	writeTestFile(t, filepath.Join(userRoot, "AGENTS.md"), "User instructions")

	registry := integrationRegistry()
	baseline := scanOutputForWorkers(t, repoRoot, userRoot, registry, 1)

	for _, workers := range []int{0, 1, 2, 4, 8} {
		t.Run("workers-"+strconv.Itoa(workers), func(t *testing.T) {
			for run := 0; run < 3; run++ {
				got := scanOutputForWorkers(t, repoRoot, userRoot, registry, workers)
				if !reflect.DeepEqual(baseline, got) {
					t.Fatalf("output mismatch for workers=%d run=%d\nexpected:\n%s\nactual:\n%s", workers, run, mustMarshal(t, baseline), mustMarshal(t, got))
				}
			}
		})
	}
}

func scanOutputForWorkers(t *testing.T, repoRoot string, userRoot string, registry Registry, workers int) Output {
	t.Helper()
	result, err := Scan(Options{
		RepoRoot:       repoRoot,
		UserRoots:      []string{userRoot},
		Registry:       registry,
		IncludeContent: true,
		ScanWorkers:    workers,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	output := BuildOutput(result, OutputOptions{
		SchemaVersion:   "test",
		RegistryVersion: registry.Version,
		ToolVersion:     "test",
		RepoRoot:        repoRoot,
	})
	for i := range output.Configs {
		output.Configs[i].Mtime = 0
	}
	return output
}
