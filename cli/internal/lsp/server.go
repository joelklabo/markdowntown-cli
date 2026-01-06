// Package lsp implements the markdowntown language server protocol handlers.
package lsp

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf16"
	"unicode/utf8"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"

	"github.com/spf13/afero"
	"github.com/tliron/commonlog"
	_ "github.com/tliron/commonlog/simple" // enable default logger
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
	"github.com/tliron/glsp/server"
)

const (
	serverName      = "markdowntown"
	debounceTimeout = 500 * time.Millisecond

	actionTitleRemoveFrontmatter                = "Remove invalid frontmatter block"
	actionTitleInsertPlaceholder                = "Insert placeholder instructions"
	actionTitleAllowGitignoreEntry              = "Allow this config in .gitignore"
	actionTitleCreateRepoPrefix                 = "Create repo config at "
	actionTitleRemoveDuplicateFrontmatterPrefix = "Remove duplicate frontmatter "
	actionTitleInsertFrontmatterPrefix          = "Insert frontmatter "
	actionTitleReplaceToolIDPrefix              = "Replace toolId with "
	actionTitleDisableRulePrefix                = "Disable rule "
)

// Server holds LSP state and handlers.
type Server struct {
	version string
	handler *protocol.Handler
	server  *server.Server
	overlay afero.Fs
	base    afero.Fs
	fs      afero.Fs

	// Workspace state
	rootPath string

	settingsMu           sync.RWMutex
	settings             Settings
	lastValidSettings    Settings
	diagnosticCaps       DiagnosticCapabilities
	diagnosticCapsMu     sync.RWMutex
	configChangeMu       sync.Mutex
	configChangeTimer    *time.Timer
	pendingConfigContext *glsp.Context
	pendingConfigInput   any

	inFlight sync.WaitGroup

	// Diagnostics state
	diagnosticsMu    sync.Mutex
	diagnosticTimers map[string]*time.Timer
	Debounce         time.Duration

	// Cache state
	cacheMu          sync.Mutex
	frontmatterCache map[string]*scan.ParsedFrontmatter
	scanCacheMu      sync.RWMutex
	scanCache        map[string]scan.Result
	versionMu        sync.Mutex
	documentVersions map[string]protocol.Integer
}

// NewServer constructs a new LSP server.
func NewServer(version string) *Server {
	defaultSettings := DefaultSettings()
	s := &Server{
		version:           version,
		overlay:           afero.NewMemMapFs(),
		base:              afero.NewOsFs(),
		diagnosticTimers:  make(map[string]*time.Timer),
		Debounce:          0,
		settings:          defaultSettings,
		lastValidSettings: defaultSettings,
		frontmatterCache:  make(map[string]*scan.ParsedFrontmatter),
		scanCache:         make(map[string]scan.Result),
		documentVersions:  make(map[string]protocol.Integer),
	}
	s.fs = afero.NewCopyOnWriteFs(s.base, s.overlay)

	s.handler = &protocol.Handler{
		Initialize:                      s.initialize,
		Initialized:                     s.initialized,
		Shutdown:                        s.shutdown,
		SetTrace:                        s.setTrace,
		TextDocumentDidOpen:             s.didOpen,
		TextDocumentDidChange:           s.didChange,
		TextDocumentDidClose:            s.didClose,
		TextDocumentHover:               s.hover,
		TextDocumentDefinition:          s.definition,
		TextDocumentDocumentSymbol:      s.documentSymbol,
		TextDocumentCompletion:          s.completion,
		TextDocumentCodeAction:          s.codeAction,
		TextDocumentCodeLens:            s.codeLens,
		WorkspaceDidChangeConfiguration: s.didChangeConfiguration,
	}

	s.server = server.NewServer(s.handler, serverName, false)
	return s
}

// Run starts the LSP server stdio loop.
func (s *Server) Run() error {
	return s.server.RunStdio()
}

func (s *Server) initialize(_ *glsp.Context, params *protocol.InitializeParams) (any, error) {
	if params == nil {
		params = &protocol.InitializeParams{}
	}
	if params.RootURI != nil {
		path, err := urlToPath(*params.RootURI)
		if err == nil {
			s.rootPath = path
		}
	} else if params.RootPath != nil {
		s.rootPath = *params.RootPath
	}

	s.applySettings(params.InitializationOptions)
	s.setDiagnosticCapabilities(params.Capabilities)

	capabilities := protocol.ServerCapabilities{
		TextDocumentSync:       protocol.TextDocumentSyncKindFull,
		HoverProvider:          true,
		DefinitionProvider:     true,
		DocumentSymbolProvider: true,
		CompletionProvider: &protocol.CompletionOptions{
			TriggerCharacters: []string{":", " "},
		},
		CodeActionProvider: true,
		CodeLensProvider:   &protocol.CodeLensOptions{},
	}

	return protocol.InitializeResult{
		Capabilities: capabilities,
		ServerInfo: &protocol.InitializeResultServerInfo{
			Name:    serverName,
			Version: &s.version,
		},
	}, nil
}

func (s *Server) initialized(_ *glsp.Context, _ *protocol.InitializedParams) error {
	return nil
}

func (s *Server) shutdown(_ *glsp.Context) error {
	// Cancel pending config change timer
	s.configChangeMu.Lock()
	if s.configChangeTimer != nil {
		if s.configChangeTimer.Stop() {
			s.inFlight.Done()
		}
		s.configChangeTimer = nil
	}
	s.configChangeMu.Unlock()

	// Cancel all active diagnostic timers
	s.diagnosticsMu.Lock()
	for uri, timer := range s.diagnosticTimers {
		if timer.Stop() {
			s.inFlight.Done()
		}
		delete(s.diagnosticTimers, uri)
	}
	s.diagnosticsMu.Unlock()

	// Wait for all in-flight tasks to complete
	s.inFlight.Wait()

	protocol.SetTraceValue(protocol.TraceValueOff)
	return nil
}

