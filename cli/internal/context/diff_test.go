package context //nolint:revive

import (
	"testing"

	"markdowntown-cli/internal/instructions"
)

func TestDiffResolutions(t *testing.T) {
	a := &instructions.Resolution{
		Applied: []instructions.InstructionFile{
			{Path: "common.md", Reason: instructions.ReasonPrimary, Scope: instructions.ScopeRepo},
			{Path: "onlyA.md", Reason: instructions.ReasonPrimary, Scope: instructions.ScopeRepo},
			{Path: "changed.md", Reason: instructions.ReasonPrimary, Scope: instructions.ScopeRepo},
		},
	}

	b := &instructions.Resolution{
		Applied: []instructions.InstructionFile{
			{Path: "common.md", Reason: instructions.ReasonPrimary, Scope: instructions.ScopeRepo},
			{Path: "onlyB.md", Reason: instructions.ReasonPrimary, Scope: instructions.ScopeRepo},
			{Path: "changed.md", Reason: instructions.ReasonOverride, Scope: instructions.ScopeRepo},
		},
	}

	diff := DiffResolutions(a, b)

	if len(diff.Common) != 1 || diff.Common[0].Path != "common.md" {
		t.Errorf("expected 1 common file (common.md), got %d", len(diff.Common))
	}

	if len(diff.OnlyInA) != 1 || diff.OnlyInA[0].Path != "onlyA.md" {
		t.Errorf("expected 1 file only in A (onlyA.md), got %d", len(diff.OnlyInA))
	}

	if len(diff.OnlyInB) != 1 || diff.OnlyInB[0].Path != "onlyB.md" {
		t.Errorf("expected 1 file only in B (onlyB.md), got %d", len(diff.OnlyInB))
	}

	if len(diff.Changed) != 1 || diff.Changed[0].Path != "changed.md" {
		t.Errorf("expected 1 changed file (changed.md), got %d", len(diff.Changed))
	}

	if !diff.Changed[0].Reasons {
		t.Errorf("expected reasons to differ for changed.md")
	}
}
