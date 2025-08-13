#!/bin/bash

# Load Project Index Hook for Claude Code
# Outputs the PROJECT_INDEX.json to Claude's context at session start

PROJECT_DIR="$CLAUDE_PROJECT_DIR"
if [ -z "$PROJECT_DIR" ]; then
    PROJECT_DIR="$(pwd)"
fi

INDEX_FILE="$PROJECT_DIR/.context/.project/PROJECT_INDEX.json"

# Check if index file exists
if [ ! -f "$INDEX_FILE" ]; then
    echo "🔍 No project index found. The project indexer will create one automatically."
    echo "📋 Project Index: Not available"
    exit 0
fi

# Output index summary for Claude's context
echo "🔍 PROJECT INDEX LOADED"
echo "======================"
echo ""

# Get basic stats from the index
if command -v jq >/dev/null 2>&1; then
    # Use jq for better parsing if available
    FILES_COUNT=$(jq '.files | length' "$INDEX_FILE" 2>/dev/null || echo "0")
    SYMBOLS_COUNT=$(jq '.symbolIndex | length' "$INDEX_FILE" 2>/dev/null || echo "0")
    UPDATED=$(jq -r '.updatedAt // "unknown"' "$INDEX_FILE" 2>/dev/null || echo "unknown")
    
    echo "📊 Index Statistics:"
    echo "   Files: $FILES_COUNT"
    echo "   Symbols: $SYMBOLS_COUNT" 
    echo "   Last Updated: $UPDATED"
    echo ""
else
    # Fallback without jq
    echo "📋 Project index is available at .context/.project/PROJECT_INDEX.json"
    echo ""
fi

# Output useful project overview instead of raw JSON
echo "🗂️  PROJECT OVERVIEW:"
echo "===================="

# Get top-level directories
if command -v jq >/dev/null 2>&1; then
    # Use jq for better parsing if available
    echo ""
    echo "📁 Key Directories & Files:"
    jq -r '.files | keys[]' "$INDEX_FILE" 2>/dev/null | \
        sed 's|/[^/]*$||' | sort | uniq -c | sort -nr | head -8 | \
        awk '{printf "   %-20s (%s files)\n", $2 ? $2 : ".", $1}'
    
    echo ""
    echo "🔧 Main Entry Points:"
    jq -r '.symbolIndex | to_entries[] | select(.key | test("main|index|app|server|cli")) | "   \(.key) → \(.value)"' "$INDEX_FILE" 2>/dev/null | head -5
    
    echo ""
    echo "🏗️  Key Symbols Found:"
    jq -r '.symbolIndex | to_entries[] | select(.key | test("class|interface|function") | not) | .key' "$INDEX_FILE" 2>/dev/null | \
        head -10 | awk '{printf "   %s\n", $1}'
        
else
    # Fallback without jq - just show basic info
    echo "   📁 Full index available at .context/.project/PROJECT_INDEX.json"
    echo "   🔍 Use 'project-index search <term>' to explore symbols"
fi

echo ""
echo "💡 Index location: .context/.project/PROJECT_INDEX.json"
echo "💡 Use project-index search <symbol> to find specific symbols"

echo ""
echo "🔧 Available index commands:"
echo "   project-index status    - Show index status"  
echo "   project-index search    - Search for symbols"
echo "   project-index index     - Rebuild full index"