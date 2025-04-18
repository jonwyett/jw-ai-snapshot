🧠 Snapshot.js

A lightweight, developer-friendly tool for creating, analyzing, and restoring **AI-assisted project snapshots**.

Designed to support iterative, AI-powered development workflows, `snapshot.js` allows you to:

- 📸 Save snapshots of your project folder at key milestones (primary feature)
- 🔍 Compare snapshots against the current state to detect regressions (experimental / early feature)
- 🤖 Generate human- and AI-readable summaries of what changed (basic functionality in place, evolving)
- ♻️ Restore your project to a previous snapshot state (new functionality)

Intended for developers using integrated AI-coding tools like Cursor.ai to maintain or repair their codebase.

> ⚠️ Snapshot creation is production-ready. The diff, prompt, and restore features are in early development—they provide useful insights and rollback capabilities but are not a replacement for full version control.

---

## ✨ Features

- 📸 **Save full project snapshots** (excluding ignored files)
- 🔍 **Compare a snapshot to the current directory** and summarize changes
- 🤖 **Generate AI-ready prompts** to help identify or restore broken behavior
- ♻️ **Restore project files** from a previous snapshot, with optional dry-run mode

---

## 📦 Installation

No installation required. Just drop `snapshot.js` into your project root and run it using Node.js:

```bash
node snapshot.js "feature label"
```

---

## 📂 Snapshots

When you create a snapshot, it saves a copy of the project (minus ignored files) into a `_snapshots/` folder, like this:

```
_snapshots/
├── 0001_initial_setup/
├── 0002_login_form/
├── snapshot.log
```

Each snapshot is automatically numbered for easy reference.

---

## 🚫 Ignoring Files

Use a `.snapshotignore` file (similar to `.gitignore`) to exclude folders and files from being backed up, compared, or restored.

Example:

```
node_modules/
.env
_snapshots/
snapshot.js
.vscode/
```

---

## 🚀 Commands

### 1. Create a Snapshot

```bash
node snapshot.js "short description"
```

- Creates a new numbered folder in `_snapshots/`
- Excludes files/folders listed in `.snapshotignore`
- Logs the snapshot in `_snapshots/snapshot.log`

### 2. Diff a Snapshot

```bash
node snapshot.js 0014 --diff
```

- Compares snapshot `0014_*` to the current working directory
- Outputs JSON to `_snapshots/diff_0014_to_current.json`
- Lists files added, removed, or modified, with line‑change counts

### 3. Generate an AI Prompt

```bash
node snapshot.js 0014 --prompt
```

- Runs the same diff as `--diff`
- Generates `_snapshots/prompt_0014_restore.txt`
- Contains a natural‑language summary and the JSON diff

### 4. Restore a Snapshot

```bash
node snapshot.js 0014 --restore
```

- Restores files from snapshot `0014_*` into the current directory
- Skips files that are unchanged
- Use `--dry-run` to list what would be restored without overwriting files


---

## 🔍 Example Workflow

1. Work on your project as usual
2. When a feature works, create a snapshot:
   ```bash
   node snapshot.js "add login support"
   ```
3. Later, if something breaks, find the last working snapshot
4. Run:
   ```bash
   node snapshot.js 0014 --prompt
   ```
5. Feed the prompt file into your AI tool and let it guide the fix
6. If you need to rollback:
   ```bash
   node snapshot.js 0014 --restore
   ```

---

## 🧠 Philosophy

This tool is built with an AI-first mindset:
- **Summary + context**: designed for how LLMs think
- **Frictionless rollbacks**: restore previous states quickly
- **Simplicity & speed**: not a full VCS, but perfect for AI‑powered iteration

---

## 🛠️ License

MIT. Use it, modify it, build on it.

