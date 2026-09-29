import type { CommentSpan } from './comments';

export interface TagStyle {
  /** Text that starts the comment, e.g. "TODO" or "!". Matched case-insensitively. */
  tag: string;
  color?: string;
  backgroundColor?: string;
  strikethrough?: boolean;
  bold?: boolean;
  italic?: boolean;
  /** Whether comments with this tag appear in the TODO tree. */
  todo?: boolean;
}

export const DEFAULT_TAGS: TagStyle[] = [
  { tag: '!', color: '#FF2D00' },
  { tag: '?', color: '#3498DB' },
  { tag: '//', color: '#474747', strikethrough: true },
  { tag: '*', color: '#98C379' },
  { tag: 'TODO', color: '#FF8C00', bold: true, todo: true },
  { tag: 'FIXME', color: '#FF2D00', bold: true, todo: true },
  { tag: 'BUG', color: '#FF2D00', bold: true, todo: true },
  { tag: 'HACK', color: '#D19A66', bold: true, todo: true },
  { tag: 'XXX', color: '#FF2D00', bold: true, todo: true },
  { tag: 'NOTE', color: '#3498DB', todo: false },
];

export interface TagMatch {
  line: number;
  start: number;
  end: number;
  tag: TagStyle;
  /** Comment text after the tag, e.g. "handle retries" for `// TODO: handle retries`. */
  message: string;
}

const isWord = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_]/.test(c);

/** Matches the tag a comment starts with. Word tags must end at a word boundary ("TODOS" isn't "TODO"). */
export function matchTag(span: CommentSpan, tags: TagStyle[]): TagMatch | undefined {
  const lead = span.text.length - span.text.trimStart().length;
  const body = span.text.slice(lead);
  const upper = body.toUpperCase();
  const sorted = [...tags].sort((a, b) => b.tag.length - a.tag.length);
  for (const tag of sorted) {
    const t = tag.tag.toUpperCase();
    if (!upper.startsWith(t)) continue;
    if (isWord(t[t.length - 1]) && isWord(body[t.length])) continue;
    const message = body.slice(t.length).replace(/^(\([^)]*\))?\s*[:\-]?\s*/, '').trimEnd();
    return { line: span.line, start: span.start + lead, end: span.end, tag, message };
  }
  return undefined;
}
