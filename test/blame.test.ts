import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { blameFile, formatAge, parseBlamePorcelain } from '../src/blame';

test('blames committed and uncommitted lines of a real repo', async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'todo-lens-blame-')));
  const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: '@1700000000 +0000', GIT_COMMITTER_DATE: '@1700000000 +0000' } });
  git('init', '-q');
  git('config', 'user.name', 'Maya Chen');
  git('config', 'user.email', 'maya@example.dev');
  git('config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, 'a.ts'), '// TODO one\nconst x = 1;\n// TODO one again\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  writeFileSync(join(dir, 'a.ts'), '// TODO one\nconst x = 1;\n// TODO one again\n// FIXME new\n');
  const blame = await blameFile(join(dir, 'a.ts'));
  assert.deepEqual(blame.get(1), { author: 'Maya Chen', email: 'maya@example.dev', time: 1700000000 });
  assert.deepEqual(blame.get(3), blame.get(1), 'repeated commit headers reuse author info');
  assert.equal(blame.get(4)?.author, 'You');
  assert.equal(blame.get(4)?.time, 0);
  assert.equal((await blameFile(join(dir, 'missing.ts'))).size, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('porcelain parser handles an empty input', () => {
  assert.equal(parseBlamePorcelain('').size, 0);
});

test('ages read naturally', () => {
  const now = 1_800_000_000;
  assert.equal(formatAge(0, now), 'uncommitted');
  assert.equal(formatAge(now - 3600, now), 'today');
  assert.equal(formatAge(now - 5 * 86400, now), '5d old');
  assert.equal(formatAge(now - 95 * 86400, now), '3mo old');
  assert.equal(formatAge(now - 2 * 365 * 86400, now), '2y old');
  assert.equal(formatAge(now - 548 * 86400, now), '1.5y old');
});
