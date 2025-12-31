// Package scan provides registry loading and file matching helpers.
package scan

import (
	"bufio"
	"bytes"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// ParseFrontmatter extracts YAML frontmatter between --- delimiters.
func ParseFrontmatter(content []byte) (map[string]any, bool, error) {
	scanner := bufio.NewScanner(bytes.NewReader(content))
	if !scanner.Scan() {
		return nil, false, nil
	}

	first := strings.TrimSpace(strings.TrimRight(scanner.Text(), "\r"))
	if first != "---" {
		return nil, false, nil
	}

	var lines []string
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r")
		if strings.TrimSpace(line) == "---" {
			yamlText := strings.Join(lines, "\n")
			if strings.TrimSpace(yamlText) == "" {
				return map[string]any{}, true, nil
			}
			var frontmatter map[string]any
			if err := yaml.Unmarshal([]byte(yamlText), &frontmatter); err != nil {
				return nil, true, err
			}
			if frontmatter == nil {
				frontmatter = map[string]any{}
			}
			return frontmatter, true, nil
		}
		lines = append(lines, line)
	}

	if err := scanner.Err(); err != nil {
		return nil, true, err
	}

	return nil, true, fmt.Errorf("frontmatter delimiter not closed")
}
