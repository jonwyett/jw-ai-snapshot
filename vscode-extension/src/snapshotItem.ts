import * as vscode from 'vscode';

export class SnapshotItem extends vscode.TreeItem {
    constructor(
        public readonly number: string,
        public readonly label: string,
        public readonly folderName: string,
        public readonly timestamp: string
    ) {
        super(`${number}: ${label}`, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = `${this.label} - ${timestamp}`;
        this.description = timestamp;
        this.contextValue = 'snapshot';
        this.iconPath = new vscode.ThemeIcon('archive');
    }
}