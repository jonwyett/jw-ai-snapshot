#### **Epic 4: Implement a Human-Readable "Change Manifest" Log**

**Goal:** To replace the existing logging functionality with a clean, human-readable "Change Manifest" that is automatically generated with each snapshot. The manifest's sole purpose is to help a developer quickly scan the project's history to identify snapshots of interest for a more detailed analysis.

*   **User Story 4.1: Generate a Formatted Text Log of Snapshot Changes**
    *   **As a developer,** I want each snapshot creation to automatically append a formatted, human-readable summary of file changes to a central log file, so I can easily find the snapshot where a specific file was altered.
    *   **Acceptance Criteria:**
        1.  The log file will be a plain text file located at `__snapshots__/snapshot.log`.
        2.  When a new snapshot is created (e.g., `0002_label`), it is automatically compared against the previous snapshot (`0001_...`).
        3.  The output appended to the log for each snapshot will follow this exact format:

            ```text
            [0002] 2025-07-25 16:30:10 - "Refactor API client"
            
            Changed:
              - src/api/client.js
              - components/common/Button.js
            Added:
              - src/api/newEndpoint.js
            Removed:
              - src/api/oldClient.js
            
            ----------------------------------------
            ```

        4.  If a change category (e.g., `Added:`) has no files, that section is omitted from the entry to keep the log clean.
        5.  For the very first snapshot, the entry will simply state "Initial snapshot" with a list of all files under an "Added:" category.
        6.  **To ensure scannability,** if any category contains more than a small number of files (e.g., 10), the log will list the first 10 and add a summary line, like `...and 17 more modified files.`
        7.  The existing `appendToLog` function and its old format are completely removed and replaced by this new logic.

