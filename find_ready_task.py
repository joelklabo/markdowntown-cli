import json
import sys

def load_issues(filepath):
    issues = {}
    with open(filepath, 'r') as f:
        for line in f:
            if line.strip():
                try:
                    issue = json.loads(line)
                    issues[issue['id']] = issue
                except json.JSONDecodeError:
                    continue
    return issues

def is_blocked(issue, issues):
    issue_id = issue['id']
    
    # 1. Check for explicit blocks from other issues
    for other_id, other in issues.items():
        if other['status'] == 'closed':
            continue
        
        if 'dependencies' in other:
            for dep in other['dependencies']:
                # If other blocks current issue
                if dep['issue_id'] == other_id and dep['depends_on_id'] == issue_id and dep['type'] == 'blocks':
                    return True
                # If other is child of current issue (parent-child)
                if dep['issue_id'] == other_id and dep['depends_on_id'] == issue_id and dep['type'] == 'parent-child':
                    return True
    
    # 2. Check for dependencies on this issue pointing to others?
    # Usually dependencies are outgoing. "I depend on X".
    # {issue_id: ME, depends_on_id: X, type: blocks} -> I am blocked by X.
    # We should check this too!
    if 'dependencies' in issue:
        for dep in issue['dependencies']:
             if dep['issue_id'] == issue_id and dep['type'] == 'blocks':
                 target_id = dep['depends_on_id']
                 if target_id in issues and issues[target_id]['status'] != 'closed':
                     return True
    
    return False

def main():
    filepath = '.beads/issues.jsonl'
    try:
        issues = load_issues(filepath)
    except FileNotFoundError:
        print("Error: .beads/issues.jsonl not found")
        sys.exit(1)

    ready_issues = []
    in_progress_issues = []
    
    # Collect all valid statuses for debugging
    seen_statuses = set()

    for iid, issue in issues.items():
        status = issue.get('status', 'unknown')
        seen_statuses.add(status)
        
        if status == 'in_progress':
            in_progress_issues.append(issue)
        elif status not in ['closed', 'done', 'cancelled', '--status']:
             # Check if blocked
             if not is_blocked(issue, issues):
                 ready_issues.append(issue)

    # print(f"DEBUG: Found statuses: {seen_statuses}", file=sys.stderr)

    if in_progress_issues:
        # If there are in_progress tasks, pick the first one (or highest priority)
        in_progress_issues.sort(key=lambda x: (x.get('priority', 99), x['id']))
        print(json.dumps(in_progress_issues[0]))
        return

    # Sort by priority (asc) then id
    ready_issues.sort(key=lambda x: (x.get('priority', 99), x['id']))
    
    # Print top 5 for debugging
    # for i, issue in enumerate(ready_issues[:5]):
    #     print(f"DEBUG: {i+1}. {issue['id']} [{issue.get('issue_type')}] P{issue.get('priority')} - {issue['title']}", file=sys.stderr)

    if ready_issues:
        # Check if the top one is an epic and if it has children
        top = ready_issues[0]
        # Find children
        children = []
        for iid, issue in issues.items():
            if 'dependencies' in issue:
                for dep in issue['dependencies']:
                    if dep['depends_on_id'] == top['id'] and dep['type'] == 'parent-child':
                        children.append(issue['id'])
        
        # print(f"DEBUG: Top issue {top['id']} has children: {children}", file=sys.stderr)
        
        print(json.dumps(top))
    else:
        print("{}")

if __name__ == "__main__":
    main()
