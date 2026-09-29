import { TodoItem } from './scan';
import { formatAge, LineBlame } from './blame';

/** Markdown report of TODOs grouped by file, with author/age columns when blame info is given. */
export function markdownReport(items: TodoItem[], relative: (file: string) => string, blame?: Map<TodoItem, LineBlame | undefined>, now?: number): string {
  const byFile = new Map<string, TodoItem[]>();
  for (const i of [...items].sort((a, b) => relative(a.file).localeCompare(relative(b.file)) || a.line - b.line)) {
    byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
  }
  const counts = new Map<string, number>();
  items.forEach(i => counts.set(i.tag, (counts.get(i.tag) ?? 0) + 1));
  const summary = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}`).join(', ');
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  const out = [`# TODO report`, '', `${items.length} items in ${byFile.size} files${summary ? ` — ${summary}` : ''}.`, ''];
  for (const [file, list] of byFile) {
    out.push(`## ${relative(file)}`, '');
    out.push(blame ? '| Line | Tag | Message | Author | Age |' : '| Line | Tag | Message |');
    out.push(blame ? '| ---: | --- | --- | --- | --- |' : '| ---: | --- | --- |');
    for (const i of list) {
      const b = blame?.get(i);
      const base = `| ${i.line + 1} | ${i.tag} | ${cell(i.message)} |`;
      out.push(blame ? `${base} ${cell(b?.author ?? '')} | ${b ? formatAge(b.time, now) : ''} |` : base);
    }
    out.push('');
  }
  return out.join('\n');
}
