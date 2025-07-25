# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **VS Code Extension** for the **jw-ai-snapshot** tool - a lightweight snapshotting extension that integrates the CLI tool directly into VS Code's interface. The extension provides a "smart wrapper" around the CLI, offering visual snapshot management and AI-assisted development workflows.

## Architecture

### Core Design Pattern: Smart Wrapper
- **No business logic**: All snapshot operations delegate to the CLI tool via `node snapshot.js`
- **Pure UI layer**: Handles only user interaction, file management, and VS Code integration
- **CLI integration**: Executes commands via Node.js `child_process.exec()`

### Key Components

1. **SnapshotTreeDataProvider** (`src/snapshotProvider.ts`)
   - Manages the "Snapshots" tree view in VS Code Explorer
   - Parses `__snapshots__/snapshot.log` to display snapshot list  
   - Handles snapshot data refresh and tree rendering

2. **SnapshotItem** (`src/snapshotItem.ts`)
   - VS Code TreeItem representation of individual snapshots
   - Displays snapshot number, label, timestamp, and archive icon

3. **Extension Main** (`src/extension.ts`)
   - Extension activation and command registration
   - Delegates all operations to CLI via `execAsync()`
   - Handles initialization detection and user prompts

### File Structure
```
src/
├── extension.ts        # Main extension entry point
├── snapshotProvider.ts # Tree data provider for snapshots view
└── snapshotItem.ts     # Individual snapshot tree item
```

## Commands and Development

### Build Commands
```bash
# Development setup
npm install                    # Install dependencies

# Build and compile
npm run compile               # Compile TypeScript to JavaScript
npm run watch                 # Watch mode for development

# Package for distribution  
npm run vscode:prepublish     # Prepare for publishing
vsce package                  # Create .vsix package (requires vsce globally)
```

### Development Workflow
1. **Development Mode**: Press `F5` to launch Extension Development Host
2. **Code Changes**: Modify TypeScript files in `src/`
3. **Compilation**: Run `npm run compile` or use watch mode
4. **Testing**: Use the Extension Development Host window for testing

### CLI Integration Requirements
- **Prerequisites**: The parent project must have `node snapshot.js` available in workspace root
- **Initialization**: Project must be initialized with `node snapshot.js init`
- **Dependencies**: Extension expects `__snapshots__/snapshot.log` file to exist

## VS Code Extension Architecture

### Activation and Context
- **Activation**: `onStartupFinished` - loads when VS Code starts
- **Context Setting**: `jwSnapshot.isInitialized` controls view visibility
- **Workspace Detection**: Requires workspace folder to function

### Tree View Integration
- **Explorer Panel**: "Snapshots" view appears when snapshots are detected
- **Tree Provider**: Custom `SnapshotTreeDataProvider` manages snapshot display
- **Refresh Pattern**: Manual refresh via button and automatic refresh after operations

### Command Structure
All commands follow the pattern: `jwSnapshot.<action>` and delegate to CLI:

**Core Operations:**
- `jwSnapshot.createSnapshot` → `node snapshot.js "description"`
- `jwSnapshot.restoreSnapshot` → `node snapshot.js NNNN --restore`
- `jwSnapshot.deleteSnapshot` → Direct folder deletion (not CLI)

**AI-Assisted Features:**
- `jwSnapshot.generatePromptCurrent` → `node snapshot.js NNNN --prompt`
- `jwSnapshot.generatePromptAnother` → `node snapshot.js NNNN MMMM --prompt`
- `jwSnapshot.analyzeRegression` → `node snapshot.js NNNN --analyze-regression`

**Visual Diff:**
- `jwSnapshot.diffCurrent` → VS Code native `vscode.diff` command
- `jwSnapshot.diffAnother` → Compare two snapshot folders

### Snapshot Log Parsing
The extension parses `__snapshots__/snapshot.log` with format:
```
[NNNN] YYYY-MM-DD HH:MM:SS - "description"
```
- Extracts number, timestamp, and label
- Generates folder names using `NNNN_sanitized_label` pattern
- Sorts snapshots by number (newest first)

## Extension Configuration

### package.json Key Sections
- **Activation Events**: `onStartupFinished`
- **Contributes**: Views, commands, and menus for VS Code integration
- **Context Menus**: Right-click actions on snapshot items
- **Icons**: Uses VS Code theme icons (`refresh`, `add`, `archive`)

### TypeScript Configuration
- **Target**: ES2020 with CommonJS modules
- **Output**: Compiled to `out/` directory with source maps
- **Strict Mode**: Enabled for type safety

## Error Handling and User Experience

### Initialization Flow
1. **Check Initialization**: Verify `__snapshots__/snapshot.log` exists
2. **User Guidance**: Show info message with terminal action if not initialized
3. **Context Setting**: Enable/disable view based on initialization status

### Error Patterns
- **CLI Errors**: Caught and displayed via `vscode.window.showErrorMessage`
- **File Operations**: Try-catch blocks around all async operations
- **User Confirmation**: Modal dialogs for destructive operations (restore/delete)

### Prompt Generation Workflow
1. Execute CLI command to generate prompt file
2. Parse stdout to extract generated filename
3. Open generated `.txt` file in VS Code editor
4. User can immediately use with AI assistants

## Development Guidelines

### CLI Command Execution
- Always use `execAsync()` with workspace root as `cwd`
- Handle both stdout parsing and error catching
- Refresh UI state after successful operations

### VS Code Integration Best Practices
- Use native VS Code diff viewer for visual comparisons
- Follow VS Code theming with `ThemeIcon` usage
- Implement proper TreeDataProvider refresh patterns
- Handle workspace folder detection properly

### File System Operations
- Use Node.js `fs.promises` for async file operations
- Path operations use `path.join()` for cross-platform compatibility
- Direct folder operations only for delete (CLI handles create/restore)