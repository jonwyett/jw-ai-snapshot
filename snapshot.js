// snapshot.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Sanitize labels: lowercase, replace spaces, strip unsafe chars
function sanitizeLabel(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');
}

function padNumber(num, width) {
  return num.toString().padStart(width, '0');
}

function getNextSnapshotIndex(snapshotPath) {
  if (!fs.existsSync(snapshotPath)) {
    return 1;
  }
  var dirs = fs.readdirSync(snapshotPath).filter(function (name) {
    return /^(\d+)_/.test(name);
  });
  var max = dirs.reduce(function (highest, name) {
    var num = parseInt(name.match(/^(\d+)_/)[1], 10);
    return num > highest ? num : highest;
  }, 0);
  return max + 1;
}

function loadIgnoreList(projectRoot) {
  var ignorePath = path.join(projectRoot, '.snapshotignore');
  var ignoreSet = new Set();
  if (fs.existsSync(ignorePath)) {
    var lines = fs.readFileSync(ignorePath, 'utf8').split(/\r?\n/);
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      ignoreSet.add(trimmed.replace(/\/+$/, ''));
    });
  }
  // Always ignore snapshots folder
  ignoreSet.add('__snapshots__');
  return ignoreSet;
}

function isIgnored(relPath, ignoreSet) {
  var normalized = relPath.replace(/\\/g, '/');
  for (var pattern of ignoreSet) {
    if (normalized === pattern || normalized.startsWith(pattern + '/')) {
      return true;
    }
  }
  return false;
}

function listFilesRecursively(dir, base, ignoreSet) {
  if (base === undefined) base = dir;
  if (ignoreSet === undefined) ignoreSet = new Set();
  var fileList = [];
  var items = fs.readdirSync(dir);
  items.forEach(function (item) {
    var fullPath = path.join(dir, item);
    var relPath = path.relative(base, fullPath).replace(/\\/g, '/');
    // Always skip snapshots directory
    if (relPath === '__snapshots__' || relPath.startsWith('__snapshots__/')) {
      return;
    }
    if (isIgnored(relPath, ignoreSet)) {
      return;
    }
    var stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fileList = fileList.concat(listFilesRecursively(fullPath, base, ignoreSet));
    } else {
      fileList.push(relPath);
    }
  });
  return fileList;
}

function hashFile(filePath) {
  var data = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(data).digest('hex');
}

function compareSnapshots(snapshotPath, currentPath, ignoreSet) {
  var result = {
    base: path.basename(snapshotPath),
    compare: 'current',
    files: []
  };

  var snapshotFiles = listFilesRecursively(snapshotPath, snapshotPath, ignoreSet);
  var currentFiles = listFilesRecursively(currentPath, currentPath, ignoreSet);
  var allFiles = new Set(snapshotFiles.concat(currentFiles));

  allFiles.forEach(function (relPath) {
    var inSnap = snapshotFiles.includes(relPath);
    var inCurr = currentFiles.includes(relPath);
    var snapFile = path.join(snapshotPath, relPath);
    var currFile = path.join(currentPath, relPath);

    if (inSnap && !inCurr) {
      result.files.push({ file: relPath, status: 'removed' });
    } else if (!inSnap && inCurr) {
      result.files.push({ file: relPath, status: 'added' });
    } else if (inSnap && inCurr) {
      var snapHash = hashFile(snapFile);
      var currHash = hashFile(currFile);
      if (snapHash !== currHash) {
        var snapLines = fs.readFileSync(snapFile, 'utf8').split(/\r?\n/).length;
        var currLines = fs.readFileSync(currFile, 'utf8').split(/\r?\n/).length;
        var delta = Math.abs(currLines - snapLines);
        result.files.push({ file: relPath, status: 'modified', lines_changed: delta });
      }
    }
  });

  return result;
}

function appendToLog(snapshotRoot, prefix, label, folderName) {
  var logPath = path.join(snapshotRoot, 'snapshot.log');
  var timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
  var logEntry = '[' + prefix + '] ' + timestamp + ' - "' + label + '"\n-> ' + folderName + '\n\n';
  fs.appendFileSync(logPath, logEntry, 'utf8');
}

function savePrompt(diffData, index, snapshotName, snapshotDir) {
  var lines = [
    '🧠 Snapshot Regression Summary: ' + index + '_' + snapshotName,
    '',
    'These files have changed since this working snapshot. Please review them to identify what may have broken:',
    '',
    JSON.stringify({ files: diffData.files }, null, 2),
    ''
  ];
  var outputPath = path.join(snapshotDir, 'prompt_' + index + '_restore.txt');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log('✅ Prompt saved to ' + outputPath);
}