func (s *Server) setTrace(_ *glsp.Context, params *protocol.SetTraceParams) error {
	protocol.SetTraceValue(params.Value)
	return nil
}

func (s *Server) didChangeConfiguration(context *glsp.Context, params *protocol.DidChangeConfigurationParams) error {
	if params == nil {
		return nil
	}

	// Cancel existing config change timer if any
	s.configChangeMu.Lock()
	if s.configChangeTimer != nil {
		if s.configChangeTimer.Stop() {
			s.inFlight.Done()
			commonlog.GetLogger(serverName).Debugf("Config change timer canceled")
		}
		s.configChangeTimer = nil
	}

	// Store pending config and schedule debounced application
	s.pendingConfigContext = context
	s.pendingConfigInput = params.Settings

	debounce := s.Debounce
	if debounce == 0 {
		debounce = 100 * time.Millisecond // Default config debounce
	}

	s.inFlight.Add(1)
	s.configChangeTimer = time.AfterFunc(debounce, func() {
		s.applyConfigChange()
	})
	s.configChangeMu.Unlock()

	commonlog.GetLogger(serverName).Debugf("Config change scheduled (debounce: %v)", debounce)
	return nil
}

func (s *Server) applyConfigChange() {
	defer s.inFlight.Done()

	s.configChangeMu.Lock()
	context := s.pendingConfigContext
	input := s.pendingConfigInput
	s.configChangeTimer = nil
	s.pendingConfigContext = nil
	s.pendingConfigInput = nil
	s.configChangeMu.Unlock()

	commonlog.GetLogger(serverName).Debugf("Config change timer fired, applying settings")

	// Parse and validate settings
	settings, warnings := ParseSettings(input)
	logger := commonlog.GetLogger(serverName)

	// If there are warnings, fall back to last-known-good settings
	if len(warnings) > 0 {
		for _, warning := range warnings {
			logger.Warningf("Invalid config (falling back to last-known-good): %s", warning)
		}
		s.settingsMu.RLock()
		settings = s.lastValidSettings
		s.settingsMu.RUnlock()
		logger.Info("Using last-known-good settings due to invalid config")
	} else {
		// Settings are valid, store as last-known-good
		s.settingsMu.Lock()
		s.lastValidSettings = settings
		s.settingsMu.Unlock()
	}

	// Apply the settings (either new valid settings or last-known-good)
	s.settingsMu.Lock()
	s.settings = settings
	s.settingsMu.Unlock()

	// Invalidate scan cache and trigger diagnostics refresh
	s.scanCacheMu.Lock()
	s.scanCache = make(map[string]scan.Result)
	s.scanCacheMu.Unlock()

	s.cacheMu.Lock()
	uris := make([]string, 0, len(s.frontmatterCache))
	for uri := range s.frontmatterCache {
		uris = append(uris, uri)
	}
	s.cacheMu.Unlock()

	for _, uri := range uris {
		s.triggerDiagnostics(context, uri)
	}
}

func (s *Server) applySettings(input any) {
	settings, warnings := ParseSettings(input)
	s.settingsMu.Lock()
	s.settings = settings
	s.settingsMu.Unlock()

	logger := commonlog.GetLogger(serverName)
	for _, warning := range warnings {
		logger.Warning(warning)
	}
}

func (s *Server) currentSettings() Settings {
	s.settingsMu.RLock()
	defer s.settingsMu.RUnlock()
	return s.settings
}

func (s *Server) setDiagnosticCapabilities(capabilities protocol.ClientCapabilities) {
	diagCaps := DiagnosticCapabilities{RelatedInformation: true}
	if capabilities.TextDocument != nil && capabilities.TextDocument.PublishDiagnostics != nil {
		publish := capabilities.TextDocument.PublishDiagnostics
		if publish.RelatedInformation != nil {
			diagCaps.RelatedInformation = boolValue(publish.RelatedInformation)
		}
		diagCaps.CodeDescription = boolValue(publish.CodeDescriptionSupport)
		if publish.TagSupport != nil && len(publish.TagSupport.ValueSet) > 0 {
			diagCaps.Tags = true
		}
	}

	s.diagnosticCapsMu.Lock()
	s.diagnosticCaps = diagCaps
	s.diagnosticCapsMu.Unlock()
}

func (s *Server) diagnosticCapsSnapshot() DiagnosticCapabilities {
	s.diagnosticCapsMu.RLock()
	defer s.diagnosticCapsMu.RUnlock()
	return s.diagnosticCaps
}

func boolValue(value *bool) bool {
	return value != nil && *value
}

func (s *Server) didOpen(context *glsp.Context, params *protocol.DidOpenTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}
	err = afero.WriteFile(s.overlay, path, []byte(params.TextDocument.Text), 0644)
	if err != nil {
		return err
	}

	s.scanCacheMu.Lock()
	s.scanCache = make(map[string]scan.Result)
	s.scanCacheMu.Unlock()

	s.versionMu.Lock()
	s.documentVersions[params.TextDocument.URI] = params.TextDocument.Version
	s.versionMu.Unlock()

	// Cache frontmatter
	parsed, _, _ := scan.ParseFrontmatter([]byte(params.TextDocument.Text))
	s.cacheMu.Lock()
	s.frontmatterCache[params.TextDocument.URI] = parsed
	s.cacheMu.Unlock()

	s.triggerDiagnostics(context, params.TextDocument.URI)
	return nil
}

