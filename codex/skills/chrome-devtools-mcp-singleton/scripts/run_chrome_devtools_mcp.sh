#!/usr/bin/env bash
set -euo pipefail

CMD_DEFAULT="npx -y chrome-devtools-mcp@latest"
STATE_DIR_DEFAULT="/tmp/chrome-devtools-mcp-singleton"
KEEPALIVE_DEFAULT="1"

CMD="${CHROME_DEVTOOLS_MCP_CMD:-$CMD_DEFAULT}"
STATE_DIR="${CHROME_DEVTOOLS_MCP_STATE_DIR:-$STATE_DIR_DEFAULT}"
KEEPALIVE="${CHROME_DEVTOOLS_MCP_KEEPALIVE:-$KEEPALIVE_DEFAULT}"

PID_FILE="$STATE_DIR/pid"
LOG_FILE="$STATE_DIR/server.log"
ALT_LOG_FILE="$STATE_DIR/log"

usage() {
  cat <<EOF
Usage: $(basename "$0") <start|run|stop|status|dedupe> [-- <extra args>]

Environment:
  CHROME_DEVTOOLS_MCP_CMD        Command to start MCP (default: $CMD_DEFAULT)
  CHROME_DEVTOOLS_MCP_ARGS       Space-separated default args
  CHROME_DEVTOOLS_MCP_STATE_DIR  State dir (default: $STATE_DIR_DEFAULT)
  CHROME_DEVTOOLS_MCP_KEEPALIVE  Keep stdin open for stdio servers (default: $KEEPALIVE_DEFAULT)
EOF
}

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

read_default_args() {
  local -a args=()
  if [[ -n "${CHROME_DEVTOOLS_MCP_ARGS:-}" ]]; then
    # shellcheck disable=SC2206
    args=($CHROME_DEVTOOLS_MCP_ARGS)
  fi
  echo "${args[@]-}"
}

list_pids() {
  pgrep -f "chrome-devtools-mcp" || true
}

pid_is_running() {
  local pid="$1"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  kill -0 "$pid" 2>/dev/null
}

pid_matches_mcp() {
  local pid="$1"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  ps -p "$pid" -o command= 2>/dev/null | grep -q "chrome-devtools-mcp"
}

current_pid() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if pid_is_running "$pid" && pid_matches_mcp "$pid"; then
      echo "$pid"
      return 0
    fi
    clear_pid
  fi
  return 1
}

write_pid() {
  local pid="$1"
  echo "$pid" > "$PID_FILE"
}

clear_pid() {
  rm -f "$PID_FILE"
}

kill_pid_gracefully() {
  local pid="$1"
  if ! pid_is_running "$pid"; then
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  for _ in {1..10}; do
    if ! pid_is_running "$pid"; then
      return 0
    fi
    sleep 0.2
  done
  kill -9 "$pid" 2>/dev/null || true
}

dedupe() {
  ensure_state_dir
  local pid
  if pid="$(current_pid 2>/dev/null)"; then
    local all_pids
    all_pids="$(list_pids)"
    if [[ -n "$all_pids" ]]; then
      while read -r other; do
        if [[ -n "$other" && "$other" != "$pid" ]]; then
          kill_pid_gracefully "$other"
        fi
      done <<< "$all_pids"
    fi
    echo "Keeping PID $pid"
    return 0
  fi

  local all_pids
  all_pids="$(list_pids)"
  if [[ -z "$all_pids" ]]; then
    echo "INFO: No running chrome-devtools-mcp processes found"
    return 0
  fi

  local keep
  keep="$(echo "$all_pids" | head -n 1)"
  write_pid "$keep"
  while read -r other; do
    if [[ -n "$other" && "$other" != "$keep" ]]; then
      kill_pid_gracefully "$other"
    fi
  done <<< "$all_pids"
  echo "Keeping PID $keep"
}

