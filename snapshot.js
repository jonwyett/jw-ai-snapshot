// snapshot.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const diff = require('diff');

const SNAPSHOTS_DIR_NAME = '__snapshots__';

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

// Helper function to ask a question and get an answer asynchronously

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

function findSnapshotByIndex(snapshotsRoot, targetIndex) {
    if (!fs.existsSync(snapshotsRoot)) {
        return null;
    }
    var paddedIndex = targetIndex.toString().padStart(4, '0');
    return fs.readdirSync(snapshotsRoot)
        .find(function (f) { return f.startsWith(paddedIndex + '_'); });
}

function showHelp() {
    console.log('');
    console.log('📸 jw-ai-snapshot - Lightweight AI-assisted development snapshotting tool');
    console.log('');
    console.log('USAGE:');
    console.log('  node snapshot.js init                       Initialize project configuration');
    console.log('  node snapshot.js "description"              Create a new snapshot');
    console.log('  node snapshot.js "description" --dev-mode   Create snapshot including tool files');
    console.log('  node snapshot.js NNNN --diff               Compare snapshot to current');
    console.log('  node snapshot.js NNNN MMMM --diff          Compare two snapshots');
    console.log('  node snapshot.js NNNN --prompt             Generate AI analysis prompt');
    console.log('  node snapshot.js NNNN --restore            Restore from snapshot');
    console.log('  node snapshot.js NNNN --restore --dry-run  Preview restore changes');
    console.log('  node snapshot.js NNNN --analyze-regression Advanced regression analysis');
    console.log('  node snapshot.js --help                    Show this help');
    console.log('');
    console.log('EXAMPLES:');
    console.log('  node snapshot.js init                       # First-time setup for new project');
    console.log('  node snapshot.js "working login feature"   # Create snapshot 0001_working_login_feature');
    console.log('  node snapshot.js 23 --diff                 # Compare snapshot 23 to current state');
    console.log('  node snapshot.js 20 25 --diff              # Compare snapshot 20 to snapshot 25');
    console.log('  node snapshot.js 15 --prompt               # Generate AI prompt for changes since snapshot 15');
    console.log('  node snapshot.js 18 --restore --dry-run    # Preview what restoring snapshot 18 would do');
    console.log('  node snapshot.js 10 --analyze-regression   # Advanced analysis: find what broke after snapshot 10');
    console.log('');
    console.log('GETTING STARTED:');
    console.log('  1. 🚀 Run "node snapshot.js init" in your project directory');
    console.log('  2. 📸 Take snapshots frequently during development');
    console.log('  3. 🔍 When something breaks, compare snapshots to identify changes');
    console.log('  4. 🤖 Use --prompt or --analyze-regression to get AI-ready analysis');
    console.log('  5. 🔧 Fix the issue using AI insights');
    console.log('  6. ♻️  Use --restore if you need to rollback to a working state');
    console.log('');
    console.log('SNAPSHOT STORAGE:');
    console.log('  Snapshots are stored in __snapshots__/ directory with format: NNNN_description/');
    console.log('  Configure exclusions using .snapshotignore (two-section format)');
    console.log('  • ALWAYS SNAPSHOT: Override .gitignore to include specific files');
    console.log('  • NEVER SNAPSHOT: Add snapshot-specific exclusions');
    console.log('');
    console.log('AI FEATURES:');
    console.log('  --prompt:             Generate single-comparison analysis (NNNN vs current)');
    console.log('  --analyze-regression: Advanced two-part analysis (NNNN vs NNNN+1 vs current)');
    console.log('                       Perfect for finding when and why something broke');
    console.log('');
    console.log('DEVELOPER OPTIONS:');
    console.log('  --dev-mode:          Include tool source files (snapshot.js, package.json, etc.)');
    console.log('                       Useful for taking snapshots of the tool itself during development');
    console.log('');
}

