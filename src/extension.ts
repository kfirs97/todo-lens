import * as vscode from 'vscode';
import { Highlighter } from './decorations';
import { TodoStore } from './store';
import { TodoTree } from './tree';
import { License } from './license';
import { BUY_URL } from './licenseVerify';
import { markdownReport } from './report';
import { config } from './config';
import { LineBlame } from './blame';
import { recordUse } from './nudge';

/** Returned from activate() so tests (and other extensions) can read the scan results. */
export interface TodoLensApi {
  items(): readonly { file: string; line: number; tag: string; message: string }[];
  scan(): Promise<void>;
}

export async function activate(context: vscode.ExtensionContext): Promise<TodoLensApi> {
  const license = new License(context);
  await license.init();
  const store = new TodoStore();
  const tree = new TodoTree(store, license);
  const view = vscode.window.createTreeView('todoLens.tree', { treeDataProvider: tree, showCollapseAll: true });

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  status.command = 'todoLens.tree.focus';
  const updateCounts = () => {
    const n = store.items.length;
    view.badge = n ? { value: n, tooltip: `${n} TODOs` } : undefined;
    status.text = `$(checklist) ${n}`;
    status.tooltip = `${n} TODOs in workspace — click to show (TODO Lens)`;
    config().showStatusBar ? status.show() : status.hide();
  };
  store.onDidChange(updateCounts);

  const setGroup = (g: 'file' | 'tag') => {
    tree.groupBy = g;
    void vscode.commands.executeCommand('setContext', 'todoLens.groupBy', g);
    tree.refresh();
  };
  const setMine = async (on: boolean) => {
    if (on) {
      if (!(await license.require('Showing only your TODOs'))) return;
      const email = await gitEmail();
      if (!email) return void vscode.window.showWarningMessage('Set git user.email to filter your TODOs.');
      tree.mineOnly = email;
    } else {
      tree.mineOnly = null;
    }
    void vscode.commands.executeCommand('setContext', 'todoLens.mineOnly', on);
    tree.refresh();
  };

  context.subscriptions.push(
    new Highlighter(),
    store,
    view,
    status,
    vscode.commands.registerCommand('todoLens.refresh', () => store.scanAll()),
    vscode.commands.registerCommand('todoLens.groupByFile', () => setGroup('file')),
    vscode.commands.registerCommand('todoLens.groupByTag', () => setGroup('tag')),
    vscode.commands.registerCommand('todoLens.showMine', () => setMine(true)),
    vscode.commands.registerCommand('todoLens.showAll', () => setMine(false)),
    vscode.commands.registerCommand('todoLens.export', async () => {
      if (!(await license.require('Exporting a TODO report'))) return;
      const blame = new Map<(typeof store.items)[number], LineBlame | undefined>();
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Building TODO report…' }, async () => {
        for (const item of store.items) blame.set(item, await store.blame(item));
      });
      const doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: markdownReport(store.items, f => vscode.workspace.asRelativePath(f), blame),
      });
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand('todoLens.enterLicense', () => license.enterKey()),
    vscode.commands.registerCommand('todoLens.removeLicense', () => license.removeKey()),
    vscode.commands.registerCommand('todoLens.buyPro', () => vscode.env.openExternal(vscode.Uri.parse(BUY_URL))),
    vscode.workspace.onDidChangeConfiguration(e => e.affectsConfiguration('todoLens') && updateCounts()),
  );

  void vscode.commands.executeCommand('setContext', 'todoLens.groupBy', 'file');
  updateCounts();
  const firstScan = store.scanAll();
  if (vscode.workspace.workspaceFolders?.length) void recordUse(context, license);
  return { items: () => store.items, scan: () => firstScan.then(() => store.scanAll()) };
}

async function gitEmail(): Promise<string | undefined> {
  const { execFile } = await import('node:child_process');
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return new Promise(resolve =>
    execFile('git', ['config', 'user.email'], { cwd }, (err, out) => resolve(err ? undefined : out.trim() || undefined)),
  );
}

export function deactivate(): void {}
