import * as esbuild from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const production = args.has('--production');
const common = { bundle: true, sourcemap: !production, minify: production, logLevel: 'warning', platform: 'node', format: 'cjs', external: ['vscode'] };

if (args.has('--tests')) {
  rmSync('dist-test', { recursive: true, force: true });
  await esbuild.build({ ...common, entryPoints: readdirSync('test').filter(f => f.endsWith('.test.ts')).map(f => `test/${f}`), outdir: 'dist-test' });
} else if (args.has('--watch')) {
  await (await esbuild.context({ ...common, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js' })).watch();
} else {
  await esbuild.build({ ...common, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js' });
}