async function initializeProject(projectRoot) {
    const snapshotignorePath = path.join(projectRoot, '.snapshotignore');
    
    // Check if already initialized
    if (fs.existsSync(snapshotignorePath)) {
        console.log('');
        console.log('⚠️  Project already initialized!');
        console.log('   .snapshotignore file already exists.');
        console.log('   To reconfigure, edit the .snapshotignore file directly.');
        console.log('');
        return;
    }
    
    console.log('');
    console.log('🚀 Welcome to jw-ai-snapshot!');
    console.log('   Setting up your project configuration...');
    console.log('');
    
    // Question: Add __snapshots__/ to .gitignore?
    console.log('❓ Add the \'__snapshots__/\' directory to your .gitignore file?');
    console.log('   (Recommended - prevents committing local snapshots to your repository)');
    
    let addToGitignore = '';
    while (!['y', 'n', 'yes', 'no'].includes(addToGitignore.toLowerCase())) {
        addToGitignore = await askUser('   Add __snapshots__/ to .gitignore? (Y/n): ');
        if (addToGitignore === '') addToGitignore = 'y'; // Default to yes
        if (!['y', 'n', 'yes', 'no'].includes(addToGitignore.toLowerCase())) {
            console.log('   Please enter y, n, yes, or no.');
        }
    }
    const shouldAddToGitignore = ['y', 'yes'].includes(addToGitignore.toLowerCase());
    
    console.log('');
    console.log('📝 Creating configuration...');
    
    // Create .snapshotignore file with new two-section format
    const configLines = [
        '# jw-ai-snapshot Configuration File',
        '# This file works WITH your .gitignore, not against it. The snapshot tool',
        '# will always use your .gitignore rules as a base. This file lets you',
        '# manage the exceptions.',
        '',
        '#-----------------------------------------------------------------------',
        '## ALWAYS SNAPSHOT (Exceptions to .gitignore)',
        '#-----------------------------------------------------------------------',
        '# Add files or folders here that you WANT to include in snapshots,',
        '# even if your .gitignore file ignores them.',
        '#',
        '# COMMON USE CASE: Your .gitignore probably ignores \'build/\' or \'dist/\'.',
        '# Add \'build/\' here to make sure your snapshots contain those critical',
        '# build artifacts, creating a fully working copy.',
        '#',
        '# ANOTHER USE CASE: To snapshot environment files, add \'.env\' here.',
        '',
        '# build/',
        '# .env',
        '',
        '',
        '#-----------------------------------------------------------------------',
        '## NEVER SNAPSHOT (Snapshot-specific ignores)',
        '#-----------------------------------------------------------------------',
        '# Add files or folders here that should ONLY be ignored for snapshots.',
        '# This is useful for large assets or logs that you track in git but',
        '# don\'t need in every quick code snapshot.',
        '',
        '# --- Default Safe Ignores ---',
        '',
        '# Version Control',
        '.git/',
        '',
        '# Dependencies',
        'node_modules/',
        '',
        '# OS & Editor specific',
        '.DS_Store',
        '.vscode/',
        '.idea/',
        '',
        '# Logs',
        '*.log',
        '',
        '# Environment Files (un-comment the lines below to ignore them)',
        '.env',
        '.env.local',
        ''
    ];
    
    fs.writeFileSync(snapshotignorePath, configLines.join('\n'), 'utf8');
    console.log('✅ Created .snapshotignore with two-section configuration.');
    
    // Add to .gitignore if requested
    if (shouldAddToGitignore) {
        const gitignorePath = path.join(projectRoot, '.gitignore');
        const gitignoreEntry = '__snapshots__/';
        
        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            if (!gitignoreContent.includes(gitignoreEntry)) {
                const newContent = gitignoreContent + 
                    (gitignoreContent.endsWith('\n') ? '' : '\n') + 
                    '\n# jw-ai-snapshot: Ignore local snapshots directory\n' + 
                    gitignoreEntry + '\n';
                fs.writeFileSync(gitignorePath, newContent, 'utf8');
                console.log('✅ Added \'__snapshots__/\' to .gitignore.');
            } else {
                console.log('ℹ️  \'__snapshots__/\' already exists in .gitignore.');
            }
        } else {
            const newContent = '# jw-ai-snapshot: Ignore local snapshots directory\n' + gitignoreEntry + '\n';
            fs.writeFileSync(gitignorePath, newContent, 'utf8');
            console.log('✅ Created .gitignore and added \'__snapshots__/\'.');
        }
    }
    
    console.log('');
    console.log('🎉 Project initialized successfully!');
    console.log('   The .snapshotignore file uses two sections:');
    console.log('   • ALWAYS SNAPSHOT: Override .gitignore to include specific files');
    console.log('   • NEVER SNAPSHOT: Add snapshot-specific exclusions');
    console.log('');
    console.log('   You can now create your first snapshot:');
    console.log('   node snapshot.js "initial version"');
    console.log('');
}