func (s *Server) didChange(context *glsp.Context, params *protocol.DidChangeTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}

	if params.TextDocument.Version != 0 {
		s.versionMu.Lock()
		current, ok := s.documentVersions[params.TextDocument.URI]
		if ok && params.TextDocument.Version < current {
			s.versionMu.Unlock()
			commonlog.GetLogger(serverName).Infof(
				"Ignoring stale didChange for %s: version %d < %d",
				params.TextDocument.URI,
				params.TextDocument.Version,
				current,
			)
			return nil
		}
		s.documentVersions[params.TextDocument.URI] = params.TextDocument.Version
		s.versionMu.Unlock()
	}

	currentContent := ""
	if data, err := afero.ReadFile(s.fs, path); err == nil {
		currentContent = string(data)
	}

	updated := false
	for _, change := range params.ContentChanges {
		event, ok := decodeContentChange(change)
		if !ok {
			continue
		}
		next, ok := applyContentChange(currentContent, event)
		if !ok {
			continue
		}
		currentContent = next
		updated = true
	}

	if updated {
		if err := afero.WriteFile(s.overlay, path, []byte(currentContent), 0644); err != nil {
			return err
		}
		s.scanCacheMu.Lock()
		s.scanCache = make(map[string]scan.Result)
		s.scanCacheMu.Unlock()
	}

	if updated {
		parsed, _, _ := scan.ParseFrontmatter([]byte(currentContent))
		s.cacheMu.Lock()
		s.frontmatterCache[params.TextDocument.URI] = parsed
		s.cacheMu.Unlock()
	}

	s.triggerDiagnostics(context, params.TextDocument.URI)
	return nil
}

func (s *Server) didClose(_ *glsp.Context, params *protocol.DidCloseTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}

	s.cacheMu.Lock()
	delete(s.frontmatterCache, params.TextDocument.URI)
	s.cacheMu.Unlock()

	s.diagnosticsMu.Lock()
	if timer, ok := s.diagnosticTimers[params.TextDocument.URI]; ok {
		timer.Stop()
		delete(s.diagnosticTimers, params.TextDocument.URI)
		commonlog.GetLogger(serverName).Debugf("Debounce timer canceled on close for %s", params.TextDocument.URI)
	}
	s.diagnosticsMu.Unlock()

	s.versionMu.Lock()
	delete(s.documentVersions, params.TextDocument.URI)
	s.versionMu.Unlock()

	s.scanCacheMu.Lock()
	s.scanCache = make(map[string]scan.Result)
	s.scanCacheMu.Unlock()

	return s.overlay.Remove(path)
}

func (s *Server) hover(_ *glsp.Context, params *protocol.HoverParams) (*protocol.Hover, error) {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[params.TextDocument.URI]
	s.cacheMu.Unlock()

	if parsed == nil {
		return nil, nil //nolint:nilnil
	}

	line := int(params.Position.Line + 1)

	var foundKey string
	for key, loc := range parsed.Locations {
		if loc.StartLine == line {
			foundKey = key
			break
		}
	}

	if foundKey == "" {
		return nil, nil //nolint:nilnil // Valid LSP response for no hover
	}

	if strings.Contains(foundKey, "toolId") {
		val, ok := getValue(parsed.Data, foundKey)
		if ok {
			toolID, _ := val.(string)
			if toolID != "" {
				registry, _, err := scan.LoadRegistry()
				if err == nil {
					for _, p := range registry.Patterns {
						if p.ToolID == toolID {
							content := fmt.Sprintf("**%s**\n\n%s\n\nDocs: %s", p.ToolName, p.Notes, strings.Join(p.Docs, ", "))
							return &protocol.Hover{
								Contents: protocol.MarkupContent{
									Kind:  protocol.MarkupKindMarkdown,
									Value: content,
								},
							}, nil
						}
					}
				}
			}
		}
	}

	return nil, nil //nolint:nilnil
}

func (s *Server) definition(_ *glsp.Context, params *protocol.DefinitionParams) (any, error) {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[params.TextDocument.URI]
	s.cacheMu.Unlock()

	if parsed == nil {
		return nil, nil //nolint:nilnil
	}

	line := int(params.Position.Line + 1)
	var foundKey string
	for key, loc := range parsed.Locations {
		if loc.StartLine == line {
			foundKey = key
			break
		}
	}

	if foundKey == "" {
		return nil, nil //nolint:nilnil // Valid LSP response for no definition
	}

	if strings.Contains(foundKey, "toolId") {
		val, ok := getValue(parsed.Data, foundKey)
		if ok {
			toolID, _ := val.(string)
			if toolID != "" {
				if location, err := registryDefinitionLocation(toolID); err == nil && location != nil {
					return *location, nil
				}

				repoRoot := s.rootPath
				if repoRoot != "" {
					agentsPath := filepath.Join(repoRoot, "AGENTS.md")
					if _, err := s.fs.Stat(agentsPath); err == nil {
						return protocol.Location{
							URI: pathToURL(agentsPath),
							Range: protocol.Range{
								Start: protocol.Position{Line: 0, Character: 0},
								End:   protocol.Position{Line: 0, Character: 0},
							},
						}, nil
					}
				}
			}
		}
	}

	return nil, nil //nolint:nilnil
}

func (s *Server) triggerDiagnostics(context *glsp.Context, uri string) {
	if context == nil {
		return
	}
	s.diagnosticsMu.Lock()
	defer s.diagnosticsMu.Unlock()

	if timer, ok := s.diagnosticTimers[uri]; ok {
		if timer.Stop() {
			s.inFlight.Done()
			commonlog.GetLogger(serverName).Debugf("Debounce timer canceled for %s", uri)
		}
	}

	delay := s.Debounce
	if delay <= 0 {
		settings := s.currentSettings()
		if settings.Diagnostics.DelayMs > 0 {
			delay = time.Duration(settings.Diagnostics.DelayMs) * time.Millisecond
		}
	}
	if delay <= 0 {
		delay = debounceTimeout
	}
	var timer *time.Timer
	s.inFlight.Add(1)
	timer = time.AfterFunc(delay, func() {
		defer s.inFlight.Done()

		s.diagnosticsMu.Lock()
		current, ok := s.diagnosticTimers[uri]
		if !ok || current != timer {
			s.diagnosticsMu.Unlock()
			return
		}
		delete(s.diagnosticTimers, uri)
		s.diagnosticsMu.Unlock()
		commonlog.GetLogger(serverName).Debugf("Debounce timer fired for %s", uri)
		s.runDiagnostics(context, uri)
	})
	s.diagnosticTimers[uri] = timer
}

