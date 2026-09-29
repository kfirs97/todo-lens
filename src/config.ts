import * as vscode from 'vscode';
import { DEFAULT_TAGS, TagStyle } from './tags';

export function config() {
  const c = vscode.workspace.getConfiguration('todoLens');
  const tags = c.get<TagStyle[]>('tags');
  return {
    tags: tags && tags.length ? tags : DEFAULT_TAGS,
    highlight: c.get<boolean>('highlightComments', true),
    exclude: c.get<string[]>('exclude', []),
    maxResults: c.get<number>('maxResults', 5000),
    showStatusBar: c.get<boolean>('showStatusBarItem', true),
  };
}