function loadIgnoreList(projectRoot, devMode) {
    var ignoreSet = new Set();
    
    // Always start with .gitignore patterns as base
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath) && !devMode) {
        const gitignoreLines = fs.readFileSync(gitignorePath, 'utf8').split(/\r?\n/);
        gitignoreLines.forEach(function (line) {
            var trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            ignoreSet.add(trimmed.replace(/\/+$/, ''));
        });
    }
    
    // Read .snapshotignore file and parse the two sections
    var snapshotignoreFilePath = path.join(projectRoot, '.snapshotignore');
    if (fs.existsSync(snapshotignoreFilePath)) {
        var lines = fs.readFileSync(snapshotignoreFilePath, 'utf8').split(/\r?\n/);
        var currentSection = null; // 'always' or 'never'
        var alwaysSnapshotPatterns = [];
        var neverSnapshotPatterns = [];
        
        lines.forEach(function (line) {
            var trimmed = line.trim();
            
            // Skip empty lines and comments (unless they're section headers)
            if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('##'))) return;
            
            // Check for section headers
            if (trimmed === '## ALWAYS SNAPSHOT (Exceptions to .gitignore)' || 
                trimmed.includes('## ALWAYS SNAPSHOT')) {
                currentSection = 'always';
                return;
            }
            if (trimmed === '## NEVER SNAPSHOT (Snapshot-specific ignores)' || 
                trimmed.includes('## NEVER SNAPSHOT')) {
                currentSection = 'never';
                return;
            }
            
            // Skip commented patterns
            if (trimmed.startsWith('#')) return;
            
            // Add patterns to appropriate section
            var cleanPattern = trimmed.replace(/\/+$/, '');
            if (currentSection === 'always') {
                alwaysSnapshotPatterns.push(cleanPattern);
            } else if (currentSection === 'never') {
                neverSnapshotPatterns.push(cleanPattern);
            }
        });
        
        // Apply ALWAYS SNAPSHOT rules - remove from ignoreSet
        alwaysSnapshotPatterns.forEach(function(pattern) {
            ignoreSet.delete(pattern);
            // Also remove exact matches with trailing slash
            ignoreSet.delete(pattern + '/');
        });
        
        // Apply NEVER SNAPSHOT rules - add to ignoreSet
        neverSnapshotPatterns.forEach(function(pattern) {
            // In dev mode, don't ignore tool's own files
            if (devMode) {
                var toolFiles = ['snapshot.js', '.snapshotignore', 'package.json', 'package-lock.json', 'go.mod', 'go.sum'];
                if (toolFiles.includes(pattern)) return;
            }
            ignoreSet.add(pattern);
        });
    }

    ignoreSet.add(SNAPSHOTS_DIR_NAME); // Always ignore the snapshot directory itself
    return ignoreSet;
}

