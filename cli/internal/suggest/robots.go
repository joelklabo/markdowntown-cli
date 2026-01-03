package suggest

import (
	"bufio"
	"bytes"
	"strings"
)

// RobotsTxt captures parsed robots.txt groups and sitemaps.
type RobotsTxt struct {
	Groups   []RobotsGroup
	Sitemaps []string
}

// RobotsGroup stores a single user-agent group.
type RobotsGroup struct {
	Agents []string
	Rules  []RobotsRule
}

// RobotsRule is an allow or disallow directive.
type RobotsRule struct {
	Path  string
	Allow bool
}

// RobotsRules contains allow/disallow patterns for evaluation.
type RobotsRules struct {
	Allow    []string
	Disallow []string
}

// ParseRobots parses robots.txt content.
func ParseRobots(data []byte) RobotsTxt {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	var groups []RobotsGroup
	var current *RobotsGroup
	var sitemaps []string

	resetGroup := func() {
		if current == nil {
			current = &RobotsGroup{}
			return
		}
		if len(current.Agents) > 0 || len(current.Rules) > 0 {
			groups = append(groups, *current)
		}
		current = &RobotsGroup{}
	}

	resetGroup()

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			if current != nil && (len(current.Agents) > 0 || len(current.Rules) > 0) {
				groups = append(groups, *current)
				current = &RobotsGroup{}
			}
			continue
		}
		if idx := strings.Index(line, "#"); idx >= 0 {
			line = strings.TrimSpace(line[:idx])
			if line == "" {
				continue
			}
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(parts[0]))
		value := strings.TrimSpace(parts[1])

		switch key {
		case "user-agent":
			if current == nil {
				current = &RobotsGroup{}
			}
			current.Agents = append(current.Agents, strings.ToLower(value))
		case "allow":
			if current == nil {
				current = &RobotsGroup{}
			}
			if value == "" {
				continue
			}
			current.Rules = append(current.Rules, RobotsRule{Path: value, Allow: true})
		case "disallow":
			if current == nil {
				current = &RobotsGroup{}
			}
			if value == "" {
				continue
			}
			current.Rules = append(current.Rules, RobotsRule{Path: value, Allow: false})
		case "sitemap":
			if value != "" {
				sitemaps = append(sitemaps, value)
			}
		}
	}

	if current != nil && (len(current.Agents) > 0 || len(current.Rules) > 0) {
		groups = append(groups, *current)
	}

	return RobotsTxt{Groups: groups, Sitemaps: sitemaps}
}

// RulesFor returns the best matching rules for the user agent.
func (r RobotsTxt) RulesFor(userAgent string) RobotsRules {
	agent := strings.ToLower(userAgent)
	var selected *RobotsGroup
	var selectedLen int

	for i := range r.Groups {
		group := r.Groups[i]
		for _, token := range group.Agents {
			if token == "" {
				continue
			}
			if token == "*" || strings.Contains(agent, token) {
				if len(token) > selectedLen {
					selected = &group
					selectedLen = len(token)
				}
			}
		}
	}

	if selected == nil {
		return RobotsRules{}
	}

	var rules RobotsRules
	for _, rule := range selected.Rules {
		if rule.Allow {
			rules.Allow = append(rules.Allow, rule.Path)
		} else {
			rules.Disallow = append(rules.Disallow, rule.Path)
		}
	}
	return rules
}

// Allows reports whether a path is permitted by the rules.
func (r RobotsRules) Allows(path string) bool {
	if path == "" {
		path = "/"
	}

	allowLen := -1
	disallowLen := -1

	for _, rule := range r.Allow {
		if strings.HasPrefix(path, rule) {
			if len(rule) > allowLen {
				allowLen = len(rule)
			}
		}
	}

	for _, rule := range r.Disallow {
		if strings.HasPrefix(path, rule) {
			if len(rule) > disallowLen {
				disallowLen = len(rule)
			}
		}
	}

	if allowLen == -1 && disallowLen == -1 {
		return true
	}

	if allowLen >= disallowLen {
		return true
	}

	return false
}