func (s *Server) runDiagnostics(context *glsp.Context, uri string) {
	path, err := urlToPath(uri)
	if err != nil {
		return
	}

	settings := s.currentSettings()
	caps := s.diagnosticCapsSnapshot()
	if !settings.Diagnostics.Enabled {
		s.publishDiagnostics(context, uri, nil)
		return
	}

	repoRoot := s.rootPath
	if repoRoot == "" {
		repoRoot = filepath.Dir(path)
	}
	repoRoot = filepath.Clean(repoRoot)

	result, registry, err := s.scanForDiagnostics(path, repoRoot)
	if err != nil {
		if errors.Is(err, scan.ErrRegistryNotFound) ||
			errors.Is(err, scan.ErrRegistryPathMissing) ||
			errors.Is(err, scan.ErrMultipleRegistries) {
			s.publishDiagnosticsError(context, uri, registryErrorMessage(err), err, registryErrorSuggestion(err), settings, caps)
		} else {
			s.publishDiagnosticsError(context, uri, "Scan failed", err, "Verify the registry path and config permissions, then retry.", settings, caps)
		}
		return
	}

	homeDir := ""
	xdgConfigHome := ""
	if home, err := os.UserHomeDir(); err == nil {
		homeDir = home
		if xdg := os.Getenv("XDG_CONFIG_HOME"); strings.TrimSpace(xdg) != "" {
			xdgConfigHome = xdg
		} else {
			xdgConfigHome = filepath.Join(homeDir, ".config")
		}
	}
	redactor := audit.NewRedactor(repoRoot, homeDir, xdgConfigHome, settings.Diagnostics.RedactPaths)
	auditCtx := audit.Context{
		Scan: scan.BuildOutput(result, scan.OutputOptions{
			RepoRoot: repoRoot,
		}),
		Registry: registry,
		Redactor: redactor,
	}

	rules := s.rulesForSettings(settings)
	issues := audit.RunRules(auditCtx, rules)
	issues = applySeverityOverridesToIssues(issues, settings.Diagnostics.SeverityOverrides)
	s.logDiagnosticsSummary(issues)

	diagnostics := s.diagnosticsForIssues(issues, uri, path, repoRoot, settings, caps)
	if diag := s.unknownToolIDDiagnostic(uri, path, registry, settings, caps); diag != nil {
		diagnostics = append(diagnostics, *diag)
	}

	s.publishDiagnostics(context, uri, diagnostics)
}

func (s *Server) scanForDiagnostics(path string, repoRoot string) (scan.Result, scan.Registry, error) {
	repoOnly := true
	var userRoots []string
	if userRoot, ok := userRootForPath(path); ok {
		repoOnly = false
		userRoots = []string{userRoot}
	} else if _, ok := relativeRepoPath(repoRoot, path); !ok {
		repoOnly = false
		userRoots = []string{filepath.Dir(path)}
	}

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return scan.Result{}, scan.Registry{}, err
	}

	var stdinPaths []string
	if _, err := s.overlay.Stat(path); err == nil {
		stdinPaths = append(stdinPaths, path)
	}

	result, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		RepoOnly:       repoOnly,
		IncludeContent: true,
		StdinPaths:     stdinPaths,
		UserRoots:      userRoots,
		Registry:       registry,
		Fs:             s.fs,
	})
	if err != nil {
		return scan.Result{}, registry, err
	}
	if updated, err := scan.ApplyGitignore(result, repoRoot); err == nil {
		result = updated
	}

	return result, registry, nil
}

func (s *Server) rulesForSettings(settings Settings) []audit.Rule {
	rules := audit.DefaultRules()
	if len(settings.Diagnostics.SeverityOverrides) > 0 {
		if updated, err := audit.ApplySeverityOverrides(rules, settings.Diagnostics.SeverityOverrides); err != nil {
			commonlog.GetLogger(serverName).Warningf("severity overrides ignored: %v", err)
		} else {
			rules = updated
		}
	}
	if len(settings.Diagnostics.RulesEnabled) > 0 || len(settings.Diagnostics.RulesDisabled) > 0 {
		if filtered, err := audit.FilterRules(rules, settings.Diagnostics.RulesEnabled, settings.Diagnostics.RulesDisabled); err != nil {
			commonlog.GetLogger(serverName).Warningf("rule filters ignored: %v", err)
		} else {
			rules = filtered
		}
	}
	return rules
}

func applySeverityOverridesToIssues(issues []audit.Issue, overrides map[string]audit.Severity) []audit.Issue {
	if len(overrides) == 0 {
		return issues
	}
	for i := range issues {
		if issues[i].RuleID == "" {
			continue
		}
		if override, ok := overrides[strings.ToUpper(issues[i].RuleID)]; ok {
			issues[i].Severity = override
		}
	}
	return issues
}

func (s *Server) diagnosticsForIssues(issues []audit.Issue, uri string, path string, repoRoot string, settings Settings, caps DiagnosticCapabilities) []protocol.Diagnostic {
	diagnostics := make([]protocol.Diagnostic, 0)
	redactMode := settings.Diagnostics.RedactPaths
	redactEnabled := redactMode != audit.RedactNever
	includeRelatedInfo := settings.Diagnostics.IncludeRelatedInfo && caps.RelatedInformation && !redactEnabled
	includeEvidence := settings.Diagnostics.IncludeEvidence
	includeTags := caps.Tags
	includeCodeDescription := caps.CodeDescription

	for _, issue := range issues {
		if !issueMatchesPath(issue, path, repoRoot) {
			continue
		}
		diag := diagnosticForIssue(issue, uri, path, repoRoot, includeRelatedInfo, includeEvidence, includeTags, includeCodeDescription, redactMode)
		diagnostics = append(diagnostics, diag)
	}

	return diagnostics
}

