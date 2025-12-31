package suggest

import (
	"bufio"
	"errors"
	"html"
	"regexp"
	"strings"
)

// NormalizedDocument represents a normalized document split into sections.
type NormalizedDocument struct {
	Sections []Section
}

// Section describes a normalized section with stable anchor and spans.
type Section struct {
	ID      string
	Heading string
	Level   int
	Content string
	Spans   []Span
}

// Span captures byte offsets within section content.
type Span struct {
	Start int
	End   int
}

var (
	headingRE = regexp.MustCompile(`^(#{1,6})\s+(.+)$`)
	tagRE     = regexp.MustCompile(`(?s)<[^>]+>`)
)

// NormalizeDocument normalizes HTML or Markdown content into sections.
func NormalizeDocument(input, format string) (NormalizedDocument, error) {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "markdown", "md", "":
		return normalizeMarkdown(input), nil
	case "html", "htm":
		return normalizeMarkdown(htmlToMarkdown(input)), nil
	default:
		return NormalizedDocument{}, errors.New("unsupported format")
	}
}

func normalizeMarkdown(input string) NormalizedDocument {
	scanner := bufio.NewScanner(strings.NewReader(input))
	var sections []Section
	current := Section{ID: "intro"}
	var contentLines []string
	inFence := false

	flush := func() {
		content := strings.TrimSpace(strings.Join(contentLines, "\n"))
		if content != "" {
			current.Content = content
			current.Spans = []Span{{Start: 0, End: len(content)}}
		}
		if current.Heading != "" || current.Content != "" {
			sections = append(sections, current)
		}
		current = Section{}
		contentLines = nil
	}

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") {
			inFence = !inFence
			contentLines = append(contentLines, line)
			continue
		}
		if !inFence {
			if match := headingRE.FindStringSubmatch(line); match != nil {
				flush()
				level := len(match[1])
				heading := strings.TrimSpace(match[2])
				current = Section{Heading: heading, Level: level}
				current.ID = slugify(heading)
				if current.ID == "" {
					current.ID = "section"
				}
				continue
			}
		}
		contentLines = append(contentLines, line)
	}

	flush()
	return NormalizedDocument{Sections: sections}
}

func htmlToMarkdown(input string) string {
	replacements := []struct {
		pattern *regexp.Regexp
		replace string
	}{
		{regexp.MustCompile(`(?i)<h1[^>]*>`), "\n# "},
		{regexp.MustCompile(`(?i)</h1>`), "\n"},
		{regexp.MustCompile(`(?i)<h2[^>]*>`), "\n## "},
		{regexp.MustCompile(`(?i)</h2>`), "\n"},
		{regexp.MustCompile(`(?i)<h3[^>]*>`), "\n### "},
		{regexp.MustCompile(`(?i)</h3>`), "\n"},
		{regexp.MustCompile(`(?i)<h4[^>]*>`), "\n#### "},
		{regexp.MustCompile(`(?i)</h4>`), "\n"},
		{regexp.MustCompile(`(?i)<h5[^>]*>`), "\n##### "},
		{regexp.MustCompile(`(?i)</h5>`), "\n"},
		{regexp.MustCompile(`(?i)<h6[^>]*>`), "\n###### "},
		{regexp.MustCompile(`(?i)</h6>`), "\n"},
		{regexp.MustCompile(`(?i)<p[^>]*>`), "\n"},
		{regexp.MustCompile(`(?i)</p>`), "\n"},
		{regexp.MustCompile(`(?i)<br\s*/?>`), "\n"},
	}

	out := input
	for _, repl := range replacements {
		out = repl.pattern.ReplaceAllString(out, repl.replace)
	}

	out = tagRE.ReplaceAllString(out, "")
	out = html.UnescapeString(out)
	return out
}

func slugify(value string) string {
	lower := strings.ToLower(value)
	var out []rune
	lastHyphen := false
	for _, r := range lower {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			out = append(out, r)
			lastHyphen = false
			continue
		}
		if !lastHyphen {
			out = append(out, '-')
			lastHyphen = true
		}
	}
	result := strings.Trim(string(out), "-")
	return result
}
