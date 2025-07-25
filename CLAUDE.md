# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **jw-ai-snapshot**, a lightweight snapshotting tool designed for AI-assisted development workflows. The tool allows developers to create, compare, and restore project snapshots during iterative development.

## Architecture

The project has dual implementations:
- **Node.js version** (`snapshot.js`) - Primary implementation, feature-complete
- **Go version** (`go/snapshot.go`) - Alternate implementation in development

### Core Components

1. **Snapshot Creation**: Copies project files (excluding ignored files) to `__snapshots__/NNNN_label/`
2. **Diff Engine**: Compares snapshots to current state, outputs JSON diffs with line-by-line changes
3. **Restore System**: Restores files from snapshots with dry-run capability  
4. **Ignore System**: Uses `.snapshotignore` files (gitignore-style patterns) with optional `.gitignore` integration
5. **AI Prompt Generation**: Creates markdown prompts for AI analysis of changes and regressions
6. **Change Manifest**: Human-readable logging of changes between snapshots

### Key Files

- `snapshot.js` - Main Node.js CLI tool (Epic 1-5 complete)
- `go/snapshot.go` - Go implementation (legacy, not maintained)
- `__tests__/snapshot.test.js` - Jest test suite
- `__tests__/utils.test.js` - Utility function tests
- `dev/Docs/diff/` - Epic documentation and implementation plans

## Commands

### Running the Tool

**Node.js version (primary):**
```bash
# First-time setup
node snapshot.js init                    # Initialize project with interactive setup

# Basic operations
node snapshot.js "description"           # Create snapshot
node snapshot.js "description" --dev-mode # Create snapshot including tool files

# Diff and analysis
node snapshot.js NNNN --diff            # Compare snapshot to current
node snapshot.js NNNN MMMM --diff       # Compare two snapshots
node snapshot.js NNNN --prompt          # Generate AI analysis prompt
node snapshot.js NNNN --analyze-regression # Advanced two-part regression analysis

# Restore operations
node snapshot.js NNNN --restore         # Restore from snapshot
node snapshot.js NNNN --restore --dry-run  # Preview restore changes

# Help
node snapshot.js --help                 # Show comprehensive help
```

**Development Commands:**
```bash
npm test                                 # Run Jest tests
```

### Snapshot Structure

Snapshots are stored in `__snapshots__/` with format `NNNN_sanitized_label/`:
- Sequential numbering (0001, 0002, etc.)
- Labels are sanitized (lowercase, underscores, alphanumeric only)
- `snapshot.log` contains human-readable change manifest with categorized file changes

### Initialization and Configuration

**Epic 5 Implementation (Complete):**
- **Explicit initialization**: `node snapshot.js init` creates configuration interactively
- **First-run detection**: Clear error message directs users to run init
- **Simplified ignore logic**: Only reads from `.snapshotignore` file
- **Developer mode**: `--dev-mode` flag includes tool source files in snapshots

The `.snapshotignore` file supports:
- Standard gitignore patterns
- Configuration flag: `USE_GITIGNORE=TRUE/FALSE` to include .gitignore patterns
- Clean, commented format created by init command

## Advanced Features

### AI-Assisted Analysis

**Epic 2 & 3 Implementation (Complete):**
- **Single Analysis**: `--prompt` generates markdown analysis of changes since a snapshot
- **Regression Analysis**: `--analyze-regression` performs two-part analysis:
  - **Causal Diff**: Changes between last-good and first-broken snapshots
  - **Cumulative Diff**: All changes from last-good to current state
- **Token-efficient prompts**: Focus on modified files with detailed diffs, only list added/removed files

### Change Tracking

**Epic 4 Implementation (Complete):**
- **Human-readable manifest**: `snapshot.log` categorizes changes as Changed/Added/Removed
- **Truncated listings**: Shows first 10 files, then summary for large changesets
- **Intelligent comparison**: Compares each snapshot against its predecessor

## Epic Status

- **Epic 1**: ✅ Flexible, granular line-by-line diffing (using `diff` library)
- **Epic 2**: ✅ Intelligent AI prompt generator with structured markdown
- **Epic 3**: ✅ Advanced regression analysis (causal vs cumulative diffs)  
- **Epic 4**: ✅ Human-readable change manifest logging
- **Epic 5**: ✅ Simplified initialization with explicit `init` command

## Testing

Tests use Jest with temporary directories to isolate test runs. The test suite covers:
- Snapshot creation and numbering
- Diff generation and accuracy  
- Restore functionality with dry-run
- Ignore pattern handling
- Cross-platform compatibility
- Epic functionality validation

Test files are in `__tests__/` and can be run individually or as a suite.