func issueMatchesPath(issue audit.Issue, path string, repoRoot string) bool {
	normalizedPath := normalizePathForMatch(path)
	if normalizedPath == "" {
		return false
	}
	root := filepath.Clean(repoRoot)
	for _, p := range issue.Paths {
		if normalizePathForMatch(p.Path) == normalizedPath {
			return true
		}
		if root != "" {
			candidate := filepath.Join(root, filepath.FromSlash(p.Path))
			if normalizePathForMatch(candidate) == normalizedPath {
				return true
			}
		}
	}
	return false
}

func normalizePathForMatch(value string) string {
	if value == "" {
		return ""
	}
	normalized := filepath.Clean(filepath.FromSlash(value))
	normalized = filepath.ToSlash(normalized)
	if runtime.GOOS == "windows" {
		normalized = strings.ToLower(normalized)
	}
	return normalized
}

func (s *Server) unknownToolIDDiagnostic(uri string, path string, registry scan.Registry, settings Settings, caps DiagnosticCapabilities) *protocol.Diagnostic {
	parsed := s.frontmatterForURI(uri, path)
	if parsed == nil {
		return nil
	}
	raw, ok := getValue(parsed.Data, "toolId")
	if !ok {
		return nil
	}
	toolID, ok := raw.(string)
	if !ok {
		return nil
	}
	toolID = strings.TrimSpace(toolID)
	if toolID == "" {
		return nil
	}

	toolIDs := registryToolIDs(registry)
	for _, id := range toolIDs {
		if strings.EqualFold(id, toolID) {
			return nil
		}
	}

	replacement := closestToolID(toolID, toolIDs)
	if replacement == "" {
		return nil
	}

	message := fmt.Sprintf("Unknown toolId: %s", toolID)
	suggestion := fmt.Sprintf("Replace with %s.", replacement)
	code := protocol.IntegerOrString{Value: "MD015"}
	source := serverName
	severity := protocol.DiagnosticSeverityWarning
	if override, ok := settings.Diagnostics.SeverityOverrides["MD015"]; ok {
		if mapped := severityToProtocolSeverity(override); mapped != nil {
			severity = *mapped
		}
	}
	diag := protocol.Diagnostic{
		Range:    frontmatterValueRange(parsed, "toolId"),
		Severity: &severity,
		Code:     &code,
		Source:   &source,
		Message:  message,
		Data: map[string]any{
			"ruleId":      "MD015",
			"title":       "Unknown toolId",
			"suggestion":  suggestion,
			"toolId":      toolID,
			"replacement": replacement,
			"quickFixes":  []string{quickFixReplaceToolID},
		},
	}
	if meta := issueRuleData(audit.Issue{RuleID: "MD015"}); meta != nil {
		if meta.Category != "" {
			diag.Data.(map[string]any)["category"] = meta.Category
		}
		if meta.DocURL != "" {
			diag.Data.(map[string]any)["docUrl"] = meta.DocURL
		}
		if len(meta.QuickFixes) > 0 {
			diag.Data.(map[string]any)["quickFixes"] = append([]string(nil), meta.QuickFixes...)
		}
		if caps.CodeDescription {
			if desc := diagnosticCodeDescription(meta.DocURL); desc != nil {
				diag.CodeDescription = desc
			}
		}
	}
	if suggestion != "" && settings.Diagnostics.IncludeRelatedInfo && caps.RelatedInformation && settings.Diagnostics.RedactPaths == audit.RedactNever {
		diag.RelatedInformation = []protocol.DiagnosticRelatedInformation{
			{
				Location: protocol.Location{
					URI:   uri,
					Range: diag.Range,
				},
				Message: "Suggestion: " + suggestion,
			},
		}
	}
	return &diag
}

func (s *Server) frontmatterForURI(uri string, path string) *scan.ParsedFrontmatter {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[uri]
	s.cacheMu.Unlock()
	if parsed != nil {
		return parsed
	}
	if path == "" {
		return nil
	}
	data, err := afero.ReadFile(s.fs, path)
	if err != nil {
		return nil
	}
	parsed, _, err = scan.ParseFrontmatter(data)
	if err != nil {
		return nil
	}
	return parsed
}

func registryToolIDs(registry scan.Registry) []string {
	seen := make(map[string]struct{})
	for _, pattern := range registry.Patterns {
		if pattern.ToolID == "" {
			continue
		}
		seen[pattern.ToolID] = struct{}{}
	}
	ids := make([]string, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func frontmatterValueRange(parsed *scan.ParsedFrontmatter, key string) protocol.Range {
	if parsed == nil {
		return protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}}
	}
	if rng, ok := parsed.Values[key]; ok {
		return issueToProtocolRange(&rng)
	}
	if rng, ok := parsed.Locations[key]; ok {
		return issueToProtocolRange(&rng)
	}
	return protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}}
}

func (s *Server) publishDiagnosticsError(context *glsp.Context, uri string, message string, err error, suggestion string, settings Settings, caps DiagnosticCapabilities) {
	if context == nil {
		return
	}
	fullMessage := message
	if err != nil {
		fullMessage = fmt.Sprintf("%s: %v", message, err)
	}
	code := protocol.IntegerOrString{Value: "MD000"}
	source := serverName
	severity := protocol.DiagnosticSeverityError
	diag := protocol.Diagnostic{
		Range:    protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
		Severity: &severity,
		Code:     &code,
		Source:   &source,
		Message:  fullMessage,
		Data: map[string]any{
			"ruleId":     "MD000",
			"title":      "LSP error",
			"suggestion": suggestion,
		},
	}
	if meta := issueRuleData(audit.Issue{RuleID: "MD000"}); meta != nil {
		if meta.Category != "" {
			diag.Data.(map[string]any)["category"] = meta.Category
		}
		if meta.DocURL != "" {
			diag.Data.(map[string]any)["docUrl"] = meta.DocURL
		}
		if caps.CodeDescription {
			if desc := diagnosticCodeDescription(meta.DocURL); desc != nil {
				diag.CodeDescription = desc
			}
		}
	}
	if suggestion != "" && settings.Diagnostics.IncludeRelatedInfo && caps.RelatedInformation && settings.Diagnostics.RedactPaths == audit.RedactNever {
		diag.RelatedInformation = []protocol.DiagnosticRelatedInformation{
			{
				Location: protocol.Location{
					URI:   uri,
					Range: diag.Range,
				},
				Message: "Suggestion: " + suggestion,
			},
		}
	}
	s.publishDiagnostics(context, uri, []protocol.Diagnostic{diag})
}

