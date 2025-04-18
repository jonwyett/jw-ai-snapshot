You are an AI development assistant helping build **snapshot.js**, a Node.js CLI tool for creating and managing lightweight, timestamped project snapshots to support AI‑assisted iterative development workflows.

---

## Project Overview

**Purpose:**  
snapshot.js lets developers capture, compare, summarize, and restore full snapshots of their working project directory—excluding ignored files—so they can safely experiment with AI-generated code and quickly revert or diagnose regressions.

---

## Current Features & Status

1. **Snapshot Creation (✅ Production‑ready)**  
   - **Command:**  
     ```bash
     node snapshot.js "short description"
     ```  
   - Copies project files (excluding patterns in `.snapshotignore` and the `_snapshots/` folder) into `_snapshots/NNNN_label/`.  
   - Auto‑numbers snapshots (`0001_initial_setup`, `0002_feature_xyz`, …).  
   - Appends a timestamped entry to `_snapshots/snapshot.log`.  
   - Labels are sanitized: lowercased, spaces → `_`, non‑alphanumeric stripped.

2. **Diffing (🔧 Experimental)**  
   - **Command:**  
     ```bash
     node snapshot.js 0002 --diff
     ```  
   - Compares snapshot `0002_label/` against the current working directory.  
   - Produces `_snapshots/diff_0002_to_current.json` listing each file’s status (`added` / `removed` / `modified`) and line‑count delta for modifications.

3. **Prompt Generation (🔧 Experimental)**  
   - **Command:**  
     ```bash
     node snapshot.js 0002 --prompt
     ```  
   - Runs the same diff and writes `_snapshots/prompt_0002_restore.txt`, an AI‑readable summary with the JSON diff embedded.

4. **Restore with Pruning (✅ Newly Added)**  
   - **Command:**  
     ```bash
     node snapshot.js 0002 --restore [--dry-run]
     ```  
   - Copies back any files that have been deleted or modified since `0002`.  
   - **Deletes** extraneous files not present in the snapshot.  
   - `--dry-run` logs would‑restore and would‑delete actions without changing the filesystem.

5. **Unit & Integration Tests (✅ Complete)**  
   - **Integration tests** cover end‑to‑end CLI flows (create, diff, prompt, restore, dry‑run).  
   - **Unit tests** cover helper functions:  
     - `sanitizeLabel`, `padNumber`,  
     - `getNextSnapshotIndex`,  
     - `loadIgnoreList`, `isIgnored`,  
     - `listFilesRecursively`.  

---

## Design Philosophy

- **AI‑First, Human‑Friendly:** Snapshots + context summaries designed to map directly into LLM prompts.  
- **Simplicity & Speed:** Minimal dependencies, synchronous operations for now, zero setup.  
- **Complementary to Git:** Not a replacement for full VCS—best for rapid, ad‑hoc rollback when iterating with AI.  
- **Test‑Driven:** Core logic is covered by unit tests; critical flows validated by integration tests.

---

## Developer Workflows

1. **Snapshot a Working State**  
   ```bash
   node snapshot.js "add login support"
   ```
2. **Experiment & Break**  
   – Make changes, run tests, notice regressions.  
3. **Inspect Changes**  
   ```bash
   node snapshot.js 0003 --diff
   node snapshot.js 0003 --prompt
   ```  
   – Diff JSON shows file‑level changes; prompt file gives LLM‑friendly summary.  
4. **Restore Clean Baseline**  
   ```bash
   node snapshot.js 0003 --restore
   ```  
   – Returns to known working snapshot, pruning any stray artifacts.  
5. **Iterate & Repeat**

---

## Current Priorities & Planned Improvements

1. **Performance & Robustness**  
   - Convert file lists to `Set` for O(1) lookups.  
   - Stream hashing (async) to handle large files.  
   - Migrate to async FS operations where feasible.

2. **Modularization & CLI UX**  
   - Split code into `lib/` modules (`cli.js`, `snapshot.js`, `diff.js`, `restore.js`).  
   - Adopt Commander.js or Yargs for subcommands (`create`, `diff`, `prompt`, `restore`, `list`, `delete`), built‑in help/version.

3. **New CLI Commands**  
   - **`list`**: show snapshot index, label, timestamp.  
   - **`delete <index>`**: remove snapshot folder and clear log entry.

4. **Enhanced Diff Analysis**  
   - Integrate a true line‑level diff library (jsdiff) to report insertions/deletions with context.  
   - Detect and skip binary files.

5. **Semantic Summaries**  
   - Hook into an LLM API to transform raw JSON diffs into natural‑language change logs.  
   - Support custom prompt templates via `.snapshotrc`.

6. **Interactive & Patch‑Based Restore**  
   - Prompt user to selectively restore specific files.  
   - Generate and apply unified‑diff patches instead of full file copy.

7. **Integration & Extensions**  
   - Expose HTTP/JSON API for IDE or CI integration.  
   - Scaffold a VSCode extension or simple web dashboard for browsing snapshots and diffs.
