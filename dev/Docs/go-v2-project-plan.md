Excellent. I have reviewed both the `v2.0` feature-complete `snapshot.js` and the older `snapshot.go.txt`. The gap is clear, and our path forward is well-defined.

As per our hybrid strategy, here is the comprehensive **Go v2.0 Implementation Plan**. This document contains all the context, design decisions, and technical guidance your coding LLM will need to perform the upgrade interactively with you.

---

### **Go v2.0 Implementation Plan**

This document provides a complete technical guide for upgrading the Go version of `jw-ai-snapshot` to be in full feature-parity with the Node.js `v2.0.0` implementation.

### **Part 1: Core Project Mission & Changelog**

*The following context should be given to the LLM at the start of the session to ensure it understands the project's philosophy and goals.*

**(Context Block 1: PROJECT_OVERVIEW.md)**
> `jw-ai-snapshot` is a lightweight, local file-system snapshotting utility designed to accelerate and de-risk AI-assisted development. It is a high-velocity companion to `git`, not a replacement. The ultimate goal is a standalone, cross-platform binary compiled from Go. Therefore, the Go implementation is the final deliverable, and every feature must be translatable to idiomatic Go. Dependency choices should be minimal and well-vetted.

**(Context Block 2: CHANGELOG.md for v2.0.0)**
> The goal of this task is to implement all `v2.0.0` changes in the Go version. This includes several **breaking changes**. The old system of interactive configuration on first run is GONE. It is replaced by a mandatory `init` command. The `.snapshotignore` file format is now a two-section file and is the single source of truth for ignore overrides. The `diff` engine is now line-by-line, and there is a new flagship feature: `--analyze-regression`.

---

### **Part 2: Technical Implementation Plan**

*This section should be used to guide the LLM piece-by-piece through the implementation.*

#### **Phase 1: Project Structure & CLI Parsing**

**Goal:** Establish the new command structure and deprecate the old, complex argument parsing.

1.  **Use Go's `flag` package.** Set up subcommands for `init`, `diff`, `restore`, and `analyze-regression`. The default action (no subcommand) will be to create a snapshot.
2.  **CLI Argument Structure:**
    *   `snapshot init`
    *   `snapshot <label>`
    *   `snapshot diff <index> [optional_index]`
    *   `snapshot restore <index>`
    *   `snapshot analyze-regression <index>`
    *   Add boolean flags: `--dry-run`, `--dev-mode`, `--help`.
3.  **Delete `interactiveConfiguration`:** The entire `interactiveConfiguration` function and its related config-setting functions in the old Go code are obsolete and should be **deleted**.

#### **Phase 2: Implement the `init` Command**

**Goal:** Create the new mandatory setup command.

1.  **Check for existing `.snapshotignore`:** If the file exists, print an error and exit.
2.  **Generate the `.snapshotignore` content:** Create a multi-line string variable in Go that contains the exact, well-commented content of the new two-section `.snapshotignore` file.
3.  **Write the file:** Use `os.WriteFile` to create `.snapshotignore`.
4.  **Handle `.gitignore` (No interaction):**
    *   Check if `.gitignore` exists.
    *   Read its content. If `__snapshots__/` is not present, append it with a helpful comment.
    *   If `.gitignore` doesn't exist, create it with the `__snapshots__/` entry.
5.  **Provide clear output:** Print confirmations to the user about what was created.

#### **Phase 3: Overhaul the Ignore Logic**

**Goal:** Implement the new two-section parser.

1.  **Create a new `loadIgnorePatterns` function:**
    *   **Input:** `projectRoot string`
    *   **Output:** `ignoreList []string`, `exceptionList []string`, `error`
2.  **Read `.gitignore` first:** This will form the base of the `ignoreList`.
3.  **Parse `.snapshotignore`:**
    *   Use `bufio.Scanner` to read the file line by line.
    *   Use a state variable (`var currentSection string`) to track whether you are in the `ALWAYS` or `NEVER` section.
    *   When you see a line containing `## ALWAYS SNAPSHOT`, set `currentSection = "always"`.
    *   When you see `## NEVER SNAPSHOT`, set `currentSection = "never"`.
    *   Ignore empty lines and lines that are purely comments (`#`).
    *   If `currentSection` is "always", add the pattern to the `exceptionList`.
    *   If `currentSection` is "never", add the pattern to the `ignoreList`.
4.  **Create the final `isIgnored` function:**
    *   **Recommendation:** Use a battle-tested Go library that understands `.gitignore` patterns and exception handling. The `github.com/sabhiram/go-gitignore` package is an excellent choice.
    *   **Logic:**
        1.  Initialize the gitignore object: `ignore := gitignore.CompileIgnoreLines(ignoreList...)`
        2.  Initialize the exception object: `exceptions := gitignore.CompileIgnoreLines(exceptionList...)`
        3.  The final check becomes: `if exceptions.MatchesPath(path) { return false } else { return ignore.MatchesPath(path) }`. An exception always wins.

#### **Phase 4: Upgrade the `diff` Engine**

**Goal:** Implement line-by-line diffing.

1.  **Choose a Diff Library:** The `github.com/sergi/go-diff` library is a solid choice that mirrors the functionality of `diff` in Node.js.
2.  **Update `compareSnapshots` function:**
    *   When a file is identified as `modified` (hashes don't match):
        *   Read the content of both files (`os.ReadFile`).
        *   Use `diff.GetUnifiedDiffString` to generate a diff patch.
        *   Store this patch string in the `DiffFile` struct. The struct should be updated to include a `Diff string` field.
    *   When a file is `added` or `removed`, **do not** include its content. Only the filename and status are needed.
3.  **Update `savePrompt`:** Refactor this function to parse the enhanced `DiffResult` and generate the clean, multi-section Markdown prompt as seen in the Node.js version.

#### **Phase 5: Implement `analyze-regression`**

**Goal:** Implement the flagship analysis feature.

1.  **Create `findSnapshotByIndex` helper function:** This function will be needed to locate the folders for both `N` and `N+1`.
2.  **Orchestrate the logic:**
    *   Find the base snapshot path (`N`).
    *   Find the next sequential snapshot path (`N+1`). Handle the error if it doesn't exist.
    *   Call `compareSnapshots` twice:
        1.  `causalDiff := compareSnapshots(path_N, path_N+1, ...)`
        2.  `cumulativeDiff := compareSnapshots(path_N, projectRoot, ...)`
    *   Create a new function `saveRegressionAnalysisPrompt` that takes both diff results and generates the two-part Markdown file, just like the Node.js version.

#### **Phase 6: Implement the Change Manifest Log**

**Goal:** Replace the old logging with the new summary log.

1.  **Delete `appendToLog`:** The old function is obsolete.
2.  **Create `appendChangeManifest`:**
    *   This function is called only at the end of a successful snapshot creation.
    *   It finds the previous snapshot index (`N-1`).
    *   It runs a `compareSnapshots` between `N-1` and the newly created snapshot `N`.
    *   It formats the results into the clean, human-readable text block (Changed/Added/Removed lists with truncation) and appends it to `snapshot.log`.

---

This implementation plan provides the perfect roadmap for your interactive coding session. Good luck