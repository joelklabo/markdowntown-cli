package context //nolint:revive

import (
	"sort"

	"markdowntown-cli/internal/instructions"
)

// Diff represents the differences between two context resolutions.
type Diff struct {
	OnlyInA []instructions.InstructionFile `json:"onlyInA"`
	OnlyInB []instructions.InstructionFile `json:"onlyInB"`
	Common  []instructions.InstructionFile `json:"common"` // Present in both and identical
	Changed []FileDiff                     `json:"changed"`
}

// FileDiff represents differences for the same instruction file.
type FileDiff struct {
	Path      string                       `json:"path"`
	A         instructions.InstructionFile `json:"a"`
	B         instructions.InstructionFile `json:"b"`
	Reasons   bool                         `json:"reasons"`   // True if reasons differ
	Scopes    bool                         `json:"scopes"`    // True if scopes differ
	Truncated bool                         `json:"truncated"` // True if truncated state differs
}

// DiffResolutions compares two instruction resolutions and returns the differences.
func DiffResolutions(a, b *instructions.Resolution) Diff {
	diff := Diff{
		OnlyInA: []instructions.InstructionFile{},
		OnlyInB: []instructions.InstructionFile{},
		Common:  []instructions.InstructionFile{},
		Changed: []FileDiff{},
	}

	if a == nil && b == nil {
		return diff
	}

	if a == nil {
		diff.OnlyInB = append(diff.OnlyInB, b.Applied...)
		return diff
	}

	if b == nil {
		diff.OnlyInA = append(diff.OnlyInA, a.Applied...)
		return diff
	}

	mapA := make(map[string]instructions.InstructionFile)
	for _, f := range a.Applied {
		mapA[f.Path] = f
	}

	mapB := make(map[string]instructions.InstructionFile)
	for _, f := range b.Applied {
		mapB[f.Path] = f
	}

	for _, fileA := range a.Applied {
		path := fileA.Path
		if fileB, ok := mapB[path]; ok {
			reasonsMatch := fileA.Reason == fileB.Reason
			scopesMatch := fileA.Scope == fileB.Scope
			truncatedMatch := fileA.Truncated == fileB.Truncated

			if reasonsMatch && scopesMatch && truncatedMatch {

				diff.Common = append(diff.Common, fileA)

			} else {

				diff.Changed = append(diff.Changed, FileDiff{

					Path: path,

					A: fileA,

					B: fileB,

					Reasons: !reasonsMatch,

					Scopes: !scopesMatch,

					Truncated: !truncatedMatch,
				})

			}

		} else {

			diff.OnlyInA = append(diff.OnlyInA, fileA)

		}

	}

	for path, fileB := range mapB {

		if _, ok := mapA[path]; !ok {

			diff.OnlyInB = append(diff.OnlyInB, fileB)

		}

	}

	// Sort for determinism

	sort.Slice(diff.Common, func(i, j int) bool { return diff.Common[i].Path < diff.Common[j].Path })

	sort.Slice(diff.OnlyInA, func(i, j int) bool { return diff.OnlyInA[i].Path < diff.OnlyInA[j].Path })

	sort.Slice(diff.OnlyInB, func(i, j int) bool { return diff.OnlyInB[i].Path < diff.OnlyInB[j].Path })

	sort.Slice(diff.Changed, func(i, j int) bool { return diff.Changed[i].Path < diff.Changed[j].Path })

	return diff

}
