
### **V3 Feature Proposal: VS Code IDE Integration (Revised)**

**Epic 1: Create a Seamless In-Editor Snapshotting Experience**

**Goal:** To develop a VS Code extension that serves as a UI wrapper around the `snapshot` CLI. This will make creating, managing, and using snapshots—especially the advanced AI-analysis features—an integral part of the development environment.

**Core Principles:**

1.  **CLI is the Engine:** The extension only calls the `snapshot` binary; it contains no business logic.
2.  **Zero Configuration (by default):** Works out-of-the-box, assuming `snapshot` is in the system's PATH.
3.  **Discoverability:** The UI makes all features, from basic to advanced, obvious and easy to access.

---

### **Sprint List & User Stories**

#### **User Story 1.1: The Core UI - The "Snapshots" View**

*   **As a developer,** I want a dedicated view in my IDE that lists all my existing snapshots, so I can see my project's history at a glance.
*   **Acceptance Criteria:**
    *   A "Snapshots" view is added to the VS Code Activity Bar.
    *   The view is populated by parsing the `__snapshots__/snapshot.log` file.
    *   A "Create Snapshot" button prompts for a label and executes `snapshot "label"`.
    *   A "Refresh" button re-reads the log.

#### **User Story 1.2: The "Action Hub" - Rich Context Menu for Core and AI-Assisted Actions** (Expanded Scope)

*   **As a developer,** I want to right-click any snapshot to access all core actions, especially the powerful AI prompt generation features, directly from a single, intuitive context menu.
*   **Acceptance Criteria:**
    1.  Right-clicking a snapshot in the list reveals a context menu with standard actions:
        *   **`Restore this snapshot...`** (with confirmation)
        *   **`Delete Snapshot...`** (with confirmation)
    2.  The menu contains a dedicated submenu titled **`Generate AI Prompt`** which is the primary access point for the tool's intelligent features.
    3.  The **`Generate AI Prompt`** submenu contains the following options:
        *   **`Against Current Files`**: Executes `snapshot NNNN --prompt`. This is the basic "what's changed since this snapshot?" prompt.
        *   **`Against Another Snapshot...`**: Opens a quick-picker for the user to select snapshot `MMMM`, then executes `snapshot NNNN MMMM --prompt`.
        *   **`Analyze Regression from this Point`**: Executes `snapshot NNNN --analyze-regression`. This is the "killer feature" for finding the root cause of a bug.
    4.  **For all prompt-generating actions**, upon successful execution, the extension will **automatically open the generated `.txt` file** in a new editor tab, completing the user's workflow.

#### **User Story 1.3: Advanced Interaction - The Visual Diff Experience**

*   **As a developer,** I want a rich, integrated way to *visually* see the differences between snapshots, using the native diffing tools of my IDE.
*   **Acceptance Criteria:**
    *   The right-click menu includes a "Visually Diff Against..." submenu.
    *   Options include:
        *   **`Current Files`**: Opens VS Code's native folder-level diff between the snapshot folder and the current workspace.
        *   **`Another Snapshot...`**: Allows selection of another snapshot and opens the diff view between the two snapshot folders.

