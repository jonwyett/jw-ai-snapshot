#### **Epic 3: Implement Advanced AI Regression Analysis**

**Goal:** To create a powerful, one-command feature that automates the discovery of a regression's root cause by comparing a known-good snapshot against both its immediate successor and the current project state, generating a highly effective, two-part prompt for an LLM.

*   **User Story 3.1: Implement the Regression Analysis Command and Logic**
    *   **As a developer,** when I identify a last-known-good snapshot, I want a single command that can automatically perform the two key comparisons needed for deep analysis: the original breaking change and the full cumulative change.
    *   **Acceptance Criteria:**
        *   A new command-line flag, `--analyze-regression`, is added to `snapshot.js`.
        *   When `node snapshot.js NNNN --analyze-regression` is run, the tool must locate the snapshot folder for `NNNN`.
        *   The tool must then programmatically find the folder for the next sequential snapshot, `NNNN+1`.
        *   The tool must handle the edge case where `NNNN` is the latest snapshot and no successor exists, exiting gracefully with an informative message.
        *   The system will use the flexible `compareSnapshots` function (from Epic 1) to perform **two** separate diffs:
            1.  A "Causal Diff" between snapshot `NNNN` and snapshot `NNNN+1`.
            2.  A "Cumulative Diff" between snapshot `NNNN` and the current working directory.
        *   The data from both diffs must be captured and passed to the prompting engine.

*   **User Story 3.2: Generate a Two-Part "Smart Prompt"**
    *   **As a user,** I want the `--analyze-regression` command to produce a single text file containing a structured, two-part prompt that guides an LLM to first identify the root cause of a bug and then formulate a solution for the current codebase.
    *   **Acceptance Criteria:**
        *   A new prompt generation function is created that can accept and process two distinct diff datasets.
        *   The generated text file starts with a clear header and mission statement (e.g., "AI Regression Analysis").
        *   The file contains two clearly demarcated sections:
            *   **Section 1: The Immediate Breaking Change (Snapshot N vs. N+1):** This section will contain the formatted diff output for the Causal Diff.
            *   **Section 2: The Full Picture (Snapshot N vs. Current):** This section will contain the formatted diff output for the Cumulative Diff.
        *   Each section uses the same clear formatting defined in Epic 2 (Markdown diff blocks, lists of added/removed files, etc.).
        *   The prompt concludes with a specific task for the LLM, instructing it to use Section 1 to find the likely cause and Section 2 to formulate a fix for the code as it exists now.

---

This epic builds directly on the foundation of Epics 1 and 2 and delivers the highly intelligent, workflow-aware feature we discussed. It transforms the tool from a manual utility into an automated analysis partner.