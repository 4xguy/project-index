#!/bin/bash

# Project Index Hook for Claude Code
# Automatically starts/maintains the project index

PROJECT_DIR="$CLAUDE_PROJECT_DIR"
if [ -z "$PROJECT_DIR" ]; then
    PROJECT_DIR="$(pwd)"
fi

# Try to find the indexer binary (prefer global, fallback to local)
if command -v project-index >/dev/null 2>&1; then
    INDEXER_BIN="project-index"
elif [ -f "$PROJECT_DIR/dist/cli.js" ]; then
    INDEXER_BIN="node $PROJECT_DIR/dist/cli.js"
else
    log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2; }
    log "ERROR: No project-index binary found. Install globally with 'project-index-init' or build locally with 'npm run build'."
    exit 1
fi

INDEX_FILE="$PROJECT_DIR/.context/.project/PROJECT_INDEX.json"
PID_FILE="$PROJECT_DIR/.indexer.pid"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Function to start the watcher
start_watcher() {
    # Check if already running
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        log "Watcher already running with PID $(cat "$PID_FILE")"
        return 0
    fi

    log "Starting project indexer watcher..."
    
    # Create initial index if it doesn't exist
    if [ ! -f "$INDEX_FILE" ]; then
        log "Creating initial project index..."
        $INDEXER_BIN index "$PROJECT_DIR"
    fi

    # Start watcher in background
    nohup $INDEXER_BIN watch "$PROJECT_DIR" --daemon > "$PROJECT_DIR/.indexer.log" 2>&1 &
    WATCHER_PID=$!
    
    echo "$WATCHER_PID" > "$PID_FILE"
    log "Watcher started with PID $WATCHER_PID"
}

# Function to update index for specific files
update_files() {
    local files=("$@")
    if [ ${#files[@]} -gt 0 ]; then
        log "Updating index for ${#files[@]} files..."
        $INDEXER_BIN update "$PROJECT_DIR" "${files[@]}"
    fi
}

# Function to check watcher status
check_status() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        log "Watcher running with PID $(cat "$PID_FILE")"
        return 0
    else
        log "Watcher not running"
        return 1
    fi
}

# Function to stop watcher
stop_watcher() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping watcher with PID $pid"
            kill "$pid"
            rm -f "$PID_FILE"
        else
            log "Watcher not running, cleaning up PID file"
            rm -f "$PID_FILE"
        fi
    else
        log "No PID file found"
    fi
}

# Main logic based on arguments or hook event
case "${1:-start}" in
    "start")
        start_watcher
        ;;
    "stop")
        stop_watcher
        ;;
    "status")
        check_status
        ;;
    "update")
        shift
        update_files "$@"
        ;;
    *)
        log "Usage: $0 {start|stop|status|update [files...]}"
        exit 1
        ;;
esac