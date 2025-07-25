✅ QUICK START CHECKLIST

This checklist helps you restart work with `snapshot.js` quickly and confidently.

1. ⬇️ Clone or open the project folder
2. 📁 Ensure the following files are present:
   - snapshot.js
   - .snapshotignore
   - _snapshots/ (folder)
   - README.md
   - CONTEXT.txt
3. 🧪 Test snapshot creation:
   ```bash
   node snapshot.js "test snapshot"
   ```
   Confirm a new `_snapshots/` folder appears with numbered prefix.
4. 📄 Review `.snapshotignore` to make sure exclusions are correct
5. 🔍 Run a diff (if snapshot already exists):
   ```bash
   node snapshot.js 0007 --diff
   ```
6. 🤖 Try generating a prompt for AI assistance:
   ```bash
   node snapshot.js 0007 --prompt
   ```
7. 🛠️ Modify snapshot.js or extend its features based on roadmap
8. 🧠 Refer to CONTEXT.txt anytime for full system goals + philosophy

Happy building!
