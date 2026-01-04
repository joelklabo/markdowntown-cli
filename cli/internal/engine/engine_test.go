package engine

import (
	"reflect"
	"testing"
)

type testRule struct {
	out []int
}

func (r testRule) Evaluate(_ int) []int {
	return r.out
}

func TestRunAggregatesInOrder(t *testing.T) {
	rules := []testRule{
		{out: []int{1}},
		{out: nil},
		{out: []int{2, 3}},
	}

	got := Run(0, rules)
	want := []int{1, 2, 3}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected issues: %#v", got)
	}
}
