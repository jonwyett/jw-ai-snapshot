// snapshot.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const SNAPSHOTS_DIR_NAME = '__snapshots__';
const GITIGNORE_ENTRY = `${SNAPSHOTS_DIR_NAME}/`;
const ADD_TO_GITIGNORE_FLAG_KEY = '# ADD_TO_GITIGNORE=';
const USE_GITIGNORE_FLAG_KEY = '# USE_GITIGNORE=';

// Helper function to ask a question and get an answer asynchronously
function askUser(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => {
        rl.question(query, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

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

function getSnapshotignoreConfig(projectRoot) {
    const snapshotignorePath = path.join(projectRoot, '.snapshotignore');
    let config = {
        manageGitignoreEntry: true,     // Default to TRUE for managing __snapshots__/ in .gitignore
        useGitignorePatterns: null,   // Default to NULL (not set) for using .gitignore patterns
        manageGitignoreEntryIsSet: false,
        useGitignorePatternsIsSet: false
    };

    if (fs.existsSync(snapshotignorePath)) {
        const lines = fs.readFileSync(snapshotignorePath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            if (line.startsWith(ADD_TO_GITIGNORE_FLAG_KEY)) {
                config.manageGitignoreEntry = line.substring(ADD_TO_GITIGNORE_FLAG_KEY.length).toUpperCase() === 'TRUE';
                config.manageGitignoreEntryIsSet = true;
            } else if (line.startsWith(USE_GITIGNORE_FLAG_KEY)) {
                config.useGitignorePatterns = line.substring(USE_GITIGNORE_FLAG_KEY.length).toUpperCase() === 'TRUE';
                config.useGitignorePatternsIsSet = true;
            }
        }
    }
    return config;
}

function setSnapshotignoreConfig(projectRoot, config) {
    const snapshotignorePath = path.join(projectRoot, '.snapshotignore');

    const manageEntryVal = config.manageGitignoreEntry;
    // Ensure useGitignorePatterns is boolean if it was set, otherwise keep it as is if it was null and not changed
    const usePatternsVal = typeof config.useGitignorePatterns === 'boolean' ? config.useGitignorePatterns : (getSnapshotignoreConfig(projectRoot).useGitignorePatterns || false);


    const manageEntryFlagContent = `${ADD_TO_GITIGNORE_FLAG_KEY}${manageEntryVal ? 'TRUE' : 'FALSE'}`;
    const usePatternsFlagContent = `${USE_GITIGNORE_FLAG_KEY}${usePatternsVal ? 'TRUE' : 'FALSE'}`;

    let lines = [];
    let fileExisted = fs.existsSync(snapshotignorePath);

    if (fileExisted) {
        lines = fs.readFileSync(snapshotignorePath, 'utf8').split(/\r?\n/);
    }

    let manageEntryFlagIndex = -1;
    let usePatternsFlagIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(ADD_TO_GITIGNORE_FLAG_KEY)) {
            manageEntryFlagIndex = i;
        } else if (lines[i].startsWith(USE_GITIGNORE_FLAG_KEY)) {
            usePatternsFlagIndex = i;
        }
    }

    if (manageEntryFlagIndex !== -1) {
        lines[manageEntryFlagIndex] = manageEntryFlagContent;
    } else {
        lines.unshift(manageEntryFlagContent); // Add to the beginning if not found
    }

    if (usePatternsFlagIndex !== -1) {
        lines[usePatternsFlagIndex] = usePatternsFlagContent;
    } else {
        // Insert after ADD_TO_GITIGNORE or at the beginning
        const insertAfterIndex = lines.findIndex(line => line.startsWith(ADD_TO_GITIGNORE_FLAG_KEY));
        if (insertAfterIndex !== -1 && insertAfterIndex < lines.length -1 && lines[insertAfterIndex+1].trim() === '') {
             lines.splice(insertAfterIndex + 1, 0, usePatternsFlagContent); // insert before blank line
        } else if (insertAfterIndex !== -1) {
            lines.splice(insertAfterIndex + 1, 0, usePatternsFlagContent);
        }
        else {
            lines.unshift(usePatternsFlagContent);
        }
    }
    
    // Remove duplicate empty lines that might be introduced if flags were added.
    let finalOutputLines = [];
    for(let i=0; i<lines.length; i++) {
        if(i > 0 && lines[i].trim() === '' && lines[i-1].trim() === '') {
            // skip duplicate blank line
        } else {
            finalOutputLines.push(lines[i]);
        }
    }


    let finalContent = finalOutputLines.join('\n');
    if (finalContent.length > 0 && !finalContent.endsWith('\n\n') && finalContent.endsWith('\n') ) {
        // If it ends with a single newline, that's fine
    } else if (finalContent.length > 0 && !finalContent.endsWith('\n')) {
        finalContent += '\n'; // Ensure at least one trailing newline
    }


    fs.writeFileSync(snapshotignorePath, finalContent, 'utf8');
}


async function interactiveConfiguration(projectRoot) {
    let config = getSnapshotignoreConfig(projectRoot);
    let configChangedThisSession = false;

    //console.log("\n--- Snapshot.js Configuration Check ---");

    // --- Feature 1: Using .gitignore patterns for snapshot ignores ---
    if (!config.useGitignorePatternsIsSet) {
        console.log("\n❓ Setting: Should snapshots also ignore file/folder patterns from your project's '.gitignore'?");
        console.log("   (Example: node_modules, .env, build outputs are often in .gitignore)");
        console.log("   1. YES - Exclude '.gitignore' patterns from snapshots (recommended).");
        console.log("   2. NO  - Only use '.snapshotignore' patterns for snapshot exclusions.");

        let choice = '';
        while (!['1', '2'].includes(choice)) {
            choice = await askUser("   Your choice for using .gitignore patterns (1 or 2): ");
            if (!['1', '2'].includes(choice)) console.log("     Invalid choice. Please enter 1 or 2.");
        }
        config.useGitignorePatterns = (choice === '1');
        config.useGitignorePatternsIsSet = true;
        configChangedThisSession = true;
        console.log(`   => Decision: Snapshots will ${config.useGitignorePatterns ? "now" : "not"} use '.gitignore' patterns. This is saved in '.snapshotignore'.`);
    }

    // --- Feature 2: Managing '__snapshots__/' entry in project's .gitignore ---
    const projectGitignorePath = path.join(projectRoot, '.gitignore');
    const projectGitignoreExists = fs.existsSync(projectGitignorePath);
    let projectGitignoreContent = projectGitignoreExists ? fs.readFileSync(projectGitignorePath, 'utf8') : '';
    
    const snapshotsDirRegex = new RegExp(`^${GITIGNORE_ENTRY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('/', '\\/')}\\s*$`, 'm');
    const snapshotsDirAlreadyInGitignore = projectGitignoreExists && snapshotsDirRegex.test(projectGitignoreContent);

    if (snapshotsDirAlreadyInGitignore) {
        if (config.manageGitignoreEntry) { // If our flag was true, but it's already handled
            console.log(`\nℹ️ Setting: Ensuring '${SNAPSHOTS_DIR_NAME}/' is in your project's '.gitignore'.`);
            console.log(`   Status: '${GITIGNORE_ENTRY}' is already present in project's '.gitignore'.`);
            config.manageGitignoreEntry = false; // Disable future checks/prompts for this
            config.manageGitignoreEntryIsSet = true;
            configChangedThisSession = true;
            console.log(`   => Action: No changes needed to '.gitignore'. Future prompts for this are now disabled in '.snapshotignore'.`);
        }
    } else if (config.manageGitignoreEntry) { // Not in project's .gitignore, AND our flag says we should manage it
        if (!projectGitignoreExists) {
            console.log(`\nℹ️ Setting: Ensuring '${SNAPSHOTS_DIR_NAME}/' is in your project's '.gitignore'.`);
            console.log(`   Status: Your project does not have a '.gitignore' file.`);
            config.manageGitignoreEntry = false; // Can't add, so disable future checks
            config.manageGitignoreEntryIsSet = true;
            configChangedThisSession = true;
            console.log(`   => Action: Cannot add '${GITIGNORE_ENTRY}'. Future prompts for this are now disabled in '.snapshotignore'.`);
        } else {
            // Project .gitignore exists, but __snapshots__/ is not in it. Time to prompt!
            console.log(`\n❓ Setting: Add snapshot directory ('${SNAPSHOTS_DIR_NAME}/') to your project's '.gitignore'?`);
            console.log(`   (This is recommended to prevent committing local snapshots to your Git repository).`);
            console.log(`   1. YES - Add '${GITIGNORE_ENTRY}' to '.gitignore' (and don't ask again for this project).`);
            console.log(`   2. NO (Ask again next time) - Don't add now, but remind me next time.`);
            console.log(`   3. NO (Stop asking) - Don't add, and stop asking for this project.`);

            let choice = '';
            while (!['1', '2', '3'].includes(choice)) {
                choice = await askUser(`   Your choice for adding '${SNAPSHOTS_DIR_NAME}/' to project's .gitignore (1, 2, or 3): `);
                if (!['1', '2', '3'].includes(choice)) console.log("     Invalid choice. Please enter 1, 2, or 3.");
            }
            
            config.manageGitignoreEntryIsSet = true; // A decision was made or will be made
            configChangedThisSession = true;

            switch (choice) {
                case '1': // Yes, add it and stop asking
                    let newContent = projectGitignoreContent;
                    if (newContent && !newContent.endsWith('\n') && newContent.length > 0) newContent += '\n';
                    newContent += `\n# snapshot.js: Ignore local snapshots directory\n${GITIGNORE_ENTRY}\n`;
                    fs.writeFileSync(projectGitignorePath, newContent, 'utf8');
                    console.log(`   => Action: '${GITIGNORE_ENTRY}' added to project's '.gitignore'. Future prompts for this are now disabled.`);
                    config.manageGitignoreEntry = false; // Don't ask again
                    break;
                case '2': // No, ask again next time
                    console.log(`   => Action: '${GITIGNORE_ENTRY}' not added. Will ask again next time. This preference is saved in '.snapshotignore'.`);
                    config.manageGitignoreEntry = true; // Keep true to ask again
                    break;
                case '3': // No, stop asking
                    console.log(`   => Action: '${GITIGNORE_ENTRY}' not added. Future prompts for this are now disabled. This preference is saved in '.snapshotignore'.`);
                    config.manageGitignoreEntry = false; // Don't ask again
                    break;
            }
        }
    }

    if (configChangedThisSession) {
        setSnapshotignoreConfig(projectRoot, config);
        console.log(`\nℹ️ Configuration preferences saved to '.snapshotignore'.`);
    }
    //console.log("--- Configuration Check Complete ---\n");
}


function loadIgnoreList(projectRoot) {
    var ignoreSet = new Set();
    const config = getSnapshotignoreConfig(projectRoot);

    if (config.useGitignorePatterns === true) { // Explicitly check for true, as null means not configured or user said no
        const gitignorePath = path.join(projectRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const gitignoreLines = fs.readFileSync(gitignorePath, 'utf8').split(/\r?\n/);
            gitignoreLines.forEach(function (line) {
                var trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                ignoreSet.add(trimmed.replace(/\/+$/, ''));
            });
        }
    }

    var snapshotignoreFilePath = path.join(projectRoot, '.snapshotignore');
    if (fs.existsSync(snapshotignoreFilePath)) {
        var lines = fs.readFileSync(snapshotignoreFilePath, 'utf8').split(/\r?\n/);
        lines.forEach(function (line) {
            var trimmed = line.trim();
            // Skip config lines and comments
            if (!trimmed || trimmed.startsWith('#')) return;
            ignoreSet.add(trimmed.replace(/\/+$/, ''));
        });
    }

    ignoreSet.add(SNAPSHOTS_DIR_NAME); // Always ignore the snapshot directory itself
    return ignoreSet;
}

function isIgnored(relPath, ignoreSet) {
    var normalized = relPath.replace(/\\/g, '/');
    for (var pattern of ignoreSet) {
        // Handle simple directory patterns like "dist/" or "node_modules"
        if (pattern.endsWith('/')) {
            if (normalized === pattern.slice(0, -1) || normalized.startsWith(pattern)) {
                return true;
            }
        } else { // Handle file patterns or more complex patterns (basic for now)
            if (normalized === pattern || normalized.startsWith(pattern + '/')) {
                return true;
            }
        }
    }
    return false;
}

function listFilesRecursively(dir, base, ignoreSet) {
    if (base === undefined) base = dir;
    // Ensure ignoreSet is always loaded based on the projectRoot (base) context
    if (ignoreSet === undefined) ignoreSet = loadIgnoreList(base); 
    
    var fileList = [];
    try {
        var items = fs.readdirSync(dir);
        items.forEach(function (item) {
            var fullPath = path.join(dir, item);
            var relPath = path.relative(base, fullPath).replace(/\\/g, '/');
            
            // Critical: Prevent recursion into the snapshots directory itself if it's at the project root.
            if (path.resolve(fullPath) === path.resolve(path.join(base, SNAPSHOTS_DIR_NAME))) {
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
    } catch (e) {
        //  Ignore errors from trying to read dirs we might not have access to, or special files.
        // console.warn(`Warning: Could not read directory ${dir}: ${e.message}`);
    }
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

    // ignoreSet for diff/restore is based on currentPath (projectRoot)
    const effectiveIgnoreSet = ignoreSet || loadIgnoreList(currentPath);

    var snapshotFiles = listFilesRecursively(snapshotPath, snapshotPath, effectiveIgnoreSet);
    var currentFiles = listFilesRecursively(currentPath, currentPath, effectiveIgnoreSet);
    var allFiles = new Set([...snapshotFiles, ...currentFiles]); // Correct way to merge arrays into Set

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
            try {
                var snapHash = hashFile(snapFile);
                var currHash = hashFile(currFile);
                if (snapHash !== currHash) {
                    var snapLines = fs.readFileSync(snapFile, 'utf8').split(/\r?\n/).length;
                    var currLines = fs.readFileSync(currFile, 'utf8').split(/\r?\n/).length;
                    var delta = Math.abs(currLines - snapLines);
                    result.files.push({ file: relPath, status: 'modified', lines_changed: delta });
                }
            } catch (e) {
                // console.warn(`Could not compare file ${relPath}: ${e.message}`);
                result.files.push({ file: relPath, status: 'error_comparing', message: e.message });
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
    const effectiveIgnoreSet = ignoreSet || loadIgnoreList(currentPath);

    var snapshotFiles = listFilesRecursively(snapshotPath, snapshotPath, effectiveIgnoreSet);
    var restored = 0, skipped = 0;

    snapshotFiles.forEach(function (relPath) {
        var snapFile = path.join(snapshotPath, relPath);
        var destFile = path.join(currentPath, relPath);
        try {
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
        } catch (e) {
            // console.warn(`Could not restore file ${relPath}: ${e.message}`);
            skipped++; // Skip if error during hashing or copying
        }
    });

    var currentFiles = listFilesRecursively(currentPath, currentPath, effectiveIgnoreSet);
    var toDelete = currentFiles.filter(function (relPath) {
        return !snapshotFiles.includes(relPath);
    });
    var deleted = 0;

    toDelete.forEach(function (relPath) {
        var fullPath = path.join(currentPath, relPath);
        if (dryRun) {
            console.log('Would delete: ' + relPath);
        } else {
            try {
                fs.unlinkSync(fullPath);
                console.log('Deleted: ' + relPath);
            } catch (e) {
                // console.warn(`Could not delete file ${fullPath}: ${e.message}`);
            }
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
async function run() {
      console.log('');
  const projectRoot = process.cwd();
    let currentConfig = getSnapshotignoreConfig(projectRoot);

    //console.log("--- Snapshot.js Current Settings (from .snapshotignore) ---");
    if (currentConfig.useGitignorePatternsIsSet) {
        if (currentConfig.useGitignorePatterns) {
            console.log("🛠️  Snapshots WILL use your project's '.gitignore' patterns for exclusion.");
        } else {
            console.log("🛠️  Snapshots will NOT use your project's '.gitignore' patterns (only '.snapshotignore').");
        }
    } else {
        //console.log(" Setting: Using project's '.gitignore' patterns for snapshots: Not yet configured (you will be prompted).");
    }

    if (currentConfig.manageGitignoreEntryIsSet) {
        if (currentConfig.manageGitignoreEntry) {
            //console.log(" Setting: Managing '__snapshots__/' in project's '.gitignore': ENABLED (will check/prompt if needed).");
        } else {
            //console.log(" Setting: Managing '__snapshots__/' in project's '.gitignore': DISABLED (won't check/prompt).");
        }
    } else { 
        //console.log(" Setting: Managing '__snapshots__/' in project's '.gitignore': ENABLED (default, will check/prompt if needed).");
    }
    //console.log("----------------------------------------------------------");

    try {
        await interactiveConfiguration(projectRoot); 
    } catch (err) {
        console.warn(`⚠️ Error during interactive configuration: ${err.message}. Proceeding with current/default settings.`);
    }
    
    const snapshotsRoot = path.join(projectRoot, SNAPSHOTS_DIR_NAME);
    if (!fs.existsSync(snapshotsRoot)) {
        try {
            fs.mkdirSync(snapshotsRoot);
        } catch (err) {
            console.error(`❌ Failed to create snapshots directory: ${snapshotsRoot}. Please check permissions.`);
            process.exit(1);
        }
    }
  
    var args = process.argv.slice(2);
    var hasDiff = args.includes('--diff');
    var hasPrompt = args.includes('--prompt');
    var hasRestore = args.includes('--restore');
    var isDryRun = args.includes('--dry-run');
    var labelArgs = args.filter(function (arg) { return !arg.startsWith('--'); });

    if ((hasDiff || hasPrompt || hasRestore) && labelArgs.length === 0) {
        console.error('❌ Please specify a snapshot index for --diff/--prompt/--restore');
        process.exit(1);
    }

    // Load ignoreSet once here based on projectRoot, as it's the main context for operations
    const mainIgnoreSet = loadIgnoreList(projectRoot);

    if (hasDiff || hasPrompt || hasRestore) {
        var index = labelArgs[0].padStart(4, '0');
        var matchingFolder = fs.readdirSync(snapshotsRoot)
            .find(function (f) { return f.startsWith(index + '_'); });
        if (!matchingFolder) {
            console.error('❌ Snapshot folder not found for index ' + index);
            process.exit(1);
        }
        var snapshotPath = path.join(snapshotsRoot, matchingFolder);

        if (hasRestore) {
            console.log('♻️ Restoring snapshot: ' + matchingFolder + (isDryRun ? ' (dry run)' : ''));
            restoreSnapshot(snapshotPath, projectRoot, mainIgnoreSet, isDryRun);
            return;
        }

        console.log('📂 Found snapshot: ' + matchingFolder);
        console.log('🔍 Comparing against current working directory...');
        var diffData = compareSnapshots(snapshotPath, projectRoot, mainIgnoreSet);
        var diffOutputPath = path.join(snapshotsRoot, 'diff_' + index + '_to_current.json');
        fs.writeFileSync(diffOutputPath, JSON.stringify(diffData, null, 2));
        console.log('✅ Diff complete. Saved to ' + diffOutputPath);

        if (hasPrompt) {
            savePrompt(diffData, index, matchingFolder.replace(index + '_', ''), snapshotsRoot);
        }
        return;
    }

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
    // For copyDir, the ignoreSet should be the mainIgnoreSet from projectRoot
    
    function copyDir(src, dest, excludeSet, baseSrc) { // baseSrc is the original project root
        if (baseSrc === undefined) baseSrc = src;
        var items = fs.readdirSync(src);
        items.forEach(function (item) {
            var srcPath = path.join(src, item);
            var relPath = path.relative(baseSrc, srcPath).replace(/\\/g, '/');

            // Explicitly skip the top-level __snapshots__ directory in the source project
            if (path.resolve(srcPath) === path.resolve(path.join(baseSrc, SNAPSHOTS_DIR_NAME))) {
                return;
            }
            if (isIgnored(relPath, excludeSet)) {
                return;
            }

            var stats = fs.statSync(srcPath);
            var destPath = path.join(dest, item);
            if (stats.isDirectory()) {
                fs.mkdirSync(destPath, { recursive: true });
                copyDir(srcPath, destPath, excludeSet, baseSrc);
            } else {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }

    copyDir(projectRoot, snapshotDir, mainIgnoreSet, projectRoot);
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
    appendToLog,
    getSnapshotignoreConfig,
    setSnapshotignoreConfig
};

// Only run CLI when called directly
if (require.main === module) {
    run().catch(error => {
        console.error('❌ An unexpected error occurred in the snapshot tool:', error);
        process.exit(1);
    });
}