function isIgnored(relPath, ignoreSet) {
    var normalized = relPath.replace(/\\/g, '/');
    for (var pattern of ignoreSet) {
        // Handle wildcard patterns
        if (pattern.includes('*')) {
            var regexPattern = pattern
                .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
                .replace(/\*/g, '.*'); // Convert * to .*
            var regex = new RegExp('^' + regexPattern + '$');
            if (regex.test(normalized)) {
                return true;
            }
            // Also check if the pattern matches any part of the path
            var pathParts = normalized.split('/');
            for (var part of pathParts) {
                if (regex.test(part)) {
                    return true;
                }
            }
        }
        // Handle simple directory patterns like "dist/" or "node_modules"
        else if (pattern.endsWith('/')) {
            if (normalized === pattern.slice(0, -1) || normalized.startsWith(pattern)) {
                return true;
            }
        } 
        // Handle exact file/directory patterns
        else {
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
    if (ignoreSet === undefined) ignoreSet = loadIgnoreList(base, false); // Default to non-dev mode 
    
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
        compare: path.basename(currentPath) === path.basename(process.cwd()) ? 'current' : path.basename(currentPath),
        files: []
    };

    // ignoreSet for diff/restore is based on currentPath (projectRoot)
    const effectiveIgnoreSet = ignoreSet || loadIgnoreList(currentPath, false);

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
                    // Generate line-by-line diff for modified files
                    var snapContent = fs.readFileSync(snapFile, 'utf8');
                    var currContent = fs.readFileSync(currFile, 'utf8');
                    var diffResult = diff.createPatch(relPath, snapContent, currContent, 'snapshot', 'current');
                    
                    var snapLines = snapContent.split(/\r?\n/).length;
                    var currLines = currContent.split(/\r?\n/).length;
                    var delta = Math.abs(currLines - snapLines);
                    
                    result.files.push({ 
                        file: relPath, 
                        status: 'modified', 
                        lines_changed: delta,
                        diff: diffResult
                    });
                }
            } catch (e) {
                // console.warn(`Could not compare file ${relPath}: ${e.message}`);
                result.files.push({ file: relPath, status: 'error_comparing', message: e.message });
            }
        }
    });

    return result;
}

function appendChangeManifest(snapshotsRoot, currentIndex, label, ignoreSet) {
    var logPath = path.join(snapshotsRoot, 'snapshot.log');
    var timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    var paddedIndex = currentIndex.toString().padStart(4, '0');
    
    var lines = [
        '[' + paddedIndex + '] ' + timestamp + ' - "' + label + '"',
        ''
    ];
    
    // Check if this is the first snapshot
    var previousIndex = currentIndex - 1;
    var previousFolder = null;
    
    if (previousIndex > 0) {
        previousFolder = findSnapshotByIndex(snapshotsRoot, previousIndex);
    }
    
    if (!previousFolder) {
        // First snapshot - list all files as "Added"
        var currentSnapshotPath = path.join(snapshotsRoot, paddedIndex + '_' + sanitizeLabel(label));
        var allFiles = listFilesRecursively(currentSnapshotPath, currentSnapshotPath, ignoreSet);
        
        if (allFiles.length > 0) {
            lines.push('Initial snapshot');
            lines.push('');
            lines.push('Added:');
            
            if (allFiles.length <= 10) {
                allFiles.forEach(function(file) {
                    lines.push('  - ' + file);
                });
            } else {
                for (var i = 0; i < 10; i++) {
                    lines.push('  - ' + allFiles[i]);
                }
                lines.push('  ...and ' + (allFiles.length - 10) + ' more files');
            }
        }
    } else {
        // Compare with previous snapshot
        var previousPath = path.join(snapshotsRoot, previousFolder);
        var currentSnapshotPath = path.join(snapshotsRoot, paddedIndex + '_' + sanitizeLabel(label));
        
        var diffData = compareSnapshots(previousPath, currentSnapshotPath, ignoreSet);
        
        var modifiedFiles = diffData.files.filter(f => f.status === 'modified').map(f => f.file);
        var addedFiles = diffData.files.filter(f => f.status === 'added').map(f => f.file);
        var removedFiles = diffData.files.filter(f => f.status === 'removed').map(f => f.file);
        
        // Helper function to add file list with truncation
        function addFileSection(sectionName, files) {
            if (files.length > 0) {
                lines.push(sectionName + ':');
                if (files.length <= 10) {
                    files.forEach(function(file) {
                        lines.push('  - ' + file);
                    });
                } else {
                    for (var i = 0; i < 10; i++) {
                        lines.push('  - ' + files[i]);
                    }
                    lines.push('  ...and ' + (files.length - 10) + ' more ' + sectionName.toLowerCase() + ' files');
                }
                lines.push('');
            }
        }
        
        addFileSection('Changed', modifiedFiles);
        addFileSection('Added', addedFiles);
        addFileSection('Removed', removedFiles);
    }
    
    lines.push('----------------------------------------');
    lines.push('');
    
    fs.appendFileSync(logPath, lines.join('\n'), 'utf8');
}

