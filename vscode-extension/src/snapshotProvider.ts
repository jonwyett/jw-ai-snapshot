import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SnapshotItem } from './snapshotItem';

export interface Snapshot {
    number: string;
    label: string;
    folderName: string;
    timestamp: string;
}

export class SnapshotTreeDataProvider implements vscode.TreeDataProvider<SnapshotItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SnapshotItem | undefined | null | void> = new vscode.EventEmitter<SnapshotItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SnapshotItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private snapshots: Snapshot[] = [];

    constructor(private workspaceRoot: string) {
        this.loadSnapshots();
    }

    refresh(): void {
        this.loadSnapshots();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SnapshotItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SnapshotItem): Thenable<SnapshotItem[]> {
        if (!element) {
            return Promise.resolve(this.snapshots.map(snapshot => 
                new SnapshotItem(
                    snapshot.number,
                    snapshot.label,
                    snapshot.folderName,
                    snapshot.timestamp
                )
            ));
        }
        return Promise.resolve([]);
    }

    getSnapshots(): Snapshot[] {
        return this.snapshots;
    }

    private loadSnapshots(): void {
        const snapshotLogPath = path.join(this.workspaceRoot, '__snapshots__', 'snapshot.log');
        
        if (!fs.existsSync(snapshotLogPath)) {
            this.snapshots = [];
            return;
        }

        try {
            const logContent = fs.readFileSync(snapshotLogPath, 'utf8');
            const lines = logContent.split('\n').filter(line => line.trim());
            
            this.snapshots = [];
            
            for (const line of lines) {
                // Parse log entries - format: "[NNNN] 2025-XX-XX XX:XX:XX - "label""
                const match = line.match(/^\[(\d{4})\] (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - "([^"]+)"/);
                if (match) {
                    const [, number, timestamp, label] = match;
                    
                    // Generate folder name from number and label
                    const sanitizedLabel = label.toLowerCase()
                        .replace(/[^a-z0-9]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '');
                    const folderName = `${number}_${sanitizedLabel}`;
                    
                    this.snapshots.push({
                        number,
                        label,
                        folderName,
                        timestamp
                    });
                }
            }
            
            // Sort by number (descending - newest first)
            this.snapshots.sort((a, b) => parseInt(b.number) - parseInt(a.number));
            
        } catch (error) {
            console.error('Failed to load snapshots:', error);
            this.snapshots = [];
        }
    }
}