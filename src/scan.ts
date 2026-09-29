import { execFile } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import { join, relative } from 'node:path';
import { findComments } from './comments';
import { matchTag, TagStyle } from './tags';
import { languageForPath, syntaxFor } from './syntax';

export interface TodoItem {
  file: string; // absolute path
  line: number; // 0-based
  column: number; // 0-based, where the tag starts
  tag: string;
  message: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex (ripgrep/JS compatible) matching any TODO-style tag as a whole word. */
export function todoPattern(tags: TagStyle[]): string {
  return `\\b(${tags.filter(t => t.todo).map(t => escapeRegex(t.tag)).join('|')})\\b`;
}

/** Turns one matching line into a TODO item if the tag is really inside a comment. */
export function itemFromLine(file: string, line: number, text: string, tags: TagStyle[]): TodoItem | undefined {
  const syntax = syntaxFor(languageForPath(file) ?? '');
  if (!syntax) return undefined;
  const todoTags = tags.filter(t => t.todo);
  let spans = findComments([text], syntax);
  // A line inside a multi-line block comment (" * TODO ...") has no opening delimiter of its own.
  if (spans.length === 0 && syntax.block.length > 0 && /^\s*\*\s/.test(text)) {
    const start = text.indexOf('*') + 1;
    spans = [{ line: 0, start, end: text.length, text: text.slice(start) }];
  }
  for (const span of spans) {
    const m = matchTag(span, todoTags);
    if (m) return { file, line, column: m.start, tag: m.tag.tag.toUpperCase(), message: m.message };
  }
  return undefined;
}

/** Parses `rg --no-heading --with-filename --line-number` output ("path:line:text"). */
export function parseRipgrep(out: string, tags: TagStyle[]): TodoItem[] {
  const items: TodoItem[] = [];
  for (const raw of out.split('\n')) {
    const m = /^(.*?):(\d+):(.*)$/.exec(raw);
    if (!m) continue;
    const item = itemFromLine(m[1], Number(m[2]) - 1, m[3], tags);
    if (item) items.push(item);
  }
  return items;
}

/** Locates the ripgrep binary that ships inside VS Code. */
export function bundledRipgrep(appRoot: string): string | undefined {
  const exe = process.platform === 'win32' ? 'rg.exe' : 'rg';
  return ['node_modules/@vscode/ripgrep/bin', 'node_modules.asar.unpacked/@vscode/ripgrep/bin']
    .map(dir => join(appRoot, dir, exe))
    .find(existsSync);
}

export interface ScanOptions {
  tags: TagStyle[];
  exclude: string[]; // glob patterns, e.g. "**/node_modules/**"
  maxResults: number;
  ripgrep?: string;
}

export async function scanFolder(folder: string, opts: ScanOptions): Promise<TodoItem[]> {
  const items = opts.ripgrep ? await scanWithRipgrep(folder, opts) : await scanWithNode(folder, opts);
  return items.slice(0, opts.maxResults);
}

function scanWithRipgrep(folder: string, opts: ScanOptions): Promise<TodoItem[]> {
  const args = [
    '--no-heading', '--with-filename', '--line-number', '--no-messages', '--color', 'never',
    '--max-filesize', '1M', '--max-columns', '1000', '-i', '-e', todoPattern(opts.tags),
    ...opts.exclude.flatMap(g => ['-g', `!${g}`]),
    '.',
  ];
  return new Promise((resolve, reject) => {
    execFile(opts.ripgrep!, args, { cwd: folder, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      // Exit code 1 means "no matches".
      if (err && (err as NodeJS.ErrnoException & { code?: number }).code !== 1) return reject(err);
      const items = parseRipgrep(stdout, opts.tags).map(i => ({ ...i, file: join(folder, i.file) }));
      resolve(items);
    });
  });
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', '.next', 'target', 'vendor', '.venv', 'venv', '__pycache__', 'coverage']);

async function scanWithNode(folder: string, opts: ScanOptions): Promise<TodoItem[]> {
  const regex = new RegExp(todoPattern(opts.tags), 'i');
  const items: TodoItem[] = [];
  let files = 0;
  async function walk(dir: string): Promise<void> {
    if (items.length >= opts.maxResults || files > 20000) return;
    for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(path);
      } else if (entry.isFile() && languageForPath(path)) {
        files++;
        const stat = await fs.stat(path).catch(() => null);
        if (!stat || stat.size > 1024 * 1024) continue;
        const lines = (await fs.readFile(path, 'utf8').catch(() => '')).split('\n');
        lines.forEach((text, line) => {
          if (!regex.test(text)) return;
          const item = itemFromLine(relative(folder, path), line, text, opts.tags);
          if (item) items.push({ ...item, file: path });
        });
      }
    }
  }
  await walk(folder);
  return items;
}
