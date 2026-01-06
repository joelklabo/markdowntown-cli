import json
import sys
import os

def update_issue(issue_id, status=None, close_reason=None):
    filepath = '.beads/issues.jsonl'
    temp_filepath = filepath + '.tmp'
    
    updated = False
    with open(filepath, 'r') as f_in, open(temp_filepath, 'w') as f_out:
        for line in f_in:
            if line.strip():
                try:
                    issue = json.loads(line)
                    if issue['id'] == issue_id:
                        if status:
                            issue['status'] = status
                        if close_reason:
                            issue['close_reason'] = close_reason
                        updated = True
                    f_out.write(json.dumps(issue) + '\n')
                except json.JSONDecodeError:
                    f_out.write(line)
            else:
                f_out.write(line)
    
    if updated:
        os.rename(temp_filepath, filepath)
        print(f"Updated {issue_id}")
    else:
        os.remove(temp_filepath)
        print(f"Issue {issue_id} not found")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 update_issue.py <id> <status> [close_reason]")
        sys.exit(1)
    
    issue_id = sys.argv[1]
    status = sys.argv[2]
    close_reason = sys.argv[3] if len(sys.argv) > 3 else None
    
    update_issue(issue_id, status, close_reason)
