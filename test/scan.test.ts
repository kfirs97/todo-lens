import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseRipgrep, scanFolder, itemFromLine, todoPattern, bundledRipgrep } from '../src/scan';
import { DEFAULT_TAGS } from '../src/tags';

test('ripgrep output is parsed and filtered to real comments', () => {
  const out = [
    'src/a.ts:3:  // TODO: wire up auth',
    'src/a.ts:9:const s = "TODO in a string";',
    'lib/b.py:12:x = 1  # FIXME off by one',
    'C:\\repo\\c.ts:4:/* HACK temporary */',
    'docs/readme.txt:1:TODO no syntax known',
  ].join('\n');
  assert.deepEqual(parseRipgrep(out, DEFAULT_TAGS).map(i => [i.file, i.line, i.tag, i.message]), [
    ['src/a.ts', 2, 'TODO', 'wire up auth'],
    ['lib/b.py', 11, 'FIXME', 'off by one'],
    ['C:\\repo\\c.ts', 3, 'HACK', 'temporary'],
  ]);
});

test('continuation lines inside block comments count', () => {
  assert.equal(itemFromLine('a.ts', 0, ' * TODO: document params', DEFAULT_TAGS)?.message, 'document params');
  assert.equal(itemFromLine('a.py', 0, ' * TODO: not a block in python', DEFAULT_TAGS), undefined);
});

test('pattern only includes TODO-style tags', () => {
  assert.equal(todoPattern(DEFAULT_TAGS), '\\b(TODO|FIXME|BUG|HACK|XXX)\\b');
});

function fixture(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'todo-lens-')));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'node_modules/pkg'), { recursive: true });
  writeFileSync(join(dir, 'src/app.ts'), 'export {}; // TODO: first\n/**\n * FIXME second\n */\nconst u = "TODO no";\n');
  writeFileSync(join(dir, 'node_modules/pkg/index.js'), '// TODO ignored dependency\n');
  writeFileSync(join(dir, 'script.sh'), 'echo hi # HACK third\n');
  return dir;
}

const summary = (items: { file: string; line: number; tag: string }[], root: string) =>
  items.map(i => `${i.file.slice(root.length + 1)}:${i.line}:${i.tag}`).sort();

test('node fallback scans a folder and skips dependencies', async () => {
  const dir = fixture();
  const items = await scanFolder(dir, { tags: DEFAULT_TAGS, exclude: [], maxResults: 100 });
  assert.deepEqual(summary(items, dir), ['script.sh:0:HACK', 'src/app.ts:0:TODO', 'src/app.ts:2:FIXME']);
  rmSync(dir, { recursive: true, force: true });
});

test('ripgrep scan gives the same results when rg is available', async (t) => {
  // Prefer the ripgrep bundled with a local VS Code install, like the extension does at runtime.
  let rg = bundledRipgrep('/Applications/Visual Studio Code.app/Contents/Resources/app');
  if (!rg) {
    try {
      rg = execFileSync('which', ['rg']).toString().trim();
    } catch {
      return t.skip('no ripgrep available');
    }
  }
  const dir = fixture();
  const items = await scanFolder(dir, { tags: DEFAULT_TAGS, exclude: ['**/node_modules/**'], maxResults: 100, ripgrep: rg });
  assert.deepEqual(summary(items, dir), ['script.sh:0:HACK', 'src/app.ts:0:TODO', 'src/app.ts:2:FIXME']);
  rmSync(dir, { recursive: true, force: true });
});
