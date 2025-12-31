SHELL := /bin/sh

BINARY_NAME ?= markdowntown
BIN_DIR ?= bin
GO ?= go
GOLANGCI_LINT ?= golangci-lint

.PHONY: build test lint fmt check clean install coverage coverage-html release snapshot run watch dev

build:
	@mkdir -p $(BIN_DIR)
	$(GO) build -o $(BIN_DIR)/$(BINARY_NAME) ./cmd/markdowntown

test:
	$(GO) test ./...

lint:
	$(GOLANGCI_LINT) run ./...

fmt:
	gofmt -w ./cmd ./internal

check: lint test

clean:
	$(GO) clean -cache -testcache
	@rm -rf $(BIN_DIR) coverage.out coverage.html

install:
	$(GO) install ./cmd/markdowntown

coverage:
	$(GO) test -coverprofile=coverage.out ./...

coverage-html: coverage
	$(GO) tool cover -html=coverage.out -o coverage.html

release:
	goreleaser release --clean

snapshot:
	goreleaser release --clean --snapshot

run:
	$(GO) run ./cmd/markdowntown

watch:
	air

dev:
	air
