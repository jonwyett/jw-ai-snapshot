import * as vscode from 'vscode';
import { SnapshotTreeDataProvider } from './snapshotProvider';
import { SnapshotItem } from './snapshotItem';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

function getSnapshotCommand(workspaceRoot: string): string {
    const isWindows = process.platform === 'win32';
    
    // Priority order: platform-specific binary, then Node.js fallback
    const candidates = [
        isWindows ? 'snapshot.exe' : 'snapshot',
        'node snapshot.js'
    ];
    
    for (const candidate of candidates) {
        const fullPath = path.join(workspaceRoot, candidate.split(' ')[0]);
        if (fs.existsSync(fullPath)) {
            return candidate;
        }
    }
    
    // Fallback to first option even if not found (will show proper error)
    return candidates[0];
}

export function activate(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const snapshotLogPath = path.join(workspaceRoot, '__snapshots__', 'snapshot.log');
    
    // Check if snapshots are initialized
    const isInitialized = fs.existsSync(snapshotLogPath);
    vscode.commands.executeCommand('setContext', 'jwSnapshot.isInitialized', isInitialized);

    if (!isInitialized) {
        vscode.window.showInformationMessage(
            `JW AI Snapshot: No snapshots found. Run "${getSnapshotCommand(workspaceRoot)} init" to initialize.`,
            'Open Terminal'
        ).then((selection) => {
            if (selection === 'Open Terminal') {
                const terminal = vscode.window.createTerminal();
                terminal.show();
                terminal.sendText('cd ' + workspaceRoot);
            }
        });
        return;
    }

    const provider = new SnapshotTreeDataProvider(workspaceRoot);
    vscode.window.createTreeView('jwSnapshot.snapshots', { treeDataProvider: provider });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('jwSnapshot.refresh', () => provider.refresh()),
        
        vscode.commands.registerCommand('jwSnapshot.createSnapshot', async () => {
            const label = await vscode.window.showInputBox({
                prompt: 'Enter snapshot label',
                placeHolder: 'Snapshot description'
            });
            
            if (label) {
                try {
                    const snapshotCmd = getSnapshotCommand(workspaceRoot);
                    await execAsync(`${snapshotCmd} "${label}"`, { cwd: workspaceRoot });
                    provider.refresh();
                    vscode.window.showInformationMessage(`Snapshot created: ${label}`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to create snapshot: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('jwSnapshot.restoreSnapshot', async (item: SnapshotItem) => {
            const confirmation = await vscode.window.showWarningMessage(
                `Are you sure you want to restore snapshot ${item.number}? This will overwrite current files.`,
                { modal: true },
                'Yes, Restore'
            );
            
            if (confirmation === 'Yes, Restore') {
                try {
                    const snapshotCmd = getSnapshotCommand(workspaceRoot);
                    await execAsync(`${snapshotCmd} ${item.number} --restore`, { cwd: workspaceRoot });
                    vscode.window.showInformationMessage(`Restored snapshot ${item.number}`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to restore snapshot: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('jwSnapshot.deleteSnapshot', async (item: SnapshotItem) => {
            const confirmation = await vscode.window.showWarningMessage(
                `Are you sure you want to delete snapshot ${item.number}?`,
                { modal: true },
                'Yes, Delete'
            );
            
            if (confirmation === 'Yes, Delete') {
                try {
                    const snapshotDir = path.join(workspaceRoot, '__snapshots__', item.folderName);
                    await fs.promises.rmdir(snapshotDir, { recursive: true });
                    provider.refresh();
                    vscode.window.showInformationMessage(`Deleted snapshot ${item.number}`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to delete snapshot: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('jwSnapshot.generatePromptCurrent', async (item: SnapshotItem) => {
            try {
                const snapshotCmd = getSnapshotCommand(workspaceRoot);
                const { stdout } = await execAsync(`${snapshotCmd} ${item.number} --prompt`, { cwd: workspaceRoot });
                const outputLines = stdout.trim().split('\n');
                const fileName = outputLines[outputLines.length - 1];
                
                if (fileName && fileName.endsWith('.txt')) {
                    const filePath = path.join(workspaceRoot, fileName);
                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate prompt: ${error}`);
            }
        }),

        vscode.commands.registerCommand('jwSnapshot.generatePromptAnother', async (item: SnapshotItem) => {
            const snapshots = provider.getSnapshots();
            const otherSnapshots = snapshots.filter(s => s.number !== item.number);
            
            const items = otherSnapshots.map(s => ({
                label: `${s.number}: ${s.label}`,
                snapshot: s
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select snapshot to compare against'
            });
            
            if (selected) {
                try {
                    const snapshotCmd = getSnapshotCommand(workspaceRoot);
                    const { stdout } = await execAsync(`${snapshotCmd} ${item.number} ${selected.snapshot.number} --prompt`, { cwd: workspaceRoot });
                    const outputLines = stdout.trim().split('\n');
                    const fileName = outputLines[outputLines.length - 1];
                    
                    if (fileName && fileName.endsWith('.txt')) {
                        const filePath = path.join(workspaceRoot, fileName);
                        const document = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(document);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to generate prompt: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('jwSnapshot.analyzeRegression', async (item: SnapshotItem) => {
            try {
                const snapshotCmd = getSnapshotCommand(workspaceRoot);
                const { stdout } = await execAsync(`${snapshotCmd} ${item.number} --analyze-regression`, { cwd: workspaceRoot });
                const outputLines = stdout.trim().split('\n');
                const fileName = outputLines[outputLines.length - 1];
                
                if (fileName && fileName.endsWith('.txt')) {
                    const filePath = path.join(workspaceRoot, fileName);
                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to analyze regression: ${error}`);
            }
        }),

        vscode.commands.registerCommand('jwSnapshot.diffCurrent', async (item: SnapshotItem) => {
            const snapshotPath = path.join(workspaceRoot, '__snapshots__', item.folderName);
            const currentPath = workspaceRoot;
            
            try {
                await vscode.commands.executeCommand('vscode.diff',
                    vscode.Uri.file(snapshotPath),
                    vscode.Uri.file(currentPath),
                    `Snapshot ${item.number} ↔ Current`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open diff: ${error}`);
            }
        }),

        vscode.commands.registerCommand('jwSnapshot.diffAnother', async (item: SnapshotItem) => {
            const snapshots = provider.getSnapshots();
            const otherSnapshots = snapshots.filter(s => s.number !== item.number);
            
            const items = otherSnapshots.map(s => ({
                label: `${s.number}: ${s.label}`,
                snapshot: s
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select snapshot to compare against'
            });
            
            if (selected) {
                const snapshotPath1 = path.join(workspaceRoot, '__snapshots__', item.folderName);
                const snapshotPath2 = path.join(workspaceRoot, '__snapshots__', selected.snapshot.folderName);
                
                try {
                    await vscode.commands.executeCommand('vscode.diff',
                        vscode.Uri.file(snapshotPath1),
                        vscode.Uri.file(snapshotPath2),
                        `Snapshot ${item.number} ↔ Snapshot ${selected.snapshot.number}`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to open diff: ${error}`);
                }
            }
        })
    );
}

export function deactivate() {}