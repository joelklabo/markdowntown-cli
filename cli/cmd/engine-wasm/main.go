//go:build js && wasm

package main

import "markdowntown-cli/internal/engine"

func main() {
	engine.RegisterWasmExports()
	select {}
}
