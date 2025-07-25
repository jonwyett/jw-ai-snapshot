### **Project Plan & Sprint List**

#### **Epic 1: Implement Flexible, Granular, Line-by-Line Diffing**

**Goal:** Upgrade the diff engine to perform a detailed, content-level comparison between any two project states (two snapshots, or one snapshot and current), and to generate a token-efficient output.

*   **User Story 1.1: Integrate a Diff Library**
    *   **As a developer,** I want the tool to use a robust library to generate a line-by-line diff between two versions of a text file.
    *   **Acceptance Criteria:**
        *   Research and select a suitable diffing library for Node.js (e.g., `diff`, `jsdiff`).
        *   Research and select a corresponding library for Go that can produce a similar output format (e.g., `go-diff`).
        *   The chosen libraries must be able to generate a diff in a standard, machine-readable format (like the Unified Diff Format).

*   **User Story 1.2: Enhance `compareSnapshots` for Flexible Comparison** (Updated Scope)
    *   **As a user,** I want to be able to compare any two snapshots, or a snapshot against my current code, to understand the precise changes between them.
    *   **Acceptance Criteria:**
        *   The CLI must support comparing two specific snapshots: `node snapshot.js NNNN MMMM --diff`.
        *   The CLI must maintain its original behavior for a single argument: `node snapshot.js NNNN --diff` will compare snapshot `NNNN` against the **current** working directory.
        *   The `compareSnapshots` function is updated to accept two arbitrary paths for comparison.
        *   The JSON output for a `modified` file will be `{"file": "path/to/file.js", "status": "modified", "diff": "..."}`.
        *   The JSON output for `added` or `removed` files will simply be `{"file": "path/to/file.js", "status": "added|removed"}`. The content of these files will **not** be included.

#### **Epic 2: Build an Intelligent AI Prompt Generator**

**Goal:** Transform the flexible diff data from Epic 1 into a polished, context-aware, and token-efficient prompt for an LLM.

*   **User Story 2.1: Redesign the `savePrompt` Function**
    *   **As a user,** when I use the `--prompt` flag, I want the tool to generate a text file that intelligently summarizes all project changes for an LLM.
    *   **Acceptance Criteria:**
        *   The function parses the JSON from the enhanced `compareSnapshots` output.
        *   It generates a prompt that starts with a clear, high-level instruction.
        *   The prompt body will contain distinct, clearly labeled sections for `[REMOVED]` files, `[ADDED]` files, and `[MODIFIED]` files.
        *   The output file is cleanly formatted for maximum readability.

*   **User Story 2.2: Format Modified File Diffs for Clarity**
    *   **As a user,** I want the `[MODIFIED]` section of the prompt to clearly show the line-by-line changes for each modified file.
    *   **Acceptance Criteria:**
        *   Each diff in the prompt is presented within a Markdown code block (e.g., ` ```diff ... ``` `).
        *   Each diff is preceded by a clear file header (e.g., `--- path/to/file.js`).
        *   Added lines are prefixed with `+`.
        *   Removed lines are prefixed with `-`.
        *   A few lines of unchanged context are included around the changes to help the LLM understand the code's structure.

---

This plan is now complete and robust. It lays out a clear path to creating the powerful diff and prompt engine you envisioned, and it preemptively builds the core functionality for the advanced regression analysis feature we discussed.

I am ready to generate the final documents based on this plan. Please give me the final go-ahead.