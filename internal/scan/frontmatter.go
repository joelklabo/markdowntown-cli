// Package scan provides registry loading and file matching helpers.
package scan

import (
	"bufio"
	"bytes"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// Range represents a text range in a file.
type Range struct {
	StartLine int `json:"startLine"`
	StartCol  int `json:"startCol"`
	EndLine   int `json:"endLine"`
	EndCol    int `json:"endCol"`
}

// NodeRange is an alias for Range for backward compatibility if needed,
// though we'll prefer Range.
type NodeRange = Range

// ParsedFrontmatter contains the frontmatter data and its locations.
type ParsedFrontmatter struct {
	Data      map[string]any   `json:"data"`
	Locations map[string]Range `json:"locations"` // Key locations
	Values    map[string]Range `json:"values"`    // Value locations
}

// ParseFrontmatter extracts YAML frontmatter between --- delimiters.
func ParseFrontmatter(content []byte) (*ParsedFrontmatter, bool, error) {
	scanner := bufio.NewScanner(bytes.NewReader(content))
	if !scanner.Scan() {
		return nil, false, nil
	}

	first := strings.TrimSpace(strings.TrimRight(scanner.Text(), "\r"))
	if first != "---" {
		return nil, false, nil
	}

	var lines []string
	startLine := 1 // delimiter is at line 1
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r")
		if strings.TrimSpace(line) == "---" {
			yamlText := strings.Join(lines, "\n")
			if strings.TrimSpace(yamlText) == "" {
				return &ParsedFrontmatter{
						Data:      map[string]any{},
						Locations: map[string]Range{},
						Values:    map[string]Range{},
					},
					true, nil
			}

			var node yaml.Node
			if err := yaml.Unmarshal([]byte(yamlText), &node); err != nil {
				return nil, true, err
			}

			parsed := &ParsedFrontmatter{
				Data:      make(map[string]any),
				Locations: make(map[string]Range),
				Values:    make(map[string]Range),
			}

			if len(node.Content) > 0 {
				walkYAMLNode(node.Content[0], "", parsed, startLine)
				// Re-unmarshal to get the flattened data map
				if err := yaml.Unmarshal([]byte(yamlText), &parsed.Data); err != nil {
					return nil, true, err
				}
			}

			return parsed, true, nil
		}
		lines = append(lines, line)
	}

	if err := scanner.Err(); err != nil {
		return nil, true, err
	}

	return nil, true, fmt.Errorf("frontmatter delimiter not closed")
}

func walkYAMLNode(node *yaml.Node, prefix string, parsed *ParsedFrontmatter, offset int) {
	switch node.Kind {
	case yaml.MappingNode:
		for i := 0; i < len(node.Content); i += 2 {
			keyNode := node.Content[i]
			valNode := node.Content[i+1]

			key := keyNode.Value
			fullKey := key
			if prefix != "" {
				fullKey = prefix + "." + key
			}

			parsed.Locations[fullKey] = Range{
				StartLine: keyNode.Line + offset,
				StartCol:  keyNode.Column,
				EndLine:   keyNode.Line + offset,
				EndCol:    keyNode.Column + len(keyNode.Value),
			}

			if valNode.Kind == yaml.ScalarNode {
				parsed.Values[fullKey] = Range{
					StartLine: valNode.Line + offset,
					StartCol:  valNode.Column,
					EndLine:   valNode.Line + offset,
					EndCol:    valNode.Column + len(valNode.Value),
				}
			}

			walkYAMLNode(valNode, fullKey, parsed, offset)
		}
	case yaml.SequenceNode:
		for i, itemNode := range node.Content {
			key := fmt.Sprintf("%s[%d]", prefix, i)
			if itemNode.Kind == yaml.ScalarNode {
				parsed.Values[key] = Range{
					StartLine: itemNode.Line + offset,
					StartCol:  itemNode.Column,
					EndLine:   itemNode.Line + offset,
					EndCol:    itemNode.Column + len(itemNode.Value),
				}
			}
			walkYAMLNode(itemNode, key, parsed, offset)
		}
	}
}
