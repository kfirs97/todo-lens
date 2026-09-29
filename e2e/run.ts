import { runTests } from '@vscode/test-electron';
import { mkdtempSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

(async () => {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), 'todo-lens-e2e-')));
  mkdirSync(join(ws, 'src'));
  writeFileSync(join(ws, 'src/app.ts'), '// TODO: first\nconst x = "TODO not this";\n/* FIXME second */\n');
  writeFileSync(join(ws, 'tool.py'), 'x = 1  # HACK third\n');
  await runTests({
    extensionDevelopmentPath: resolve(__dirname, '../..'),
    extensionTestsPath: resolve(__dirname, 'suite.js'),
    launchArgs: [ws, '--disable-extensions', '--skip-welcome', '--skip-release-notes'],
  });
})().catch(err => {
  console.error(err);
  process.exit(1);
});
