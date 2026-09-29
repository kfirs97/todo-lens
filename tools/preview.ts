/** Renders a VS Code-like mock (tree + highlighted editor) from the real scanner/parser: node dist-test/preview.js <demo dir> <file in demo> <out.html> [blame] */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { findComments } from '../src/comments';
import { matchTag, DEFAULT_TAGS } from '../src/tags';
import { languageForPath, syntaxFor } from '../src/syntax';
import { scanFolder } from '../src/scan';

const [dir, file, out, withBlame] = process.argv.slice(2);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ICON: Record<string, [string, string]> = { TODO: ['☑', '#FF8C00'], FIXME: ['🔧', '#F14C4C'], BUG: ['🐞', '#F14C4C'], HACK: ['🔥', '#CCA700'], XXX: ['⚠', '#F14C4C'] };
const FAKE_BLAME = ['2y old · Leo Martins', '8mo old · Priya Raman', '3d old · Maya Chen', '1y old · Sam Okafor', '5mo old · Maya Chen', '14d old · Leo Martins', '2mo old · Priya Raman'];

(async () => {
  const items = await scanFolder(dir, { tags: DEFAULT_TAGS, exclude: [], maxResults: 100 });
  const byFile = new Map<string, typeof items>();
  for (const i of items.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
  let k = 0;
  const tree = [...byFile.entries()].map(([f, list]) => `
    <div class="row group"><span class="chev">⌄</span><span class="ficon">${esc((f.split(".").pop() ?? "").toUpperCase().slice(0, 2))}</span>${esc(basename(f))}<span class="desc">${esc(relative(dir, f).replace(/[^/]*$/, '').replace(/\/$/, ''))} · ${list.length}</span></div>
    ${list.map(i => `<div class="row item"><span class="ticon" style="color:${ICON[i.tag]?.[1]}">${ICON[i.tag]?.[0] ?? '•'}</span>${esc(i.message)}<span class="desc">${i.tag} · line ${i.line + 1}${withBlame ? ` · ${FAKE_BLAME[k++ % FAKE_BLAME.length]}` : ''}</span></div>`).join('')}`).join('');

  const path = join(dir, file);
  const lines = readFileSync(path, 'utf8').replace(/\n$/, '').split('\n');
  const marks = new Map<number, { start: number; end: number; style: string }>();
  for (const span of findComments(lines, syntaxFor(languageForPath(path)!)!)) {
    const m = matchTag(span, DEFAULT_TAGS);
    if (!m) continue;
    const t = m.tag;
    marks.set(m.line, { start: m.start, end: m.end, style: `color:${t.color};${t.bold ? 'font-weight:600;' : ''}${t.strikethrough ? 'text-decoration:line-through;' : ''}` });
  }
  const code = lines.map((text, n) => {
    const m = marks.get(n);
    const isComment = findComments([text], syntaxFor(languageForPath(path)!)!).length > 0 || /^\s*(\*|\/\*\*)/.test(text);
    const body = m
      ? `${esc(text.slice(0, m.start))}<span style="${m.style}">${esc(text.slice(m.start, m.end))}</span>${esc(text.slice(m.end))}`
      : esc(text);
    return `<div class="ln"><span class="num">${n + 1}</span><span class="${isComment && !m ? 'cm' : ''}">${body || ' '}</span></div>`;
  }).join('');

  writeFileSync(out, `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#1f1f1f;color:#ccc;font:13px -apple-system,BlinkMacSystemFont,sans-serif;display:flex;height:100vh}
    .act{width:48px;background:#181818;border-right:1px solid #2b2b2b;display:flex;flex-direction:column;align-items:center;padding-top:10px;gap:22px;color:#858585;font-size:20px}
    .act .on{color:#e7e7e7;border-left:2px solid #0078d4;width:46px;text-align:center;position:relative}
    .act .badge{position:absolute;right:6px;bottom:-4px;background:#0078d4;color:#fff;font-size:9px;border-radius:8px;padding:0 4px}
    .side{width:${withBlame ? 560 : 420}px;background:#181818;border-right:1px solid #2b2b2b}
    .title{padding:10px 20px;font-size:11px;letter-spacing:.5px;color:#bbb;display:flex;justify-content:space-between}
    .row{height:22px;line-height:22px;padding-left:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .row.item{padding-left:40px}.row:hover{background:#2a2d2e}
    .chev{display:inline-block;width:14px;color:#aaa}.ficon{color:#3b8eea;font-size:9px;font-weight:700;margin:0 6px}
    .ticon{display:inline-block;width:20px}.desc{color:#8b8b8b;margin-left:8px;font-size:12px}
    .editor{flex:1;display:flex;flex-direction:column}
    .tabs{height:35px;background:#181818;border-bottom:1px solid #2b2b2b}.tab{display:inline-block;height:35px;line-height:35px;padding:0 16px;background:#1f1f1f;border-top:1px solid #0078d4;color:#fff}
    .code{padding-top:6px;font:13px/19px Menlo,monospace;color:#d4d4d4}
    .num{display:inline-block;width:44px;text-align:right;padding-right:22px;color:#6e7681}.cm{color:#6a9955}
    .status{position:fixed;bottom:0;left:0;right:0;height:22px;background:#181818;border-top:1px solid #2b2b2b;color:#ccc;font-size:12px;line-height:22px;padding-left:10px}
  </style></head><body>
  <div class="act"><span>⧉</span><span>⌕</span><span>⑂</span><span class="on">☑<span class="badge">${items.length}</span></span></div>
  <div class="side"><div class="title"><span>TODO LENS: TODOS</span><span>🏷 👤 ⟳</span></div>${tree}</div>
  <div class="editor"><div class="tabs"><span class="tab">${esc(basename(path))}</span></div><div class="code">${code}</div></div>
  <div class="status">⑂ main &nbsp;&nbsp; ☑ ${items.length}</div>
  </body></html>`);
})();