func (s *Server) publishDiagnostics(context *glsp.Context, uri string, diagnostics []protocol.Diagnostic) {
	if context == nil {
		return
	}
	if diagnostics == nil {
		diagnostics = []protocol.Diagnostic{}
	}
	context.Notify(protocol.ServerTextDocumentPublishDiagnostics, protocol.PublishDiagnosticsParams{
		URI:         uri,
		Diagnostics: diagnostics,
	})
}

func registryErrorMessage(err error) string {
	switch {
	case errors.Is(err, scan.ErrRegistryNotFound):
		return "Registry not found"
	case errors.Is(err, scan.ErrRegistryPathMissing):
		return "Registry path does not exist"
	case errors.Is(err, scan.ErrMultipleRegistries):
		return "Multiple registries found"
	default:
		return "Registry error"
	}
}

func registryErrorSuggestion(err error) string {
	switch {
	case errors.Is(err, scan.ErrRegistryNotFound):
		return "Set markdowntown.registryPath (VS Code) or MARKDOWNTOWN_REGISTRY to a valid ai-config-patterns.json."
	case errors.Is(err, scan.ErrRegistryPathMissing):
		return "Update markdowntown.registryPath (VS Code) or MARKDOWNTOWN_REGISTRY to a valid path."
	case errors.Is(err, scan.ErrMultipleRegistries):
		return "Set markdowntown.registryPath (VS Code) or MARKDOWNTOWN_REGISTRY to choose one registry."
	default:
		return "Check MARKDOWNTOWN_REGISTRY or your global registry install."
	}
}

func (s *Server) logDiagnosticsSummary(issues []audit.Issue) {
	logger := commonlog.GetLogger(serverName)
	if logger == nil {
		return
	}
	counts := audit.BuildSummary(issues)
	total := counts.IssueCounts.Error + counts.IssueCounts.Warning + counts.IssueCounts.Info
	topRules := topRuleIDs(issues, 3)
	if total == 0 {
		logger.Infof("Diagnostics summary: 0 issues")
		return
	}
	logger.Infof("Diagnostics summary: %d issues (E:%d W:%d I:%d) top rules: %s",
		total,
		counts.IssueCounts.Error,
		counts.IssueCounts.Warning,
		counts.IssueCounts.Info,
		strings.Join(topRules, ", "),
	)
}

func topRuleIDs(issues []audit.Issue, limit int) []string {
	if limit <= 0 {
		return nil
	}
	counts := make(map[string]int)
	for _, issue := range issues {
		if issue.RuleID == "" {
			continue
		}
		counts[issue.RuleID]++
	}
	type pair struct {
		id    string
		count int
	}
	pairs := make([]pair, 0, len(counts))
	for id, count := range counts {
		pairs = append(pairs, pair{id: id, count: count})
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].count != pairs[j].count {
			return pairs[i].count > pairs[j].count
		}
		return pairs[i].id < pairs[j].id
	})
	if len(pairs) > limit {
		pairs = pairs[:limit]
	}
	out := make([]string, 0, len(pairs))
	for _, item := range pairs {
		out = append(out, item.id)
	}
	return out
}

func getValue(data map[string]any, keyPath string) (any, bool) {
	parts := strings.Split(keyPath, ".")
	var current any = data
	for _, part := range parts {
		m, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		current, ok = m[part]
		if !ok {
			return nil, false
		}
	}
	return current, true
}

func issueToProtocolRange(r *scan.Range) protocol.Range {
	if r == nil || r.StartLine <= 0 {
		return protocol.Range{
			Start: protocol.Position{Line: 0, Character: 0},
			End:   protocol.Position{Line: 0, Character: 0},
		}
	}
	return protocol.Range{
		Start: protocol.Position{Line: clampToUint32(r.StartLine - 1), Character: clampToUint32(r.StartCol - 1)},
		End:   protocol.Position{Line: clampToUint32(r.EndLine - 1), Character: clampToUint32(r.EndCol - 1)},
	}
}

func severityToProtocolSeverity(s audit.Severity) *protocol.DiagnosticSeverity {
	var sev protocol.DiagnosticSeverity
	switch s {
	case audit.SeverityError:
		sev = protocol.DiagnosticSeverityError
	case audit.SeverityWarning:
		sev = protocol.DiagnosticSeverityWarning
	case audit.SeverityInfo:
		sev = protocol.DiagnosticSeverityInformation
	default:
		sev = protocol.DiagnosticSeverityHint
	}
	return &sev
}

// urlToPath converts a file URI to a filesystem path.
// It supports file:// scheme with localhost or empty host.
// It handles percent-encoded characters and platform-specific path formats.
// Non-file URIs are returned as-is for fallback handling.
func urlToPath(uri string) (string, error) {
	if !strings.HasPrefix(uri, "file://") {
		return uri, nil
	}
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}

	if parsed.Scheme != "file" {
		return uri, nil
	}

	path := parsed.EscapedPath()
	if path == "" {
		path = parsed.Path
	}

	if parsed.Host != "" && parsed.Host != "localhost" {
		// UNC path or non-localhost authority
		path = "//" + parsed.Host + path
	}

	path, err = url.PathUnescape(path)
	if err != nil {
		return "", fmt.Errorf("invalid percent encoding: %w", err)
	}

	if runtime.GOOS == "windows" && len(path) >= 3 && path[0] == '/' && path[2] == ':' {
		path = path[1:]
	}

	return filepath.Clean(filepath.FromSlash(path)), nil
}

