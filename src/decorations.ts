import * as vscode from 'vscode';
import { findComments } from './comments';
import { syntaxFor } from './syntax';
import { matchTag, TagStyle } from './tags';
import { config } from './config';

/** Colors tagged comments in visible editors. */
export class Highlighter implements vscode.Disposable {
  private types = new Map<string, vscode.TextEditorDecorationType>();
  private timer: NodeJS.Timeout | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.rebuildTypes();
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => this.schedule(0)),
      vscode.workspace.onDidChangeTextDocument(e => {
        if (vscode.window.visibleTextEditors.some(ed => ed.document === e.document)) this.schedule(150);
      }),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('todoLens')) {
          this.rebuildTypes();
          this.schedule(0);
        }
      }),
    );
    this.schedule(0);
  }

  private rebuildTypes(): void {
    this.types.forEach(t => t.dispose());
    this.types.clear();
    for (const tag of config().tags) this.types.set(tag.tag.toUpperCase(), createType(tag));
  }

  private schedule(ms: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => vscode.window.visibleTextEditors.forEach(e => this.decorate(e)), ms);
  }

  private decorate(editor: vscode.TextEditor): void {
    const { tags, highlight } = config();
    const byTag = new Map<string, vscode.Range[]>([...this.types.keys()].map(k => [k, []]));
    const syntax = syntaxFor(editor.document.languageId);
    if (highlight && syntax && editor.document.lineCount < 50_000) {
      const lines = editor.document.getText().split(/\r?\n/);
      for (const span of findComments(lines, syntax)) {
        const m = matchTag(span, tags);
        if (m) byTag.get(m.tag.tag.toUpperCase())?.push(new vscode.Range(m.line, m.start, m.line, m.end));
      }
    }
    for (const [key, type] of this.types) editor.setDecorations(type, byTag.get(key) ?? []);
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.types.forEach(t => t.dispose());
    this.disposables.forEach(d => d.dispose());
  }
}

function createType(tag: TagStyle): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    color: tag.color,
    backgroundColor: tag.backgroundColor,
    fontWeight: tag.bold ? 'bold' : undefined,
    fontStyle: tag.italic ? 'italic' : undefined,
    textDecoration: tag.strikethrough ? 'line-through' : undefined,
    overviewRulerColor: tag.todo ? tag.color : undefined,
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });
}
