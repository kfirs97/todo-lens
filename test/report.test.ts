import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownReport } from '../src/report';

const items = [
  { file: '/r/src/b.ts', line: 4, column: 3, tag: 'FIXME', message: 'pipe | char' },
  { file: '/r/src/a.ts', line: 9, column: 3, tag: 'TODO', message: 'later' },
  { file: '/r/src/a.ts', line: 1, column: 3, tag: 'TODO', message: 'first' },
];
const rel = (f: string) => f.replace('/r/', '');

test('report groups by file, sorts by line, escapes pipes', () => {
  const md = markdownReport(items, rel);
  assert.match(md, /3 items in 2 files — 2 TODO, 1 FIXME\./);
  assert.ok(md.indexOf('## src/a.ts') < md.indexOf('## src/b.ts'));
  assert.ok(md.indexOf('| 2 | TODO | first |') < md.indexOf('| 10 | TODO | later |'));
  assert.match(md, /pipe \\\| char/);
});

test('report includes author and age when blame info is provided', () => {
  const blame = new Map(items.map(i => [i, { author: 'Maya Chen', email: 'm@x', time: 1_800_000_000 - 40 * 86400 }]));
  assert.match(markdownReport(items, rel, blame, 1_800_000_000), /\| 5 \| FIXME \| pipe \\\| char \| Maya Chen \| 1mo old \|/);
});