function savePrompt(diffData, index, snapshotName, snapshotDir) {
    var lines = [
        '# Code Analysis Request: Identify Breaking Changes',
        '',
        'I have a working snapshot of my code located at `__snapshots__/' + index + '_' + snapshotName + '/` and my current code has a regression.',
        'Please analyze the changes below to help identify what may have broken the functionality.',
        '',
        '**Context:** The snapshot represents a known working state. The changes shown below represent',
        'all modifications made since that working version.',
        ''
    ];

    // Separate files by status
    var removedFiles = diffData.files.filter(f => f.status === 'removed');
    var addedFiles = diffData.files.filter(f => f.status === 'added');
    var modifiedFiles = diffData.files.filter(f => f.status === 'modified');

    // Add REMOVED files section
    if (removedFiles.length > 0) {
        lines.push('## [REMOVED] Files');
        lines.push('');
        lines.push('The following files were deleted from the current working directory (they exist in the snapshot):');
        lines.push('');
        removedFiles.forEach(function(file) {
            lines.push('- `' + file.file + '` (was in snapshot, now deleted from current code)');
        });
        lines.push('');
    }

    // Add ADDED files section
    if (addedFiles.length > 0) {
        lines.push('## [ADDED] Files');
        lines.push('');
        lines.push('The following files were created in the current working directory (they do not exist in the snapshot):');
        lines.push('');
        addedFiles.forEach(function(file) {
            lines.push('- `' + file.file + '` (new file, not in snapshot)');
        });
        lines.push('');
    }

    // Add MODIFIED files section with detailed diffs
    if (modifiedFiles.length > 0) {
        lines.push('## [MODIFIED] Files');
        lines.push('');
        lines.push('The following files were modified with line-by-line changes:');
        lines.push('');

        modifiedFiles.forEach(function(file) {
            lines.push('### `' + file.file + '`');
            lines.push('');
            lines.push('**Lines changed:** ' + file.lines_changed);
            lines.push('');
            
            if (file.diff) {
                // Parse and clean up the diff for better readability
                var diffLines = file.diff.split('\n');
                var cleanDiff = [];
                var inContent = false;
                
                diffLines.forEach(function(line) {
                    if (line.startsWith('@@')) {
                        inContent = true;
                        cleanDiff.push(line);
                    } else if (inContent && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
                        cleanDiff.push(line);
                    }
                });
                
                lines.push('```diff');
                lines = lines.concat(cleanDiff);
                lines.push('```');
            }
            lines.push('');
        });
    }

    // Add closing instruction
    lines.push('---');
    lines.push('');
    lines.push('**Please analyze these changes and identify:**');
    lines.push('1. Which changes are most likely to have introduced a regression');
    lines.push('2. What functionality might be affected');
    lines.push('3. Specific areas to investigate or test');
    lines.push('');

    var outputPath = path.join(snapshotDir, 'prompt_' + index + '_analysis.md');
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
    console.log('✅ AI-ready prompt saved to ' + outputPath);
}