// pathToURL converts a filesystem path to a file URI.
func pathToURL(path string) string {
	path = filepath.Clean(path)
	if runtime.GOOS == "windows" {
		if len(path) >= 2 && path[1] == ':' {
			// Local drive path: file:///C:/path/to/file
			return "file:///" + filepath.ToSlash(path)
		}
		if strings.HasPrefix(path, `\\`) {
			// UNC path: file://server/share/path
			return "file:" + filepath.ToSlash(path)
		}
	}
	// Unix path: file:///path/to/file
	return "file://" + filepath.ToSlash(path)
}

func clampToUint32(value int) uint32 {
	if value <= 0 {
		return 0
	}
	const maxUint32 = int(^uint32(0))
	if value > maxUint32 {
		// #nosec G115 -- value is clamped to uint32 range.
		return uint32(maxUint32)
	}
	// #nosec G115 -- value is clamped to uint32 range.
	return uint32(value)
}

func (s *Server) codeAction(_ *glsp.Context, params *protocol.CodeActionParams) (any, error) {
	if params == nil {
		return nil, nil
	}
	if len(params.Context.Diagnostics) == 0 {
		return nil, nil
	}

	if len(params.Context.Only) > 0 {
		allowed := false
		for _, kind := range params.Context.Only {
			if kind == protocol.CodeActionKindQuickFix || kind == protocol.CodeActionKindEmpty {
				allowed = true
				break
			}
		}
		if !allowed {
			return nil, nil
		}
	}

	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return nil, err
	}
	data, err := afero.ReadFile(s.fs, path)
	if err != nil {
		return nil, nil
	}
	content := string(data)

	req := codeActionRequest{
		uri:      params.TextDocument.URI,
		path:     path,
		content:  content,
		settings: s.currentSettings(),
	}

	var entries []codeActionEntry
	for _, diag := range params.Context.Diagnostics {
		entries = append(entries, s.codeActionsForDiagnostic(diag, req)...)
	}

	if len(entries) == 0 {
		return nil, nil
	}

	sortCodeActionEntries(entries)
	actions := make([]protocol.CodeAction, len(entries))
	for i, entry := range entries {
		actions[i] = entry.action
	}
	return actions, nil
}

func hasGitignoreEntry(content string, entry string) bool {
	if entry == "" {
		return true
	}
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == entry {
			return true
		}
		if strings.TrimSpace(line) == "!/"+strings.TrimPrefix(entry, "!") {
			return true
		}
	}
	return false
}

func repoRootForPath(root string, path string) string {
	if root != "" {
		return filepath.Clean(root)
	}
	return filepath.Dir(path)
}

func userRootForPath(path string) (string, bool) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", false
	}
	for _, root := range scan.DefaultUserRoots() {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		root = expandHomePath(root)
		absRoot, err := filepath.Abs(root)
		if err != nil {
			continue
		}
		absRoot = filepath.Clean(absRoot)
		if pathWithinRoot(absRoot, absPath) {
			return absRoot, true
		}
	}
	return "", false
}

func pathWithinRoot(root string, path string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	if rel == "." {
		return true
	}
	return !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && rel != ".."
}

func relativeRepoPath(repoRoot string, path string) (string, bool) {
	if repoRoot == "" || path == "" {
		return "", false
	}
	rel, err := filepath.Rel(repoRoot, path)
	if err != nil {
		return "", false
	}
	if strings.HasPrefix(rel, "..") {
		return "", false
	}
	rel = filepath.ToSlash(rel)
	rel = strings.TrimPrefix(rel, "./")
	return rel, rel != ""
}

func expandHomePath(path string) string {
	if path == "" {
		return path
	}
	if path[0] != '~' {
		return path
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return path
	}
	if path == "~" {
		return home
	}
	if len(path) > 1 && (path[1] == '/' || path[1] == '\\') {
		return filepath.Join(home, path[2:])
	}
	return path
}

func isGlobPath(path string) bool {
	return strings.ContainsAny(path, "*?[")
}

func stubContentForPath(path string) string {
	lower := strings.ToLower(path)
	switch strings.ToLower(filepath.Ext(lower)) {
	case ".md", ".markdown", ".mdx":
		return "# Instructions\n"
	case ".json":
		return "{\n}\n"
	case ".yml", ".yaml", ".toml":
		return "# TODO: add instructions\n"
	case ".txt":
		return "TODO: add instructions\n"
	default:
		if strings.HasSuffix(lower, ".prompt.md") || strings.HasSuffix(lower, ".instructions.md") {
			return "# Instructions\n"
		}
		return ""
	}
}

func endPositionForContent(content string) protocol.Position {
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		return protocol.Position{Line: 0, Character: 0}
	}
	line := len(lines) - 1
	return protocol.Position{Line: clampToUint32(line), Character: utf16Len(lines[line])}
}

func boolPtr(value bool) *bool {
	return &value
}

func pathToURI(path string) string {
	if path == "" {
		return ""
	}
	abs := path
	if !filepath.IsAbs(abs) {
		if resolved, err := filepath.Abs(abs); err == nil {
			abs = resolved
		}
	}
	abs = filepath.Clean(abs)
	filePath := filepath.ToSlash(abs)
	if runtime.GOOS == "windows" && !strings.HasPrefix(filePath, "/") {
		filePath = "/" + filePath
	}
	return (&url.URL{Scheme: "file", Path: filePath}).String()
}

