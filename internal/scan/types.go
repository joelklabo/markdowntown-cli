package scan

type Registry struct {
	Version  string    `json:"version"`
	Patterns []Pattern `json:"patterns"`
}

type Pattern struct {
	ID               string        `json:"id"`
	ToolID           string        `json:"toolId"`
	ToolName         string        `json:"toolName"`
	Kind             string        `json:"kind"`
	Scope            string        `json:"scope"`
	Paths            []string      `json:"paths"`
	Type             string        `json:"type"`
	LoadBehavior     string        `json:"loadBehavior"`
	Application      string        `json:"application"`
	ApplicationField string        `json:"applicationField,omitempty"`
	Notes            string        `json:"notes,omitempty"`
	Hints            []PatternHint `json:"hints,omitempty"`
	Docs             []string      `json:"docs"`
}

type PatternHint struct {
	Type    string `json:"type"`
	Setting string `json:"setting,omitempty"`
}

type ScanOutput struct {
	SchemaVersion   string        `json:"schemaVersion"`
	RegistryVersion string        `json:"registryVersion"`
	ToolVersion     string        `json:"toolVersion"`
	ScanStartedAt   int64         `json:"scanStartedAt"`
	GeneratedAt     int64         `json:"generatedAt"`
	Timing          Timing        `json:"timing"`
	RepoRoot        string        `json:"repoRoot"`
	Scans           []ScanRoot    `json:"scans"`
	Configs         []ConfigEntry `json:"configs"`
	Warnings        []Warning     `json:"warnings"`
}

type Timing struct {
	DiscoveryMs int64 `json:"discoveryMs"`
	HashingMs   int64 `json:"hashingMs"`
	GitignoreMs int64 `json:"gitignoreMs"`
	TotalMs     int64 `json:"totalMs"`
}

type ScanRoot struct {
	Scope  string `json:"scope"`
	Root   string `json:"root"`
	Exists bool   `json:"exists"`
}

type ConfigEntry struct {
	Path             string         `json:"path"`
	Scope            string         `json:"scope"`
	Depth            int            `json:"depth"`
	SizeBytes        *int64         `json:"sizeBytes"`
	Sha256           *string        `json:"sha256"`
	Mtime            int64          `json:"mtime"`
	Gitignored       bool           `json:"gitignored"`
	Frontmatter      map[string]any `json:"frontmatter"`
	FrontmatterError *string        `json:"frontmatterError"`
	Content          *string        `json:"content"`
	ContentSkipped   *string        `json:"contentSkipped"`
	Error            *string        `json:"error"`
	Warning          *string        `json:"warning"`
	Tools            []ToolEntry    `json:"tools"`
}

type ToolEntry struct {
	ToolID         string        `json:"toolId"`
	ToolName       string        `json:"toolName"`
	Kind           string        `json:"kind"`
	LoadBehavior   string        `json:"loadBehavior"`
	Application    string        `json:"application"`
	MatchedPattern string        `json:"matchedPattern"`
	Notes          string        `json:"notes"`
	Hints          []PatternHint `json:"hints"`
}

type Warning struct {
	Path    string `json:"path"`
	Code    string `json:"code"`
	Message string `json:"message"`
}
