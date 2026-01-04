package engine

import (
	"context"
	"reflect"
	"testing"
	"time"
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

func TestRunWithContextStopsOnCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	rules := []testRule{
		{out: []int{1}},
	}

	cancel()
	_, err := RunWithContext(ctx, 0, rules)
	if err == nil {
		t.Fatalf("expected context error")
	}
}

func TestRunWithContextCompletes(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	rules := []testRule{
		{out: []int{1}},
		{out: []int{2}},
	}

	got, err := RunWithContext(ctx, 0, rules)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !reflect.DeepEqual(got, []int{1, 2}) {
		t.Fatalf("unexpected issues: %#v", got)
	}
}
