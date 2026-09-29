import * as vscode from 'vscode';
import { basename } from 'node:path';
import { TodoItem } from './scan';
import { TodoStore } from './store';
import { License } from './license';
import { formatAge, LineBlame } from './blame';

type Node = { kind: 'group'; label: string; items: TodoItem[]; file?: string } | { kind: 'item'; item: TodoItem };
export type GroupBy = 'file' | 'tag';

const TAG_ICONS: Record<string, [string, string]> = {
  TODO: ['checklist', 'charts.orange'],
  FIXME: ['tools', 'charts.red'],
  BUG: ['bug', 'charts.red'],
  HACK: ['flame', 'charts.yellow'],
  XXX: ['warning', 'charts.red'],
};

export class TodoTree implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  groupBy: GroupBy = 'file';
  /** Pro: only TODOs whose line was last changed by this email. */
  mineOnly: string | null = null;
  private blameCache = new Map<TodoItem, LineBlame | undefined>();

  constructor(private readonly store: TodoStore, private readonly license: License) {
    store.onDidChange(() => this.refresh());
    license.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.blameCache.clear();
    this.changed.fire(undefined);
  }

  private async visible(): Promise<TodoItem[]> {
    const items = this.store.items;
    if (!this.mineOnly || !this.license.isPro) return items;
    const blamed = await Promise.all(items.map(async i => [i, await this.store.blame(i)] as const));
    return blamed.filter(([, b]) => b && (b.email === this.mineOnly || b.time === 0)).map(([i]) => i);
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (node?.kind === 'group') return sortItems(node.items).map(item => ({ kind: 'item', item }));
    if (node) return [];
    const items = await this.visible();
    const groups = new Map<string, TodoItem[]>();
    for (const item of items) {
      const key = this.groupBy === 'file' ? item.file : item.tag;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, list]) => ({ kind: 'group', label: key, items: list, file: this.groupBy === 'file' ? key : undefined }));
  }

  async getTreeItem(node: Node): Promise<vscode.TreeItem> {
    if (node.kind === 'group') {
      const t = new vscode.TreeItem(
        node.file ? basename(node.file) : node.label,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      if (node.file) {
        t.resourceUri = vscode.Uri.file(node.file);
        t.description = `${vscode.workspace.asRelativePath(node.file, false).replace(/[^/\\]*$/, '').replace(/[/\\]$/, '')} · ${node.items.length}`;
        t.iconPath = vscode.ThemeIcon.File;
      } else {
        t.description = String(node.items.length);
        t.iconPath = tagIcon(node.label);
      }
      return t;
    }
    const { item } = node;
    const t = new vscode.TreeItem(item.message || item.tag);
    t.iconPath = tagIcon(item.tag);
    t.description = this.groupBy === 'tag' ? `${basename(item.file)}:${item.line + 1}` : `${item.tag} · line ${item.line + 1}`;
    t.tooltip = `${item.tag}: ${item.message}\n${vscode.workspace.asRelativePath(item.file)}:${item.line + 1}`;
    if (this.license.isPro) {
      const b = await this.blameOf(item);
      if (b) {
        t.description += ` · ${formatAge(b.time)} · ${b.author}`;
        t.tooltip += `\n${b.author}${b.email ? ` <${b.email}>` : ''} · ${formatAge(b.time)}`;
      }
    }
    t.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [vscode.Uri.file(item.file), { selection: new vscode.Range(item.line, item.column, item.line, item.column) }],
    };
    return t;
  }

  private async blameOf(item: TodoItem): Promise<LineBlame | undefined> {
    if (!this.blameCache.has(item)) this.blameCache.set(item, await this.store.blame(item));
    return this.blameCache.get(item);
  }
}

function sortItems(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function tagIcon(tag: string): vscode.ThemeIcon {
  const [icon, color] = TAG_ICONS[tag] ?? ['note', 'charts.blue'];
  return new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
}
