Of course. A changelog is essential for a `2.0.0` release. It clearly communicates the value of the new version and respectfully documents the breaking changes for any early adopters.

Here is a `CHANGELOG.md` file that follows standard conventions.

***

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.html).

## [Unreleased]

---

## [2.0.0] - 2025-07-25

This is a landmark release that completely overhauls the tool's core logic to be more powerful, intuitive, and user-friendly. It transitions the project from an experimental utility to a mature development companion.

### 💥 BREAKING CHANGES

-   **New Configuration System:** The `.snapshotignore` file format has been completely redesigned. The old system using `# USE_GITIGNORE` and `# ADD_TO_GITIGNORE` flags is no longer supported.
    -   **Action Required:** All users must run `snapshot init` in their project to generate the new, two-section `.snapshotignore` file.
-   **`init` Command is Now Mandatory:** The tool will no longer run without a `.snapshotignore` file present. The `init` command is the required first step for any project.

### ✨ Added

-   **`snapshot init` Command:** A dedicated, one-time command to initialize a project and create a well-documented `.snapshotignore` configuration file.
-   **Powerful Diff Engine:** The `--diff` command now generates detailed, line-by-line diffs for modified files, not just a list of changed files.
-   **Flexible Diff Targets:** The `diff` command can now compare two specific snapshots (`snapshot 0001 0002 --diff`), not just a snapshot against the current state.
-   **`--analyze-regression` Command:** A new flagship feature that automatically performs a two-stage comparison (`N` vs `N+1` and `N` vs `current`) to generate a highly effective, context-rich prompt for an LLM to find the root cause of a regression.
-   **`--dev-mode` Flag:** A special flag for developers working on the snapshot tool itself, allowing for snapshots that include the tool's own configuration files.

### ♻️ Changed

-   **Simplified Ignore Logic:** The ignore system is now built around a simple, two-section `.snapshotignore` file (`ALWAYS SNAPSHOT` and `NEVER SNAPSHOT`). This eliminates the need for special syntax (`!`) and makes overriding `.gitignore` rules simple and transparent.
-   **Intelligent AI Prompts:** The `--prompt` flag is now an alias for the more powerful `--analyze-regression` workflow, producing vastly more useful output for LLMs.
-   **Human-Readable Log:** The `snapshot.log` file is now a clean, human-readable "Change Manifest" that summarizes the files added, modified, and removed in each snapshot, making it easy to scan the project's history.

### 🗑️ Removed

-   **Implicit First-Run Setup:** The confusing, stateful, and interactive configuration that hijacked the user's first command has been completely removed in favor of the explicit `init` command.
-   **Internal Configuration Flags:** The internal `# USE_GITIGNORE` and `# ADD_TO_GITIGNORE` flags have been removed from the codebase.

---

## [1.0.0] - Initial Release

-   Initial implementation of snapshot creation, diffing, and restoration.
-   Snapshot creation with sequential numbering and a user-provided label.
-   `--diff` command based on file-level SHA1 hash comparison.
-   `--restore` command to roll back project files.
-   Basic `.snapshotignore` functionality.