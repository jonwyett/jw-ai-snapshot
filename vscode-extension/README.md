# JW AI Snapshot VS Code Extension

This VS Code extension provides a seamless interface for the `jw-ai-snapshot` CLI tool, enabling effortless snapshot management and AI-assisted development workflows directly within your IDE.

## Features

### 📁 Snapshots View
- Dedicated "Snapshots" panel in the Explorer
- Lists all project snapshots with timestamps
- Auto-refreshes when snapshots are created or deleted

### 🔧 Core Actions
- **Create Snapshot**: Quickly create new snapshots with custom labels
- **Restore Snapshot**: Restore any snapshot with confirmation dialog
- **Delete Snapshot**: Remove snapshots with confirmation
- **Refresh**: Manually refresh the snapshot list

### 🤖 AI-Assisted Features
Right-click any snapshot to access powerful AI analysis tools:

- **Generate AI Prompt → Against Current Files**: Compare snapshot to current state
- **Generate AI Prompt → Against Another Snapshot**: Compare two snapshots
- **Generate AI Prompt → Analyze Regression**: Advanced two-part regression analysis

All generated prompts automatically open in the editor for immediate use with AI assistants.

### 👁️ Visual Diff
- **Visually Diff Against → Current Files**: Folder-level diff using VS Code's native diff viewer
- **Visually Diff Against → Another Snapshot**: Compare two snapshot folders

## Prerequisites

1. **JW AI Snapshot CLI**: Ensure the `jw-ai-snapshot` tool is installed and available as `node snapshot.js` in your project root
2. **Initialized Project**: Run `node snapshot.js init` in your project to create the snapshots system
3. **VS Code**: Version 1.74.0 or higher

## Installation

### Method 1: Package the Extension (Recommended)
1. Install `vsce` globally: `npm install -g vsce`
2. Navigate to the extension directory: `cd vscode-extension`
3. Package the extension: `vsce package`
4. Install the generated `.vsix` file in VS Code: Extensions → Install from VSIX

### Method 2: Development Mode
1. Open the `vscode-extension` folder in VS Code
2. Press `F5` to launch a new Extension Development Host window
3. The extension will be active in the new window

## Usage

1. **First Time Setup**: If snapshots aren't initialized, the extension will prompt you to run `node snapshot.js init`
2. **View Snapshots**: The "Snapshots" panel appears in the Explorer when snapshots are detected
3. **Create**: Click the "+" icon in the Snapshots panel
4. **Manage**: Right-click any snapshot for the full context menu of actions

## Architecture

This extension follows the "smart wrapper" principle:
- **No business logic**: All operations delegate to the CLI tool
- **Pure UI layer**: Handles user interaction and file management only
- **CLI integration**: Executes `node snapshot.js` commands via child processes

## Commands Reference

The extension provides these VS Code commands:

- `jwSnapshot.refresh` - Refresh snapshot list
- `jwSnapshot.createSnapshot` - Create new snapshot
- `jwSnapshot.restoreSnapshot` - Restore selected snapshot  
- `jwSnapshot.deleteSnapshot` - Delete selected snapshot
- `jwSnapshot.generatePromptCurrent` - Generate AI prompt vs current
- `jwSnapshot.generatePromptAnother` - Generate AI prompt vs another snapshot
- `jwSnapshot.analyzeRegression` - Generate regression analysis prompt
- `jwSnapshot.diffCurrent` - Visual diff vs current files
- `jwSnapshot.diffAnother` - Visual diff vs another snapshot

## Troubleshooting

### "No snapshots found" Message
- Ensure you've run `node snapshot.js init` in your project root
- Verify the `__snapshots__` directory exists with a `snapshot.log` file

### Commands Not Working
- Check that `node snapshot.js` runs successfully from your project root
- Ensure the Go binary or Node.js script is properly set up per the main tool's documentation

### Extension Not Appearing
- Verify VS Code version compatibility (1.74.0+)
- Check the Output panel (Help → Toggle Developer Tools → Console) for error messages

## Development

To modify this extension:

1. Clone/download the source
2. Run `npm install` to install dependencies  
3. Make changes to TypeScript files in `src/`
4. Run `npm run compile` to build
5. Test using `F5` (Extension Development Host)

## License

MIT License - Same as the main jw-ai-snapshot project.