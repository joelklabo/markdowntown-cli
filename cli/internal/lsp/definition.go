package lsp

import (
	"bytes"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"markdowntown-cli/internal/scan"

	protocol "github.com/tliron/glsp/protocol_3_16"
)

func registryDefinitionLocation(toolID string) (*protocol.Location, error) {
	toolID = strings.TrimSpace(toolID)
	if toolID == "" {
		return nil, nil
	}

	matchID, path, err := registryPathForToolID(toolID)
	if err != nil || matchID == "" || path == "" {
		return nil, err
	}

	data, err := scan.ReadRegistryFile(path)
	if err != nil {
		return nil, err
	}

	rng := findToolIDRangeInRegistryJSON(data, matchID)
	if rng == nil {
		return nil, nil
	}

	return &protocol.Location{
		URI:   pathToURL(path),
		Range: *rng,
	}, nil
}

func registryPathForToolID(toolID string) (string, string, error) {
	customReg, customPath, err := scan.LoadCustomPatterns()
	if err == nil {
		if match := findToolIDInRegistry(customReg, toolID); match != "" {
			return match, customPath, nil
		}
	}

	path, err := scan.ResolveRegistryPath()
	if err != nil {
		if errors.Is(err, scan.ErrRegistryNotFound) || errors.Is(err, scan.ErrRegistryPathMissing) {
			return "", "", nil
		}
		return "", "", err
	}

	reg, err := loadRegistryAtPath(path)
	if err != nil {
		return "", "", err
	}

	if match := findToolIDInRegistry(reg, toolID); match != "" {
		return match, path, nil
	}

	return "", "", nil
}

func loadRegistryAtPath(path string) (scan.Registry, error) {
	data, err := scan.ReadRegistryFile(path)
	if err != nil {
		return scan.Registry{}, err
	}
	var reg scan.Registry
	if err := json.Unmarshal(data, &reg); err != nil {
		return scan.Registry{}, err
	}
	return reg, nil
}

func findToolIDInRegistry(reg scan.Registry, toolID string) string {
	for _, pattern := range reg.Patterns {
		if pattern.ToolID == "" {
			continue
		}
		if strings.EqualFold(pattern.ToolID, toolID) {
			return pattern.ToolID
		}
	}
	return ""
}

func findToolIDRangeInRegistryJSON(content []byte, toolID string) *protocol.Range {
	if len(content) == 0 || toolID == "" {
		return nil
	}

	needle := []byte(`"toolId"`)
	for offset := 0; offset < len(content); {
		idx := bytes.Index(content[offset:], needle)
		if idx == -1 {
			return nil
		}
		idx += offset
		pos := idx + len(needle)
		pos = skipWhitespace(content, pos)
		if pos >= len(content) || content[pos] != ':' {
			offset = idx + len(needle)
			continue
		}
		pos++
		pos = skipWhitespace(content, pos)
		if pos >= len(content) || content[pos] != '"' {
			offset = pos
			continue
		}
		valueStart := pos + 1
		value, valueEnd, ok := parseJSONString(content, valueStart)
		if !ok {
			offset = pos + 1
			continue
		}
		if strings.EqualFold(value, toolID) {
			start := positionForOffset(content, valueStart)
			end := positionForOffset(content, valueEnd)
			return &protocol.Range{Start: start, End: end}
		}
		offset = valueEnd + 1
	}
	return nil
}

func skipWhitespace(content []byte, pos int) int {
	for pos < len(content) {
		switch content[pos] {
		case ' ', '\n', '\r', '\t':
			pos++
		default:
			return pos
		}
	}
	return pos
}

func parseJSONString(content []byte, start int) (string, int, bool) {
	if start < 0 || start >= len(content) {
		return "", start, false
	}
	for i := start; i < len(content); i++ {
		switch content[i] {
		case '\\':
			if i+1 < len(content) {
				i++
			}
		case '"':
			raw := string(content[start-1 : i+1])
			value, err := strconv.Unquote(raw)
			if err != nil {
				return "", i + 1, false
			}
			return value, i, true
		}
	}
	return "", len(content), false
}

func positionForOffset(content []byte, offset int) protocol.Position {
	if offset < 0 {
		offset = 0
	}
	if offset > len(content) {
		offset = len(content)
	}

	line := 0
	col := 0
	for i := 0; i < offset; {
		b := content[i]
		if b == '\n' {
			line++
			col = 0
			i++
			continue
		}
		if b == '\r' {
			if i+1 < offset && content[i+1] == '\n' {
				i++
			}
			line++
			col = 0
			i++
			continue
		}
		r, size := utf8.DecodeRune(content[i:])
		if r == utf8.RuneError && size == 1 {
			col++
			i++
			continue
		}
		width := utf16.RuneLen(r)
		if width < 0 {
			width = 1
		}
		col += width
		i += size
	}

	return protocol.Position{Line: clampToUint32(line), Character: clampToUint32(col)}
}
