// Package engine provides shared rule execution helpers.
package engine

// Rule is the minimal interface required to execute a rule set.
type Rule[TContext any, TIssue any] interface {
	Evaluate(TContext) []TIssue
}

// Run executes rules in order and aggregates the results.
func Run[TContext any, TIssue any, TRule Rule[TContext, TIssue]](ctx TContext, rules []TRule) []TIssue {
	var issues []TIssue
	for _, rule := range rules {
		issues = append(issues, rule.Evaluate(ctx)...)
	}
	return issues
}
