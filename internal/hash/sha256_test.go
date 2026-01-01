package scanhash

import "testing"

func TestSumHex(t *testing.T) {
	got := SumHex([]byte("abc"))
	const want = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
	if got != want {
		t.Fatalf("expected %s, got %s", want, got)
	}
}
