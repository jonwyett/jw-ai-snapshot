# jw-ai-snapshot v2.0.0

A lightweight, local snapshotting tool designed as a high-velocity safety net for AI-assisted development.

`jw-ai-snapshot` is not a replacement for `git`. Git is for your permanent history; `snapshot` is for your volatile, moment-to-moment development loop. It allows you to create, analyze, and restore project states with frictionless commands, making it the perfect companion for rapid, AI-powered iteration.

-   📸 **Save** complete snapshots of your project at key moments.
-   🔍 **Analyze** the precise, line-by-line differences between any two states.
-   ♻️ **Restore** your project to any previously saved state instantly.

---

## ✨ Core Features

-   **Intelligent Ignore System**: A simple, two-section `.snapshotignore` file works *with* your `.gitignore` to give you ultimate control with no special syntax.
-   **Powerful Diff Engine**: Pinpoint what changed between any two snapshots, or between a snapshot and your current code.
-   **AI-Powered Regression Analysis**: Use the `analyze-regression` command to automatically generate a perfect, two-part prompt for an LLM to find the root cause of a bug.
-   **Safe Restore**: Roll back your entire project to a known-good state, with a `--dry-run` mode to preview changes.
-   **Zero Dependencies**: A single script or binary with no installation required.

---

## 🚀 Getting Started (2-Step Setup)

1.  **Get the Tool**
    Drop `snapshot.js` into your project root. (A standalone Go binary is the ultimate goal).

2.  **Initialize Your Project**
    Run the one-time `init` command. This will create your configuration file.
    ```bash
    node snapshot.js init
    ```

That's it. You're ready to take your first snapshot.

---

## 📂 The `.snapshotignore` File

The `init` command creates a `.snapshotignore` file. This is the single source of truth for ignoring files and is designed to be self-documenting. It allows you to easily make exceptions to your `.gitignore` rules without any special syntax.

Here’s what it looks like:

```ini
# jw-ai-snapshot Configuration File
# This file works WITH your .gitignore. The snapshot tool will always
# use your .gitignore rules as a base. This file lets you manage exceptions.

#-----------------------------------------------------------------------
## ALWAYS SNAPSHOT (Exceptions to .gitignore)
#-----------------------------------------------------------------------
# Add files or folders here that you WANT to snapshot, even if your
# .gitignore file ignores them.
#
# EXAMPLE: To snapshot your 'build/' directory, just add it here.

# build/

#-----------------------------------------------------------------------
## NEVER SNAPSHOT (Snapshot-specific ignores)
#-----------------------------------------------------------------------
# Add files or folders here that should ONLY be ignored for snapshots.
# This section is pre-populated with safe defaults.

# Version Control
.git/

# Dependencies
node_modules/
# ... and other defaults
```

---

## 🛠️ Commands

#### `snapshot init`
Initializes the project by creating the `.snapshotignore` file. **Run this first.**

#### `snapshot "short description"`
Creates a new numbered snapshot in the `__snapshots__/` directory.

#### `snapshot <index> [other_index] --diff`
Compares two states.
-   `snapshot 0014 --diff`: Compares snapshot `0014` to the current code.
-   `snapshot 0014 0015 --diff`: Compares snapshot `0014` to snapshot `0015`.

#### `snapshot <index> --analyze-regression`
The star of the show. Automatically compares snapshot `<index>` against `<index+1>` *and* against the current code to generate a powerful, two-part prompt for an LLM, designed to pinpoint the root cause of a regression.

#### `snapshot <index> --restore [--dry-run]`
Restores all files from snapshot `<index>`. Use `--dry-run` to see what would change without touching any files.

---

## 🔍 Example "Find the Bug" Workflow

1.  You're coding with an AI, things are moving fast, and suddenly you notice the login button is broken.
2.  You test previous snapshots and find the last version where it worked: `0015`.
3.  Run the powerful analysis command:
    ```bash
    node snapshot.js 0015 --analyze-regression
    ```
4.  This generates a `prompt.txt` file containing two diffs: the minimal change between `0015` and `0016` (likely where the bug was introduced) and the full change between `0015` and your current code.
5.  You paste this prompt into your LLM and ask: "Based on this, find the bug and tell me how to fix it in my current code."
6.  If you're completely stuck, you can always roll back:
    ```bash
    node snapshot.js 0015 --restore
    ```

---

## 🧠 Philosophy & Architectural Goal

-   **Simplicity & Speed:** The tool should feel like a lightweight safety net, not a complex version control system.
-   **No Manual Required:** The configuration and commands should be intuitive and discoverable.
-   **Go Parity:** This Node.js version serves as the feature-complete prototype. The ultimate goal is a standalone, cross-platform binary compiled from a parallel Go implementation.

---

## 📄 License

MIT. Use it, modify it, build on it.