function restoreSnapshot(snapshotPath, currentPath, ignoreSet, dryRun) {
  if (dryRun === undefined) dryRun = false;
  var snapshotFiles = listFilesRecursively(snapshotPath, snapshotPath, ignoreSet);
  var restored = 0, skipped = 0;

  snapshotFiles.forEach(function (relPath) {
    var snapFile = path.join(snapshotPath, relPath);
    var destFile = path.join(currentPath, relPath);
    var snapHash = hashFile(snapFile);
    var destHash = fs.existsSync(destFile) ? hashFile(destFile) : null;
    if (snapHash === destHash) {
      skipped++;
      return;
    }
    if (dryRun) {
      console.log('Would restore: ' + relPath);
    } else {
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(snapFile, destFile);
      console.log('Restored: ' + relPath);
    }
    restored++;
  });

  // delete extraneous
  var currentFiles = listFilesRecursively(currentPath, currentPath, ignoreSet);
  var toDelete = currentFiles.filter(function (relPath) {
    return !snapshotFiles.includes(relPath);
  });
  var deleted = 0;

  toDelete.forEach(function (relPath) {
    var fullPath = path.join(currentPath, relPath);
    if (dryRun) {
      console.log('Would delete: ' + relPath);
    } else {
      fs.unlinkSync(fullPath);
      console.log('Deleted: ' + relPath);
    }
    deleted++;
  });

  console.log(
    '\n' +
    (dryRun ? '🧪 Dry run complete.' : '♻️ Restore complete.') +
    ' ' + restored + ' file(s) ' +
    (dryRun ? 'would be restored' : 'restored') +
    ', ' + skipped + ' skipped, ' +
    deleted + ' ' +
    (dryRun ? 'would be deleted' : 'deleted') +
    '.'
  );
}

// CLI entrypoint
function run() {
  var args = process.argv.slice(2);
  var hasDiff = args.includes('--diff');
  var hasPrompt = args.includes('--prompt');
  var hasRestore = args.includes('--restore');
  var isDryRun = args.includes('--dry-run');
  var labelArgs = args.filter(function (arg) { return !arg.startsWith('--'); });
  var projectRoot = process.cwd();
  var snapshotsRoot = path.join(projectRoot, '__snapshots__');

  if (!fs.existsSync(snapshotsRoot)) fs.mkdirSync(snapshotsRoot);

  if ((hasDiff || hasPrompt || hasRestore) && labelArgs.length === 0) {
    console.error('❌ Please specify a snapshot index for --diff/--prompt/--restore');
    process.exit(1);
  }

  if (hasDiff || hasPrompt || hasRestore) {
    var index = labelArgs[0].padStart(4, '0');
    var matchingFolder = fs.readdirSync(snapshotsRoot)
      .find(function (f) { return f.startsWith(index + '_'); });
    if (!matchingFolder) {
      console.error('❌ Snapshot folder not found for index ' + index);
      process.exit(1);
    }
    var snapshotPath = path.join(snapshotsRoot, matchingFolder);
    var ignoreSet = loadIgnoreList(projectRoot);

    if (hasRestore) {
      console.log('♻️ Restoring snapshot: ' + matchingFolder + (isDryRun ? ' (dry run)' : ''));
      restoreSnapshot(snapshotPath, projectRoot, ignoreSet, isDryRun);
      return;
    }

    console.log('📂 Found snapshot: ' + matchingFolder);
    console.log('🔍 Comparing against current working directory...');
    var diffData = compareSnapshots(snapshotPath, projectRoot, ignoreSet);
    var diffOutputPath = path.join(snapshotsRoot, 'diff_' + index + '_to_current.json');
    fs.writeFileSync(diffOutputPath, JSON.stringify(diffData, null, 2));
    console.log('✅ Diff complete. Saved to ' + diffOutputPath);

    if (hasPrompt) {
      savePrompt(diffData, index, matchingFolder.replace(index + '_', ''), snapshotsRoot);
    }
    return;
  }

  // Create new snapshot
  if (labelArgs.length === 0) {
    console.error('❌ Please provide a snapshot label or use --diff/--prompt/--restore with a snapshot index.');
    process.exit(1);
  }
  var labelRaw = labelArgs.join(' ');
  var label = sanitizeLabel(labelRaw);
  var nextIndex = getNextSnapshotIndex(snapshotsRoot);
  var prefix = padNumber(nextIndex, 4);
  var folderName = prefix + '_' + label;
  var snapshotDir = path.join(snapshotsRoot, folderName);

  console.log('📸 Creating snapshot: ' + snapshotDir);
  var ignoreSet = loadIgnoreList(process.cwd());

  function copyDir(src, dest, excludeSet, base) {
    if (base === undefined) base = src;
    var items = fs.readdirSync(src);
    items.forEach(function (item) {
      var srcPath = path.join(src, item);
      var relPath = path.relative(base, srcPath).replace(/\\/g, '/');
      if (path.basename(srcPath) === '__snapshots__' || isIgnored(relPath, excludeSet)) {
        return;
      }
      var stats = fs.statSync(srcPath);
      var destPath = path.join(dest, item);
      if (stats.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyDir(srcPath, destPath, excludeSet, base);
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  copyDir(process.cwd(), snapshotDir, ignoreSet);
  appendToLog(snapshotsRoot, prefix, labelRaw, folderName);
  console.log('✅ Snapshot complete.');
}

// Export helpers for unit tests
module.exports = {
  sanitizeLabel,
  padNumber,
  getNextSnapshotIndex,
  loadIgnoreList,
  isIgnored,
  listFilesRecursively,
  compareSnapshots,
  restoreSnapshot,
  savePrompt,
  appendToLog
};

// Only run CLI when called directly
if (require.main === module) {
  run();
}