function saveRegressionAnalysisPrompt(causalDiff, cumulativeDiff, baseIndex, baseName, nextIndex, nextName, snapshotDir) {
    var lines = [
        '# AI Regression Analysis: Advanced Two-Part Investigation',
        '',
        'I have identified a regression in my code and need your help with a comprehensive analysis.',
        'This prompt contains two parts that work together to identify the root cause and formulate a solution.',
        '',
        '**Context:**',
        '- **Last Known Good:** `__snapshots__/' + baseIndex + '_' + baseName + '/` (working state)',
        '- **First Breaking Version:** `__snapshots__/' + nextIndex + '_' + nextName + '/` (regression introduced)',
        '- **Current State:** Current working directory (may contain additional changes)',
        '',
        '---',
        ''
    ];

    // Helper function to format diff section
    function formatDiffSection(diffData, title, subtitle) {
        var sectionLines = [title, '', subtitle, ''];
        
        var removedFiles = diffData.files.filter(f => f.status === 'removed');
        var addedFiles = diffData.files.filter(f => f.status === 'added');
        var modifiedFiles = diffData.files.filter(f => f.status === 'modified');

        if (removedFiles.length > 0) {
            sectionLines.push('### [REMOVED] Files');
            sectionLines.push('');
            removedFiles.forEach(function(file) {
                sectionLines.push('- `' + file.file + '`');
            });
            sectionLines.push('');
        }

        if (addedFiles.length > 0) {
            sectionLines.push('### [ADDED] Files');
            sectionLines.push('');
            addedFiles.forEach(function(file) {
                sectionLines.push('- `' + file.file + '`');
            });
            sectionLines.push('');
        }

        if (modifiedFiles.length > 0) {
            sectionLines.push('### [MODIFIED] Files');
            sectionLines.push('');
            modifiedFiles.forEach(function(file) {
                sectionLines.push('#### `' + file.file + '`');
                sectionLines.push('**Lines changed:** ' + file.lines_changed);
                sectionLines.push('');
                
                if (file.diff) {
                    var diffLines = file.diff.split('\n');
                    var cleanDiff = [];
                    var inContent = false;
                    
                    diffLines.forEach(function(line) {
                        if (line.startsWith('@@')) {
                            inContent = true;
                            cleanDiff.push(line);
                        } else if (inContent && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
                            cleanDiff.push(line);
                        }
                    });
                    
                    sectionLines.push('```diff');
                    sectionLines = sectionLines.concat(cleanDiff);
                    sectionLines.push('```');
                }
                sectionLines.push('');
            });
        }

        return sectionLines;
    }

    // Section 1: The Immediate Breaking Change
    lines = lines.concat(formatDiffSection(
        causalDiff,
        '## SECTION 1: The Immediate Breaking Change',
        '**What changed between the last working version and the first broken version:**'
    ));

    lines.push('---');
    lines.push('');

    // Section 2: The Full Picture
    lines = lines.concat(formatDiffSection(
        cumulativeDiff,
        '## SECTION 2: The Full Picture (All Changes Since Working Version)',
        '**What changed between the last working version and the current code:**'
    ));

    lines.push('---');
    lines.push('');
    lines.push('## YOUR TASK:');
    lines.push('');
    lines.push('**Step 1:** Analyze SECTION 1 to identify the most likely root cause of the regression.');
    lines.push('Focus on the specific changes that occurred between the working and broken states.');
    lines.push('');
    lines.push('**Step 2:** Using SECTION 2, formulate a solution that will work with the current codebase.');
    lines.push('Consider all the additional changes that have been made since the regression was introduced.');
    lines.push('');
    lines.push('**Please provide:**');
    lines.push('1. **Root Cause Analysis:** What specific change(s) in Section 1 likely caused the regression?');
    lines.push('2. **Impact Assessment:** What functionality is affected and why?');
    lines.push('3. **Solution Strategy:** How should this be fixed given the current state in Section 2?');
    lines.push('4. **Implementation Plan:** Specific code changes or investigation steps needed.');
    lines.push('');

    var outputPath = path.join(snapshotDir, 'regression_analysis_' + baseIndex + '.md');
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
    console.log('✅ Advanced regression analysis prompt saved to ' + outputPath);
}

