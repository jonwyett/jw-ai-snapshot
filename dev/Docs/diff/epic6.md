
#### **Epic 6: Overhaul Ignore System with a Two-Section File**

**Goal:** To completely replace the existing ignore logic with a new, unambiguous system centered on a two-section `.snapshotignore` file. This design will be intuitive, require no special syntax, and make it easy for users to manage the crucial differences between their `git` history and their local snapshots.

### Epic 6 Overview Snippet

**The "Why": The Core Problem**

Our previous ignore logic was confusing and failed the "no manual required" test. It attempted to merge `.gitignore` and `.snapshotignore` rules invisibly in the background, forcing users to learn special `git`-like syntax (e.g., the `!` prefix) to manage the inevitable conflicts. This created an unpredictable system where the user couldn't be certain what was being ignored without performing a test run. The core user need—to easily snapshot files that `git` ignores (like build artifacts)—was difficult and non-obvious.

**The "What": An Explicit and Discoverable Solution**

This epic overhauls the system in favor of transparency and simplicity. We are introducing a new, two-section `.snapshotignore` file that acts as its own documentation.

1.  **`## ALWAYS SNAPSHOT` section:** This is a simple list where a user can add a file or folder name (e.g., `build/`) to explicitly *un-ignore* it, overriding any rule from `.gitignore`.
2.  **`## NEVER SNAPSHOT` section:** This is a simple list for adding rules that *only* apply to snapshots.

This new design makes the user's intent explicit. It removes the need for any special syntax, and the system becomes completely predictable: the tool always uses `.gitignore` as a live base, then applies the simple, human-readable exceptions defined in `.snapshotignore`.

---

### Core Design: The New `.snapshotignore` File

The `snapshot init` command will create the following file. The comments within the file itself will serve as the primary documentation, guiding the user to the correct behavior.

```ini
# jw-ai-snapshot Configuration File
# This file works WITH your .gitignore, not against it. The snapshot tool
# will always use your .gitignore rules as a base. This file lets you
# manage the exceptions.

#-----------------------------------------------------------------------
## ALWAYS SNAPSHOT (Exceptions to .gitignore)
#-----------------------------------------------------------------------
# Add files or folders here that you WANT to include in snapshots,
# even if your .gitignore file ignores them.
#
# COMMON USE CASE: Your .gitignore probably ignores 'build/' or 'dist/'.
# Add 'build/' here to make sure your snapshots contain those critical
# build artifacts, creating a fully working copy.
#
# ANOTHER USE CASE: To snapshot environment files, add '.env' here.

# build/
# .env


#-----------------------------------------------------------------------
## NEVER SNAPSHOT (Snapshot-specific ignores)
#-----------------------------------------------------------------------
# Add files or folders here that should ONLY be ignored for snapshots.
# This is useful for large assets or logs that you track in git but
# don't need in every quick code snapshot.

# --- Default Safe Ignores ---

# Version Control
.git/

# Dependencies
node_modules/

# OS & Editor specific
.DS_Store
.vscode/
.idea/

# Logs
*.log

# Environment Files (un-comment the lines below to ignore them)
# .env
# .env.local

```

*Note: In the final implementation, the `.env` rules at the bottom will be active by default, and the comment in the `ALWAYS SNAPSHOT` section will guide the user on how to override them.*

### Implementation Logic

1.  The tool **always** reads `.gitignore` first to create a base set of ignore patterns.
2.  The tool then reads and parses the two-section `.snapshotignore` file.
3.  For every pattern listed in the `## ALWAYS SNAPSHOT` section, it finds and **removes** the corresponding rule from the base set. This is the exception logic.
4.  For every pattern listed in the `## NEVER SNAPSHOT` section, it **adds** that rule to the base set.
5.  The final, combined set of rules is used to filter the files for the snapshot.

### Sprint User Stories

*   **User Story 5.1: Implement `snapshot init` with the New Template**
    *   **As a new user,** when I run `snapshot init`, I want the tool to create the new, two-section `.snapshotignore` file, pre-populated with safe defaults and helpful, educational comments.
    *   **Acceptance Criteria:**
        *   The `snapshot init` command creates the `.snapshotignore` file with the exact structure and content defined in the "Core Design" section.
        *   The `## NEVER SNAPSHOT` section is pre-populated with the specified list (`.git/`, `node_modules/`, etc.).
        *   The `## ALWAYS SNAPSHOT` section is created but contains only commented-out examples.
        *   The command provides simple, clear feedback to the user upon completion.

*   **User Story 5.2: Implement the Two-Section Parser and Ignore Engine**
    *   **As a developer,** I want the core snapshot engine to correctly parse the two-section file and apply the override logic, ensuring that `ALWAYS SNAPSHOT` rules can successfully un-ignore patterns from `.gitignore`.
    *   **Acceptance Criteria:**
        *   The tool reads `.gitignore` first.
        *   A new parser correctly identifies the two sections and the patterns within each.
        *   Patterns in `ALWAYS SNAPSHOT` reliably remove rules from the initial `.gitignore` set.
        *   Patterns in `NEVER SNAPSHOT` are reliably added to the set.
        *   The final logic is fully tested against multiple scenarios (e.g., un-ignoring a file, adding a new ignore, file with no `.gitignore`).

*   **User Story 5.3: Deprecate and Remove All Old Ignore Logic**
    *   **As a developer,** I want to ensure all old, confusing ignore logic is completely removed from the codebase to eliminate technical debt and prevent unexpected behavior.
    *   **Acceptance Criteria:**
        *   The entire `interactiveConfiguration` function is deleted.
        *   The concept of a `USE_GITIGNORE` flag is removed.
        *   The need for complex `.gitignore` parsing libraries (like `ignore`) is re-evaluated and potentially removed in favor of a simpler custom parser, as special syntax (`!`) is no longer required.

This concludes our design phase for this epic. We have a clear, robust, and user-friendly plan that directly addresses all the complexities we've uncovered.