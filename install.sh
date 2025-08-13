#!/bin/bash

# Project Index Global Installer
# Installs the project indexer globally for use with any project

set -e

INSTALL_DIR="$HOME/.claude-code-tools/project-index"
BIN_DIR="$HOME/.local/bin"

echo "🔧 Installing Project Index globally..."

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Copy project files
echo "📁 Copying files to $INSTALL_DIR..."
cp -r . "$INSTALL_DIR"

# Build the project in the install directory
cd "$INSTALL_DIR"
echo "🔨 Building project..."

# Check if TypeScript is available, install if needed
if ! command -v tsc >/dev/null 2>&1; then
    echo "📦 Installing TypeScript compiler..."
    npm install -g typescript
fi

npm install --production
if ! npm run build; then
    echo "❌ Build failed. Please check the error above."
    exit 1
fi

# Create global binary symlink
echo "🔗 Creating global binary..."
cat > "$BIN_DIR/project-index" << EOF
#!/bin/bash
node "$INSTALL_DIR/dist/cli.js" "\$@"
EOF

chmod +x "$BIN_DIR/project-index"

# Create project initialization script
cat > "$BIN_DIR/project-index-init" << EOF
#!/bin/bash

# Project Index Initializer
# Sets up project indexing for any project

PROJECT_DIR="\${1:-\$(pwd)}"
PROJECT_DIR="\$(realpath "\$PROJECT_DIR")"

if [ ! -d "\$PROJECT_DIR" ]; then
    echo "❌ Directory does not exist: \$PROJECT_DIR"
    exit 1
fi

echo "🔍 Initializing Project Index for: \$PROJECT_DIR"

# Create .claude directory if it doesn't exist
mkdir -p "\$PROJECT_DIR/.claude/hooks"

# Copy hook scripts
cp "$INSTALL_DIR/.claude/hooks/indexer.sh" "\$PROJECT_DIR/.claude/hooks/"
cp "$INSTALL_DIR/.claude/hooks/load-index.sh" "\$PROJECT_DIR/.claude/hooks/"

# Make hooks executable
chmod +x "\$PROJECT_DIR/.claude/hooks/indexer.sh"
chmod +x "\$PROJECT_DIR/.claude/hooks/load-index.sh"

# Create .context/.project directory
mkdir -p "\$PROJECT_DIR/.context/.project"

# Create or update .claude/settings.json
SETTINGS_FILE="\$PROJECT_DIR/.claude/settings.json"
if [ -f "\$SETTINGS_FILE" ]; then
    echo "⚠️  .claude/settings.json already exists. You may need to manually merge hook configurations."
    echo "📋 Required hooks configuration:"
    cat "$INSTALL_DIR/.claude/settings.json"
else
    echo "📝 Creating .claude/settings.json..."
    cp "$INSTALL_DIR/.claude/settings.json" "\$SETTINGS_FILE"
fi

# Create initial index
echo "📊 Creating initial project index..."
cd "\$PROJECT_DIR"
project-index index

echo "✅ Project Index initialized successfully!"
echo ""
echo "🔧 Commands available:"
echo "   project-index status    - Show index health"
echo "   project-index search    - Search symbols"  
echo "   project-index watch     - Start file watcher"
echo "   project-index index     - Rebuild full index"
echo ""
echo "🎯 Next Steps:"
echo "   1. Start Claude Code in this directory"
echo "   2. The index will automatically load at session start"
echo "   3. File changes will trigger incremental updates"

EOF

chmod +x "$BIN_DIR/project-index-init"

# Verify binaries were created
if [ ! -f "$BIN_DIR/project-index" ] || [ ! -f "$BIN_DIR/project-index-init" ]; then
    echo "❌ Failed to create binary files"
    exit 1
fi

# Add to PATH if not already there
if ! echo "$PATH" | grep -q "$BIN_DIR"; then
    echo ""
    echo "📝 Adding $BIN_DIR to your PATH..."
    if ! grep -q "export PATH=\"\$PATH:$BIN_DIR\"" ~/.bashrc 2>/dev/null; then
        echo "export PATH=\"\$PATH:$BIN_DIR\"" >> ~/.bashrc
        echo "✅ Added to ~/.bashrc"
    else
        echo "ℹ️  Already in ~/.bashrc"
    fi
    echo ""
    echo "⚠️  Run 'source ~/.bashrc' or restart your terminal to use the commands"
    echo ""
fi

echo "✅ Project Index installed globally!"
echo ""
echo "🚀 Usage:"
echo "   project-index-init [directory]  - Initialize indexing for a project"
echo "   project-index <command>         - Run indexer commands"
echo ""
echo "💡 To set up indexing for any project:"
echo "   cd /path/to/your/project"
echo "   project-index-init"