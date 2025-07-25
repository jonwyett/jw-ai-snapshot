### The New Philosophy: Simplicity and Explicit Intent

1.  **Explicit is Better than Implicit:** No more "magic" actions. The tool will not silently modify its own configuration.
2.  **A Single Point of Initialization:** The first-run setup should be a clear, one-time event, not something that might or might not happen on any given run.
3.  **The File is the Source of Truth:** Once `.snapshotignore` exists, the tool simply obeys it. It doesn't try to manage it.

### Proposed New Workflow: The `snapshot init` Command

Instead of hijacking a user's first snapshot attempt, we'll adopt a standard and predictable pattern used by many developer tools (`git init`, `npm init`): a dedicated `init` command.

**Scenario A: User runs `snapshot.exe` in a new project for the first time.**

The tool detects that no `.snapshotignore` file exists and gives a clear message:

```
Welcome to jw-ai-snapshot!
It looks like this project hasn't been initialized.
Please run `snapshot init` to create a configuration file.```

The program then exits. This is clear and directs the user to the correct action.

**Scenario B: User runs `snapshot init`.**

This command triggers the one-time interactive setup:

1.  **Question 1 (Simple & Direct):**
    ```
    ? Should snapshots also ignore files from your project's .gitignore? (Y/n)
    ```
2.  **Question 2 (Simple & Direct):**
    ```
    ? Add the '__snapshots__/' directory to your .gitignore file? (Recommended) (Y/n)
    ```
3.  **Action:** The tool then creates a `.snapshotignore` file with the user's choices and helpful comments.

    ```ini
    # jw-ai-snapshot Configuration

    # If TRUE, patterns from .gitignore will also be used to filter snapshots.
    # This was set to TRUE on [Date/Time].
    # To change this, simply edit the value and save.
    USE_GITIGNORE=TRUE

    # --- Ignore Patterns ---
    # Add files and directories to ignore below, just like a .gitignore file.

    .git/
    node_modules/

    ```
4.  **Confirmation:** It finishes by telling the user exactly what it did.
    ```
    ✅ Created .snapshotignore with your settings.
    ✅ Added '__snapshots__/' to .gitignore.
    Project initialized. You can now create your first snapshot!
    ```

### How this Solves the Core Problems:

*   **No More Weirdness:** The confusing `interactiveConfiguration` logic is completely gone. The tool's behavior is now 100% predictable.
*   **User is in Control:** The `init` command makes setup a deliberate act. The user is never surprised by prompts.
*   **Single File Distribution:** This model works perfectly with a single `snapshot.exe` binary. There are no external dependencies for the setup process.
*   **Easy to Reconfigure:** If a user wants to change a setting, the new instruction is simple: "Just open `.snapshotignore` and edit it."

---

### Sprint Plan: Epic 5

This is a significant overhaul, so it deserves its own epic.

#### **Epic 5: Simplify and Overhaul Ignore & Initialization Logic**

**Goal:** To replace the complex, stateful first-run experience with a clean, explicit `snapshot init` command, making the tool more intuitive and predictable for new users.

*   **User Story 5.1: Create the `snapshot init` Command**
    *   **As a new user,** I want a dedicated `init` command that interactively guides me through creating a `.snapshotignore` configuration file.
    *   **Acceptance Criteria:**
        *   Running `snapshot init` triggers an interactive setup process.
        *   The process asks two simple questions (Use `.gitignore`? Add `__snapshots__/` to `.gitignore`?).
        *   Based on the answers, a well-commented `.snapshotignore` file is generated.
        *   If requested, `__snapshots__/` is appended to the project's `.gitignore`.
        *   If `.snapshotignore` already exists, the command informs the user and exits without making changes.

*   **User Story 5.2: Refactor Core Ignore Logic**
    *   **As a developer,** I want the main snapshotting logic to be simplified to just read from the `.snapshotignore` file without any interactive fallbacks.
    *   **Acceptance Criteria:**
        *   The entire `interactiveConfiguration` function is **deleted**.
        *   The `loadIgnoreList` function is simplified. It now only reads the `USE_GITIGNORE` flag and the ignore patterns from `.snapshotignore`.
        *   If `snapshot.js` is run in a project without a `.snapshotignore` file, it prints a clear error message directing the user to run `snapshot init`, and then exits.

*   **User Story 5.3: Implement `--dev-mode` for Self-Development**
    *   **As the tool's developer,** I need a way to create snapshots *of the tool itself*, including its own configuration files.
    *   **Acceptance Criteria:**
        *   A new command-line flag, `--dev-mode`, is introduced.
        *   When this flag is present, the ignore logic is modified to **not** ignore files like `snapshot.js`, `.snapshotignore`, `go.mod`, etc.
        *   This allows snapshots of the tool's source code to be taken for development and testing purposes.

This plan directly addresses all the issues you raised, providing a clean path to a much more robust and user-friendly tool.