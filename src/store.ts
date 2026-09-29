import * as vscode from 'vscode';
import { bundledRipgrep, itemFromLine, scanFolder, TodoItem } from './scan';
import { config } from './config';
import { blameFile, LineBlame } from './blame';

const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/out/**', '**/build/**', '**/.git/**', '**/vendor/**', '**/*.min.*'];

/** All TODOs in the workspace, kept current as files change. */
export class TodoStore implements vscode.Disposable {
  private byFile = new Map<string, TodoItem[]>();
  private blames = new Map<string, Promise<Map<number, LineBlame>>>();
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;
  private readonly disposables: vscode.Disposable[] = [];
  private scanning: Promise<void> | undefined;

  constructor() {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    this.disposables.push(
      watcher,
      watcher.onDidCreate(uri => this.rescanFile(uri)),
      watcher.onDidDelete(uri => this.removeFile(uri.fsPath)),
      vscode.workspace.onDidSaveTextDocument(doc => this.rescanFile(doc.uri)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.scanAll()),
      vscode.workspace.onDidChangeConfiguration(e => e.affectsConfiguration('todoLens') && this.scanAll()),
    );
  }

  get items(): TodoItem[] {
    return [...this.byFile.values()].flat();
  }

  scanAll(): Promise<void> {
    this.scanning ??= (async () => {
      const { tags, exclude, maxResults } = config();
      const ripgrep = bundledRipgrep(vscode.env.appRoot);
      const next = new Map<string, TodoItem[]>();
      for (const folder of vscode.workspace.workspaceFolders ?? []) {
        if (folder.uri.scheme !== 'file') continue;
        const items = await scanFolder(folder.uri.fsPath, { tags, exclude: [...DEFAULT_EXCLUDE, ...exclude], maxResults, ripgrep });
        for (const item of items) next.set(item.file, [...(next.get(item.file) ?? []), item]);
      }
      this.byFile = next;
      this.blames.clear();
      this.changed.fire();
    })().finally(() => (this.scanning = undefined));
    return this.scanning;
  }

  private async rescanFile(uri: vscode.Uri): Promise<void> {
    if (uri.scheme !== 'file' || !vscode.workspace.getWorkspaceFolder(uri)) return;
    if (/[\\/](node_modules|\.git|dist|out|build)[\\/]/.test(uri.fsPath)) return;
    let text: string;
    try {
      text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
      return;
    }
    if (text.length > 1024 * 1024) return;
    const { tags } = config();
    const items = text.split(/\r?\n/).flatMap((line, i) => itemFromLine(uri.fsPath, i, line, tags) ?? []);
    const had = this.byFile.has(uri.fsPath);
    if (items.length) this.byFile.set(uri.fsPath, items);
    else this.byFile.delete(uri.fsPath);
    this.blames.delete(uri.fsPath);
    if (items.length || had) this.changed.fire();
  }

  private removeFile(file: string): void {
    const prefix = file.endsWith('/') ? file : `${file}/`;
    let removed = false;
    for (const key of [...this.byFile.keys()]) {
      if (key === file || key.startsWith(prefix)) removed = this.byFile.delete(key) || removed;
    }
    if (removed) this.changed.fire();
  }

  /** Author and age of a TODO's line (Pro). Blames each file once and caches the result. */
  async blame(item: TodoItem): Promise<LineBlame | undefined> {
    let file = this.blames.get(item.file);
    if (!file) this.blames.set(item.file, (file = blameFile(item.file)));
    return (await file).get(item.line + 1);
  }

  dispose(): void {
    this.changed.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
