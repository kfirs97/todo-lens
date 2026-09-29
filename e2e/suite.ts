import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import type { TodoLensApi } from '../src/extension';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension<TodoLensApi>('branchline.todo-lens')!;
  const api = await ext.activate();
  await api.scan();
  const summary = () => api.items().map(i => `${vscode.workspace.asRelativePath(i.file)}:${i.line}:${i.tag}:${i.message}`).sort();
  assert.deepEqual(summary(), ['src/app.ts:0:TODO:first', 'src/app.ts:2:FIXME:second', 'tool.py:0:HACK:third'], 'initial scan uses bundled ripgrep');

  // Saving a file updates just that file.
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, 'tool.py'));
  const editor = await vscode.window.showTextDocument(doc);
  await editor.edit(e => e.insert(new vscode.Position(1, 0), '# BUG: new one\n'));
  await doc.save();
  await sleep(500);
  assert.ok(summary().includes('tool.py:1:BUG:new one'), 'save triggers rescan');

  await vscode.commands.executeCommand('todoLens.tree.focus');
  await vscode.commands.executeCommand('todoLens.groupByTag');
  await vscode.commands.executeCommand('todoLens.groupByFile');
  console.log('E2E: all checks passed');
}
