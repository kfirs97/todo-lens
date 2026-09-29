import { execFile } from 'node:child_process';
import { dirname } from 'node:path';

export interface LineBlame {
  author: string;
  email: string;
  time: number; // unix seconds; 0 when the line isn't committed yet
}

/** Parses `git blame --porcelain` output into a map of 1-based line number → author info. */
export function parseBlamePorcelain(out: string): Map<number, LineBlame> {
  const commits = new Map<string, LineBlame>();
  const lines = new Map<number, LineBlame>();
  let current: { hash: string; finalLine: number; count: number } | null = null;
  let pending: Partial<LineBlame> = {};
  for (const row of out.split('\n')) {
    const header = /^([0-9a-f]{40}) \d+ (\d+)(?: (\d+))?$/.exec(row);
    if (header) {
      current = { hash: header[1], finalLine: Number(header[2]), count: Number(header[3] ?? 1) };
      pending = {};
      continue;
    }
    if (!current) continue;
    if (row.startsWith('author ')) pending.author = row.slice(7);
    else if (row.startsWith('author-mail ')) pending.email = row.slice(12).replace(/^<|>$/g, '');
    else if (row.startsWith('author-time ')) pending.time = Number(row.slice(12));
    else if (row.startsWith('\t')) {
      if (pending.author !== undefined) {
        const uncommitted = /^0+$/.test(current.hash);
        commits.set(current.hash, {
          author: uncommitted ? 'You' : pending.author,
          email: uncommitted ? '' : pending.email ?? '',
          time: uncommitted ? 0 : pending.time ?? 0,
        });
      }
      const info = commits.get(current.hash);
      if (info) lines.set(current.finalLine, info);
      current = null;
    }
  }
  return lines;
}

/** Blames a whole file once; returns an empty map when it isn't tracked by git. */
export function blameFile(file: string): Promise<Map<number, LineBlame>> {
  return new Promise(resolve => {
    execFile('git', ['blame', '--porcelain', '--', file], { cwd: dirname(file), maxBuffer: 64 * 1024 * 1024 }, (err, stdout) =>
      resolve(err ? new Map() : parseBlamePorcelain(stdout)),
    );
  });
}

export function formatAge(time: number, now = Date.now() / 1000): string {
  if (!time) return 'uncommitted';
  const days = Math.floor((now - time) / 86400);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d old`;
  if (days < 365) return `${Math.floor(days / 30)}mo old`;
  const years = days / 365;
  return `${years < 10 ? years.toFixed(1).replace(/\.0$/, '') : Math.floor(years)}y old`;
}
