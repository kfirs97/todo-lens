import type { CommentSyntax } from './syntax';

/** The text of one comment on one line, without its delimiters. */
export interface CommentSpan {
  line: number;
  /** Column where the comment's text begins (after the delimiter and, in blocks, a leading `*`). */
  start: number;
  /** Column where the comment's text ends (before a closing delimiter or at the end of the line). */
  end: number;
  text: string;
}

const QUOTES = ['"', '`', "'"];

/**
 * Finds comment text in `lines`. String literals are skipped so `"http://x"` is not a comment;
 * block comments may span lines. Deliberately lightweight: no full tokenizer per language.
 */
export function findComments(lines: string[], syntax: CommentSyntax): CommentSpan[] {
  const spans: CommentSpan[] = [];
  const quotes = (syntax.quotes ?? QUOTES).filter(q => !syntax.line.some(t => t.startsWith(q)));
  let block: [string, string] | null = null;

  lines.forEach((text, line) => {
    let i = 0;
    let continuation = block !== null;
    let quote: string | null = null;
    while (i <= text.length) {
      if (block) {
        const close = text.indexOf(block[1], i);
        let start = i;
        if (continuation) start = skipBlockPrefix(text, start);
        const end = close === -1 ? text.length : close;
        if (end > start) spans.push({ line, start, end, text: text.slice(start, end) });
        if (close === -1) return;
        i = close + block[1].length;
        block = null;
        continuation = false;
        continue;
      }
      if (i >= text.length) return;
      if (quote) {
        if (text[i] === '\\') i += 2;
        else if (text[i] === quote) (quote = null), i++;
        else i++;
        continue;
      }
      const ch = text[i];
      if (quotes.includes(ch)) {
        quote = ch;
        i++;
        continue;
      }
      const lineToken = syntax.line.find(t => text.startsWith(t, i));
      const blockToken = syntax.block.find(([open]) => text.startsWith(open, i));
      // Prefer the longer match, e.g. Lua's `--[[` over `--`.
      if (blockToken && (!lineToken || blockToken[0].length > lineToken.length)) {
        block = blockToken;
        i += blockToken[0].length;
        // Doc comments (`/**`) and continuation lines (` * text`) skip their leading `*`.
        continuation = blockToken[0] === '/*';
        continue;
      }
      if (lineToken) {
        const start = i + lineToken.length;
        spans.push({ line, start, end: text.length, text: text.slice(start) });
        return;
      }
      i++;
    }
  });
  return spans;
}

function skipBlockPrefix(text: string, i: number): number {
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
  if (text[i] === '*' && text[i + 1] !== '/') i++;
  return i;
}