start() {
  ensure_state_dir
  dedupe >/dev/null 2>&1 || true
  if pid="$(current_pid 2>/dev/null)"; then
    echo "chrome-devtools-mcp already running (PID $pid)"
    return 0
  fi

  local default_args
  default_args="$(read_default_args)"
  local -a default_args_array=()
  if [[ -n "$default_args" ]]; then
    # shellcheck disable=SC2206
    default_args_array=($default_args)
  fi
  local -a extra_args=()
  if [[ $# -gt 0 ]]; then
    extra_args=("$@")
  fi
  local -a cmd_args=()
  cmd_args=($CMD)
  set +u
  cmd_args+=("${default_args_array[@]}")
  cmd_args+=("${extra_args[@]}")
  set -u

  if [[ "$KEEPALIVE" == "1" ]]; then
    # Keep stdin open so the MCP server doesn't exit immediately.
    nohup bash -c 'tail -f /dev/null | "$@"' bash "${cmd_args[@]}" >"$LOG_FILE" 2>&1 &
  else
    nohup "${cmd_args[@]}" >"$LOG_FILE" 2>&1 &
  fi
  local pid=$!
  write_pid "$pid"

  sleep 0.5
  if pid_is_running "$pid"; then
    echo "Started chrome-devtools-mcp (PID $pid)"
    if [[ -f "$LOG_FILE" ]]; then
      echo "   Log: $LOG_FILE"
    elif [[ -f "$ALT_LOG_FILE" ]]; then
      echo "   Log: $ALT_LOG_FILE"
    else
      echo "   Log: $LOG_FILE"
    fi
  else
    echo "ERROR: Failed to start chrome-devtools-mcp"
    if [[ -f "$LOG_FILE" ]]; then
      echo "   Log: $LOG_FILE"
    elif [[ -f "$ALT_LOG_FILE" ]]; then
      echo "   Log: $ALT_LOG_FILE"
    else
      echo "   Log: $LOG_FILE"
    fi
    exit 1
  fi
}

run_foreground() {
  ensure_state_dir
  local default_args
  default_args="$(read_default_args)"
  local -a default_args_array=()
  if [[ -n "$default_args" ]]; then
    # shellcheck disable=SC2206
    default_args_array=($default_args)
  fi
  local -a extra_args=()
  if [[ $# -gt 0 ]]; then
    extra_args=("$@")
  fi
  local -a cmd_args=()
  cmd_args=($CMD)
  set +u
  cmd_args+=("${default_args_array[@]}")
  cmd_args+=("${extra_args[@]}")
  set -u

  if [[ "$KEEPALIVE" == "1" ]]; then
    # Keep stdin open for stdio JSON-RPC clients.
    exec "${cmd_args[@]}" < /dev/stdin
  else
    exec "${cmd_args[@]}"
  fi
}

status() {
  if pid="$(current_pid 2>/dev/null)"; then
    echo "chrome-devtools-mcp running (PID $pid)"
    if [[ -f "$LOG_FILE" ]]; then
      echo "   Log: $LOG_FILE"
    elif [[ -f "$ALT_LOG_FILE" ]]; then
      echo "   Log: $ALT_LOG_FILE"
    else
      echo "   Log: $LOG_FILE"
    fi
    return 0
  fi
  echo "ERROR: chrome-devtools-mcp not running"
  return 1
}

stop() {
  local pids
  pids=""
  if pid="$(current_pid 2>/dev/null)"; then
    pids="$pid"
  else
    pids="$(list_pids)"
  fi

  if [[ -z "$pids" ]]; then
    echo "INFO: No running chrome-devtools-mcp processes found"
    clear_pid
    return 0
  fi

  while read -r pid; do
    if [[ -n "$pid" ]]; then
      kill_pid_gracefully "$pid"
    fi
  done <<< "$pids"

  clear_pid
  echo "Stopped chrome-devtools-mcp"
}

main() {
  if [[ $# -lt 1 ]]; then
    usage
    exit 1
  fi

  local action="$1"
  shift

  if [[ "${1:-}" == "--" ]]; then
    shift
  fi

  case "$action" in
    start)
      start "$@"
      ;;
    run)
      run_foreground "$@"
      ;;
    stop)
      stop
      ;;
    status)
      status
      ;;
    dedupe)
      dedupe
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown action: $action" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
