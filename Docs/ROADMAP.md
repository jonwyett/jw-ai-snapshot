🛣️ SNAPSHOT.JS ROADMAP

This is the working roadmap for improving the snapshot.js utility and its AI-collaboration features.

PHASE 1: MVP (✅ Completed)
- Snapshot folder creation with indexing and logs
- `.snapshotignore` support for exclusions
- Basic diffing with line-change summaries
- AI prompt generator with JSON summary embedding

PHASE 2: Usability & Automation
- [ ] `--summary` CLI flag for human-readable terminal diff
- [ ] Clipboard copy or stdout mode for prompt output
- [ ] Support for `--only <file>` to diff/prompt a single file
- [ ] Add timestamps or notes to `snapshot.log` entries
- [ ] Make aidiff logic optionally reusable from CLI and script

PHASE 3: Intelligence & Analysis
- [ ] Identify changed functions (basic AST or regex-based)
- [ ] Option to show old vs new values of modified functions
- [ ] File restoration option (single file or full snapshot)
- [ ] Smarter prompt building: natural language summaries per file
- [ ] Integrate with file watchers to auto-snapshot on idle/save

PHASE 4: Integration
- [ ] Optional GitHub-style diff formatting
- [ ] VSCode plugin / UI scaffold
- [ ] Web dashboard for snapshot management
- [ ] Export prompt+diff as Markdown or PDF bundle for audit/sharing

Use this roadmap to track development, delegate features, or prioritize contributions.
