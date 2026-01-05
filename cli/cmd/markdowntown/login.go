package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"markdowntown-cli/internal/auth"
	"markdowntown-cli/internal/config"
	"markdowntown-cli/internal/version"
)

const loginUsage = `markdowntown login

Usage:
  markdowntown login [flags]

Flags:
   --base-url <url>      Base URL for the web app (default https://markdowntown.app)
   --token <value>       Use an app-issued token (skips device flow)
   --token-stdin         Read token from stdin (skips device flow)
   --scopes <list>       Comma-separated scopes (default: cli:upload,cli:run,cli:patch)
   --client-id <id>      Client ID identifier
   --device-name <name>  Device label for the approval prompt
   -h, --help            Show help
`

const (
	defaultPollInterval = 5 * time.Second
)

func runLogin(args []string) error {
	return runLoginWithIO(os.Stdout, os.Stderr, args)
}

func runLoginWithIO(stdout, stderr io.Writer, args []string) error {
	flags := flag.NewFlagSet("login", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	var baseURL string
	var scopesRaw string
	var deviceName string
	var clientID string
	var token string
	var tokenFromStdin bool
	var help bool
	tokenFlagSet := false

	flags.StringVar(&baseURL, "base-url", "", "base url")
	flags.StringVar(&token, "token", "", "token")
	flags.BoolVar(&tokenFromStdin, "token-stdin", false, "token from stdin")
	flags.StringVar(&scopesRaw, "scopes", "", "scopes")
	flags.StringVar(&deviceName, "device-name", "", "device name")
	flags.StringVar(&clientID, "client-id", "", "client id")
	flags.BoolVar(&help, "help", false, "show help")
	flags.BoolVar(&help, "h", false, "show help")

	if err := flags.Parse(args); err != nil {
		return err
	}
	flags.Visit(func(f *flag.Flag) {
		if f.Name == "token" {
			tokenFlagSet = true
		}
	})
	if help {
		_, _ = fmt.Fprint(stdout, loginUsage)
		return nil
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}

	if token == "-" {
		tokenFromStdin = true
		token = ""
	}
	if tokenFromStdin && token != "" {
		return errors.New("--token and --token-stdin cannot be combined")
	}
	if tokenFromStdin {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return err
		}
		token = strings.TrimSpace(string(data))
	}
	token = strings.TrimSpace(token)
	if tokenFromStdin && token == "" {
		return errors.New("no token provided via stdin")
	}
	manualToken := tokenFromStdin || tokenFlagSet

	resolvedBaseURL, err := auth.ResolveBaseURL(baseURL)
	if err != nil {
		return err
	}
	scopes := parseScopes(scopesRaw)

	if manualToken {
		return saveManualToken(stdout, stderr, token, scopes, resolvedBaseURL)
	}

	if strings.TrimSpace(deviceName) == "" {
		if host, err := os.Hostname(); err == nil {
			deviceName = host
		}
	}

	client := auth.NewDeviceFlowClient(resolvedBaseURL, nil)

	start, err := client.Start(context.Background(), auth.DeviceStartRequest{
		ClientID:   clientID,
		CliVersion: version.ToolVersion,
		DeviceName: deviceName,
		Scopes:     scopes,
	})
	if err != nil {
		return err
	}

	printLoginInstructions(stdout, start)

	interval := time.Duration(start.Interval) * time.Second
	if interval <= 0 {
		interval = defaultPollInterval
	}
	deadline := time.Now().Add(time.Duration(start.ExpiresIn) * time.Second)

	_, _ = fmt.Fprintln(stdout, "Waiting for approval...")
	for {
		if time.Now().After(deadline) {
			return errors.New("device code expired; run login again")
		}

		time.Sleep(interval)
		poll, err := client.Poll(context.Background(), start.DeviceCode)
		if err != nil {
			return err
		}

		if poll.AccessToken != "" {
			record := config.AuthRecord{
				AccessToken: poll.AccessToken,
				TokenType:   poll.TokenType,
				Scopes:      poll.Scopes,
				ExpiresAt:   time.Now().Add(time.Duration(poll.ExpiresIn) * time.Second),
				CreatedAt:   time.Now(),
				BaseURL:     resolvedBaseURL,
			}

			result, err := auth.SaveAuth(record)
			if err != nil {
				return err
			}
			if result.Warning != nil {
				_, _ = fmt.Fprintf(stderr, "Keyring unavailable (%v); token stored at %s.\n", result.Warning, authFileHint())
			}
			_, _ = fmt.Fprintf(stdout, "Login successful. Token stored in %s (expires %s).\n", result.Location, record.ExpiresAt.Format(time.RFC3339))
			return nil
		}

		switch poll.Error {
		case "authorization_pending":
			continue
		case "slow_down":
			interval = adjustInterval(interval, poll.Interval)
			_, _ = fmt.Fprintf(stdout, "Slowing down polling to %s...\n", interval)
			continue
		case "access_denied":
			return errors.New("access denied; authorization canceled")
		case "expired_token":
			return errors.New("device code expired; run login again")
		case "":
			return errors.New("unexpected poll response")
		default:
			return fmt.Errorf("login failed: %s", poll.Error)
		}
	}
}

func parseScopes(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	parts := strings.Split(trimmed, ",")
	scopes := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value == "" {
			continue
		}
		scopes = append(scopes, value)
	}
	return scopes
}

func printLoginInstructions(w io.Writer, start auth.DeviceStartResponse) {
	_, _ = fmt.Fprintf(w, "Open %s and enter code %s\n", start.VerificationURI, start.UserCode)
	if start.VerificationURIComplete != "" {
		_, _ = fmt.Fprintf(w, "Or open %s\n", start.VerificationURIComplete)
	}
}

func adjustInterval(current time.Duration, suggested int) time.Duration {
	if suggested > 0 {
		return time.Duration(suggested) * time.Second
	}
	if current <= 0 {
		return defaultPollInterval
	}
	return current + defaultPollInterval
}

func authFileHint() string {
	path, err := config.AuthPath()
	if err != nil {
		return "local file"
	}
	return path
}

func saveManualToken(stdout, stderr io.Writer, token string, scopes []string, baseURL string) error {
	if token == "" {
		return errors.New("token must not be empty")
	}
	record := config.AuthRecord{
		AccessToken: token,
		TokenType:   "Bearer",
		Scopes:      scopes,
		CreatedAt:   time.Now(),
		BaseURL:     baseURL,
	}
	result, err := auth.SaveAuth(record)
	if err != nil {
		return err
	}
	if result.Warning != nil {
		_, _ = fmt.Fprintf(stderr, "Keyring unavailable (%v); token stored at %s.\n", result.Warning, authFileHint())
	}
	_, _ = fmt.Fprintf(stdout, "Token stored in %s.\n", result.Location)
	return nil
}