func frontmatterBlockRange(content string) *protocol.Range {
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		return nil
	}
	if strings.TrimSpace(strings.TrimRight(lines[0], "\r")) != "---" {
		return nil
	}

	endLine := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(strings.TrimRight(lines[i], "\r")) == "---" {
			endLine = i
			break
		}
	}
	if endLine == -1 {
		return nil
	}

	end := endLine
	endChar := utf16Len(lines[endLine])
	if endLine+1 < len(lines) {
		end = endLine + 1
		endChar = 0
	}

	return &protocol.Range{
		Start: protocol.Position{Line: 0, Character: 0},
		End:   protocol.Position{Line: clampToUint32(end), Character: endChar},
	}
}

func lineTextAt(content string, line int) (string, bool) {
	lines := strings.Split(content, "\n")
	if line < 0 || line >= len(lines) {
		return "", false
	}
	return strings.TrimRight(lines[line], "\r"), true
}

func lineDeleteRange(content string, line int) *protocol.Range {
	lines := strings.Split(content, "\n")
	if line < 0 || line >= len(lines) {
		return nil
	}
	if line+1 < len(lines) {
		return &protocol.Range{
			Start: protocol.Position{Line: clampToUint32(line), Character: 0},
			End:   protocol.Position{Line: clampToUint32(line + 1), Character: 0},
		}
	}
	text := strings.TrimRight(lines[line], "\r")
	return &protocol.Range{
		Start: protocol.Position{Line: clampToUint32(line), Character: 0},
		End:   protocol.Position{Line: clampToUint32(line), Character: utf16Len(text)},
	}
}

func decodeContentChange(change any) (protocol.TextDocumentContentChangeEvent, bool) {
	switch typed := change.(type) {
	case protocol.TextDocumentContentChangeEvent:
		return typed, true
	case protocol.TextDocumentContentChangeEventWhole:
		return protocol.TextDocumentContentChangeEvent{Text: typed.Text}, true
	case *protocol.TextDocumentContentChangeEvent:
		if typed == nil {
			return protocol.TextDocumentContentChangeEvent{}, false
		}
		return *typed, true
	case *protocol.TextDocumentContentChangeEventWhole:
		if typed == nil {
			return protocol.TextDocumentContentChangeEvent{}, false
		}
		return protocol.TextDocumentContentChangeEvent{Text: typed.Text}, true
	case map[string]any:
		var event protocol.TextDocumentContentChangeEvent
		if text, ok := typed["text"].(string); ok {
			event.Text = text
		}
		if rangeValue, ok := typed["range"]; ok {
			if rng, ok := rangeFromAny(rangeValue); ok {
				event.Range = &rng
			}
		}
		return event, true
	default:
		return protocol.TextDocumentContentChangeEvent{}, false
	}
}

func rangeFromAny(value any) (protocol.Range, bool) {
	typed, ok := value.(map[string]any)
	if !ok {
		return protocol.Range{}, false
	}
	start, ok := positionFromAny(typed["start"])
	if !ok {
		return protocol.Range{}, false
	}
	end, ok := positionFromAny(typed["end"])
	if !ok {
		return protocol.Range{}, false
	}
	return protocol.Range{Start: start, End: end}, true
}

func positionFromAny(value any) (protocol.Position, bool) {
	typed, ok := value.(map[string]any)
	if !ok {
		return protocol.Position{}, false
	}
	line, ok := toUint32(typed["line"])
	if !ok {
		return protocol.Position{}, false
	}
	character, ok := toUint32(typed["character"])
	if !ok {
		return protocol.Position{}, false
	}
	return protocol.Position{Line: line, Character: character}, true
}

func toUint32(value any) (uint32, bool) {
	const maxUint32 = uint64(^uint32(0))
	switch typed := value.(type) {
	case int:
		if typed < 0 {
			return 0, false
		}
		if uint64(typed) > maxUint32 {
			return 0, false
		}
		// #nosec G115 -- bounded by maxUint32 check above.
		return uint32(typed), true
	case int32:
		if typed < 0 {
			return 0, false
		}
		return uint32(typed), true
	case int64:
		if typed < 0 {
			return 0, false
		}
		if uint64(typed) > maxUint32 {
			return 0, false
		}
		// #nosec G115 -- bounded by maxUint32 check above.
		return uint32(typed), true
	case uint32:
		return typed, true
	case uint64:
		if typed > maxUint32 {
			return 0, false
		}
		return uint32(typed), true
	case float64:
		if typed < 0 {
			return 0, false
		}
		if typed > float64(maxUint32) {
			return 0, false
		}
		return uint32(typed), true
	default:
		return 0, false
	}
}

func applyContentChange(content string, change protocol.TextDocumentContentChangeEvent) (string, bool) {
	if change.Range == nil {
		return change.Text, true
	}
	start := offsetForPosition(content, change.Range.Start)
	end := offsetForPosition(content, change.Range.End)
	if start < 0 || end < 0 || start > end {
		return content, false
	}
	if start > len(content) || end > len(content) {
		return content, false
	}
	return content[:start] + change.Text + content[end:], true
}

func offsetForPosition(content string, pos protocol.Position) int {
	targetLine := int(pos.Line)
	targetCol := int(pos.Character)
	if targetLine < 0 || targetCol < 0 {
		return 0
	}

	line := 0
	col := 0
	offset := 0
	for _, r := range content {
		if line == targetLine && col >= targetCol {
			return offset
		}
		if r == '\n' {
			if line == targetLine {
				return offset
			}
			line++
			col = 0
			offset += utf8.RuneLen(r)
			continue
		}
		colWidth := utf16.RuneLen(r)
		if colWidth < 0 {
			colWidth = 1
		}
		col += colWidth
		offset += utf8.RuneLen(r)
		if line == targetLine && col >= targetCol {
			return offset
		}
	}
	return len(content)
}

func utf16Len(value string) uint32 {
	if value == "" {
		return 0
	}
	return clampToUint32(len(utf16.Encode([]rune(value))))
}

// RunServer runs the LSP server with the given tool version.
func RunServer(v string) error {
	commonlog.Configure(1, nil)
	s := NewServer(v)
	return s.Run()
}