function restoreSnapshot(snapshotPath, currentPath, ignoreSet, dryRun) {
    if (dryRun === undefined) dryRun = false;
    const effectiveIgnoreSet = ignoreSet || loadIgnoreList(currentPath, false);

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
    
    var args = process.argv.slice(2);
    var hasHelp = args.includes('--help') || args.includes('-h');
    var hasDiff = args.includes('--diff');
    var hasPrompt = args.includes('--prompt');
    var hasRestore = args.includes('--restore');
    var hasAnalyzeRegression = args.includes('--analyze-regression');
    var isDryRun = args.includes('--dry-run');
    var isDevMode = args.includes('--dev-mode');
    var labelArgs = args.filter(function (arg) { return !arg.startsWith('--'); });
    
    // Handle init command
    if (labelArgs[0] === 'init') {
        await initializeProject(projectRoot);
        return;
    }

    // Show help if requested or if no arguments provided
    if (hasHelp || args.length === 0) {
        showHelp();
        return;
    }
    
    // Check if project is initialized (except for help and init commands)
    const snapshotignorePath = path.join(projectRoot, '.snapshotignore');
    if (!fs.existsSync(snapshotignorePath)) {
        console.log('');
        console.log('🚨 Welcome to jw-ai-snapshot!');
        console.log('   It looks like this project hasn\'t been initialized.');
        console.log('');
        console.log('   Please run: node snapshot.js init');
        console.log('');
        process.exit(1);
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

    if ((hasDiff || hasPrompt || hasRestore || hasAnalyzeRegression) && labelArgs.length === 0) {
        console.error('❌ Please specify a snapshot index for --diff/--prompt/--restore/--analyze-regression');
        process.exit(1);
    }

    // Load ignoreSet once here based on projectRoot, as it's the main context for operations
    const mainIgnoreSet = loadIgnoreList(projectRoot, isDevMode);

    // Handle regression analysis first (separate logic)
    if (hasAnalyzeRegression) {
        var baseIndex = parseInt(labelArgs[0], 10);
        var basePaddedIndex = baseIndex.toString().padStart(4, '0');
        var baseFolder = findSnapshotByIndex(snapshotsRoot, baseIndex);
        
        if (!baseFolder) {
            console.error('❌ Base snapshot folder not found for index ' + baseIndex);
            process.exit(1);
        }
        
        var nextIndex = baseIndex + 1;
        var nextFolder = findSnapshotByIndex(snapshotsRoot, nextIndex);
        
        if (!nextFolder) {
            console.error('❌ No successor snapshot found. Snapshot ' + baseIndex + ' appears to be the latest.');
            console.error('   Cannot analyze regression - need at least one snapshot after the known-good state.');
            process.exit(1);
        }
        
        var basePath = path.join(snapshotsRoot, baseFolder);
        var nextPath = path.join(snapshotsRoot, nextFolder);
        var nextPaddedIndex = nextIndex.toString().padStart(4, '0');
        
        console.log('🔍 Starting regression analysis...');
        console.log('📂 Base (known good): ' + baseFolder);
        console.log('📁 Next (first broken): ' + nextFolder);
        console.log('');
        
        // Generate Causal Diff (NNNN vs NNNN+1)
        console.log('⚡ Analyzing causal diff (' + basePaddedIndex + ' → ' + nextPaddedIndex + ')...');
        var causalDiff = compareSnapshots(basePath, nextPath, mainIgnoreSet);
        
        // Generate Cumulative Diff (NNNN vs current)
        console.log('🌐 Analyzing cumulative diff (' + basePaddedIndex + ' → current)...');
        var cumulativeDiff = compareSnapshots(basePath, projectRoot, mainIgnoreSet);
        
        // Save both diffs as JSON
        var causalDiffPath = path.join(snapshotsRoot, 'regression_causal_' + basePaddedIndex + '_to_' + nextPaddedIndex + '.json');
        var cumulativeDiffPath = path.join(snapshotsRoot, 'regression_cumulative_' + basePaddedIndex + '_to_current.json');
        
        fs.writeFileSync(causalDiffPath, JSON.stringify(causalDiff, null, 2));
        fs.writeFileSync(cumulativeDiffPath, JSON.stringify(cumulativeDiff, null, 2));
        
        console.log('✅ Causal diff saved to ' + causalDiffPath);
        console.log('✅ Cumulative diff saved to ' + cumulativeDiffPath);
        
        // Generate the two-part regression analysis prompt
        var baseName = baseFolder.replace(basePaddedIndex + '_', '');
        var nextName = nextFolder.replace(nextPaddedIndex + '_', '');
        
        saveRegressionAnalysisPrompt(causalDiff, cumulativeDiff, basePaddedIndex, baseName, nextPaddedIndex, nextName, snapshotsRoot);
        
        console.log('');
        console.log('🎯 Regression analysis complete! Use the generated prompt with your LLM to identify the root cause and solution.');
        return;
    }

    if (hasDiff || hasPrompt || hasRestore) {
        var index1 = labelArgs[0].padStart(4, '0');
        var matchingFolder1 = fs.readdirSync(snapshotsRoot)
            .find(function (f) { return f.startsWith(index1 + '_'); });
        if (!matchingFolder1) {
            console.error('❌ Snapshot folder not found for index ' + index1);
            process.exit(1);
        }
        var snapshotPath1 = path.join(snapshotsRoot, matchingFolder1);

        if (hasRestore) {
            console.log('♻️ Restoring snapshot: ' + matchingFolder1 + (isDryRun ? ' (dry run)' : ''));
            restoreSnapshot(snapshotPath1, projectRoot, mainIgnoreSet, isDryRun);
            return;
        }

        // Check for two-snapshot comparison
        var comparePath, diffOutputPath;
        if (labelArgs.length >= 2) {
            // Two snapshot comparison: NNNN MMMM --diff
            var index2 = labelArgs[1].padStart(4, '0');
            var matchingFolder2 = fs.readdirSync(snapshotsRoot)
                .find(function (f) { return f.startsWith(index2 + '_'); });
            if (!matchingFolder2) {
                console.error('❌ Snapshot folder not found for index ' + index2);
                process.exit(1);
            }
            comparePath = path.join(snapshotsRoot, matchingFolder2);
            diffOutputPath = path.join(snapshotsRoot, 'diff_' + index1 + '_to_' + index2 + '.json');
            console.log('📂 Found snapshots: ' + matchingFolder1 + ' and ' + matchingFolder2);
            console.log('🔍 Comparing ' + matchingFolder1 + ' against ' + matchingFolder2 + '...');
        } else {
            // Single snapshot comparison against current: NNNN --diff
            comparePath = projectRoot;
            diffOutputPath = path.join(snapshotsRoot, 'diff_' + index1 + '_to_current.json');
            console.log('📂 Found snapshot: ' + matchingFolder1);
            console.log('🔍 Comparing against current working directory...');
        }

        var diffData = compareSnapshots(snapshotPath1, comparePath, mainIgnoreSet);
        fs.writeFileSync(diffOutputPath, JSON.stringify(diffData, null, 2));
        console.log('✅ Diff complete. Saved to ' + diffOutputPath);

        if (hasPrompt) {
            savePrompt(diffData, index1, matchingFolder1.replace(index1 + '_', ''), snapshotsRoot);
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
    appendChangeManifest(snapshotsRoot, nextIndex, labelRaw, mainIgnoreSet);
    console.log('✅ Snapshot complete.');
}

// Export helpers for unit tests
module.exports = {
    sanitizeLabel,
    padNumber,
    getNextSnapshotIndex,
    findSnapshotByIndex,
    loadIgnoreList,
    isIgnored,
    listFilesRecursively,
    compareSnapshots,
    restoreSnapshot,
    savePrompt,
    saveRegressionAnalysisPrompt,
    appendChangeManifest,
};

// Only run CLI when called directly
if (require.main === module) {
    run().catch(error => {
        console.error('❌ An unexpected error occurred in the snapshot tool:', error);
        process.exit(1);
    });
}