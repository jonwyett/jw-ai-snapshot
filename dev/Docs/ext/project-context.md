
### **Project Context: VS Code Extension for jw-ai-snapshot**

#### **1. Core Mission (The "Why")**

The `jw-ai-snapshot` command-line tool is a powerful safety net for rapid, AI-assisted development. However, its effectiveness depends on it being used frequently and effortlessly. The core mission of this epic is to **eliminate all friction** by building a UI for the tool that lives directly inside the developer's primary workspace: VS Code.

We are not just adding a UI; we are creating a seamless, ambient experience that makes snapshotting a natural reflex. The goal is to maximize the discoverability and usability of the tool's most powerful features—specifically the AI-assisted prompt generation (`--prompt`) and regression analysis (`--analyze-regression`) commands.

#### **2. Functional Requirements (The "What")**

We will build a VS Code extension that provides a "remote control" for the snapshot utility. The key features are:

*   **A Dedicated "Snapshots" View:** A panel in the activity bar that lists all snapshots from the project's log file.
*   **A Rich Context Menu:** Right-clicking a snapshot will be the main action hub, providing easy access to:
    *   Basic actions: `Restore`, `Delete`.
    *   Visual diffing: Comparing a snapshot to the current code or to another snapshot using VS Code's native diff viewer.
    *   **AI-Assist Features:** The most important part of the menu will be dedicated to generating AI prompts for `diff`, `prompt`, and the powerful `analyze-regression` commands.
*   **A Complete Workflow:** When a prompt is generated, the extension must automatically open the resulting text file, making it immediately ready for use.

#### **3. The Golden Rule: Architectural Mandate (The "How")**

This is the most critical constraint for this project:

**The VS Code extension contains NO business logic. It is a smart wrapper, not a reimplementation.**

*   The extension's **only job** is to correctly formulate and execute command-line calls to the compiled Go `snapshot` binary.
*   All file operations, diffing, logging, and analysis are handled exclusively by the external CLI tool.
*   The extension will be written in TypeScript, but it should not use Node.js APIs like `fs` for any core snapshotting tasks. Its role is to read the log file for display purposes and to spawn child processes to run the `snapshot` command with the correct arguments.

The `snapshot` CLI is the engine; the VS Code extension is the dashboard and the steering wheel.