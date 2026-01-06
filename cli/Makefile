SHELL := /bin/sh

BINARY_NAME ?= markdowntown
BIN_DIR ?= bin
GO ?= go
PYTHON ?= python3
GOLANGCI_LINT ?= golangci-lint

.PHONY: build test lint fmt check clean install coverage coverage-report coverage-html release snapshot run watch dev lsp-vscode lsp-vscode-test

build:
	@mkdir -p $(BIN_DIR)
	$(GO) build -o $(BIN_DIR)/$(BINARY_NAME) ./cmd/markdowntown

test:
	$(GO) test ./...

lint: lint-go lint-md lint-yaml lint-sh catalog-check

lint-go:
	$(GOLANGCI_LINT) run ./...

catalog-check:
	../scripts/diagnostic-catalog-check.sh

lint-md:
	npx markdownlint-cli "**/*.md" --ignore "**/node_modules/**" --ignore "**/out/**" --ignore "**/.vscode-test/**" --ignore .gemini --config ../.markdownlint.json

lint-yaml:
	@if command -v yamllint > /dev/null; then \
		yamllint .; \
	else \
		echo "yamllint not found, skipping"; \
	fi

lint-sh:
	@if command -v shellcheck > /dev/null; then \
		scripts=""; \
		if ls scripts/*.sh > /dev/null 2>&1; then \
			scripts="$$scripts scripts/*.sh"; \
		fi; \
		if [ -f scripts/lsp-vscode ]; then \
			scripts="$$scripts scripts/lsp-vscode"; \
		fi; \
		if [ -n "$$scripts" ]; then \
			shellcheck $$scripts; \
		else \
			echo "no shell scripts found, skipping"; \
		fi; \
	else \
		echo "shellcheck not found, skipping"; \
	fi

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

coverage-report:
	$(PYTHON) scripts/coverage_report.py coverage.out

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

lsp-vscode:
	./scripts/lsp-vscode

lsp-vscode-test:
	cd vscode-extension && if [ ! -d node_modules ]; then npm install; fi && npm test
