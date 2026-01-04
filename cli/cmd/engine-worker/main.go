// Command engine-worker runs the native engine worker service.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"markdowntown-cli/internal/scan"
	"markdowntown-cli/internal/worker"
)

const (
	defaultAddr          = ":8080"
	defaultTimeoutMs     = 30000
	defaultMaxBodyMB     = 8
	readHeaderTimeoutSec = 5
)

func main() {
	logger := log.New(os.Stderr, "engine-worker: ", log.LstdFlags)

	registry, registryPath, err := scan.LoadRegistry()
	if err != nil {
		logger.Fatalf("load registry failed: %v", err)
	}

	addr := resolveAddr()
	timeout := time.Duration(envInt("ENGINE_WORKER_TIMEOUT_MS", defaultTimeoutMs)) * time.Millisecond
	maxBodyBytes := int64(envInt("ENGINE_WORKER_MAX_BODY_MB", defaultMaxBodyMB)) * 1024 * 1024

	srv := worker.NewServer(worker.Config{
		Registry:     registry,
		Timeout:      timeout,
		MaxBodyBytes: maxBodyBytes,
		Logger:       logger,
	})

	mux := http.NewServeMux()
	mux.HandleFunc("/health", srv.HandleHealth)
	mux.HandleFunc("/run", srv.HandleRun)

	httpServer := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: readHeaderTimeoutSec * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			logger.Printf("shutdown error: %v", err)
		}
	}()

	logger.Printf("worker listening on %s (registry: %s)", addr, registryPath)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Fatalf("server error: %v", err)
	}
}

func resolveAddr() string {
	if addr := strings.TrimSpace(os.Getenv("ENGINE_WORKER_ADDR")); addr != "" {
		return addr
	}
	if port := strings.TrimSpace(os.Getenv("PORT")); port != "" {
		return ":" + port
	}
	return defaultAddr
}

func envInt(name string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		fmt.Fprintf(os.Stderr, "engine-worker: invalid %s=%q, using %d\n", name, value, fallback)
		return fallback
	}
	return parsed
}
