import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findComments } from '../src/comments';
import { matchTag, DEFAULT_TAGS } from '../src/tags';
import { syntaxFor, syntaxForEditor, languageForPath } from '../src/syntax';

const tags = (lang: string, src: string) =>
  findComments(src.split('\n'), syntaxFor(lang)!)
    .map(c => matchTag(c, DEFAULT_TAGS))
    .filter(Boolean)
    .map(m => [m!.line, m!.tag.tag, m!.message]);

test('line comments with tags in C-like languages', () => {
  assert.deepEqual(tags('typescript', [
    'const a = 1; // TODO: handle retries',
    '// ! careful here',
    '// ? why does this work',
    '// * important',
    '// // old code',
    '// plain comment',
  ].join('\n')), [
    [0, 'TODO', 'handle retries'],
    [1, '!', 'careful here'],
    [2, '?', 'why does this work'],
    [3, '*', 'important'],
    [4, '//', 'old code'],
  ]);
});

test('strings are not comments', () => {
  assert.deepEqual(tags('javascript', 'const u = "http://x.com // TODO not a comment"; // FIXME real'), [[0, 'FIXME', 'real']]);
  assert.deepEqual(tags('javascript', "const s = 'it\\'s // TODO nope'; // TODO yes"), [[0, 'TODO', 'yes']]);
  assert.deepEqual(tags('python', 's = "# TODO nope"  # TODO yes'), [[0, 'TODO', 'yes']]);
});

test('block comments across lines, JSDoc and continuation stars', () => {
  const src = ['/**', ' * Parses input.', ' * TODO: support streams', ' */', 'x = 1; /* FIXME inline */ y = 2;'].join('\n');
  assert.deepEqual(tags('typescript', src), [[2, 'TODO', 'support streams'], [4, 'FIXME', 'inline']]);
  assert.deepEqual(tags('typescript', '/** documented */'), [], 'doc comment is not a * highlight');
  assert.deepEqual(tags('html', '<p>hi</p> <!-- TODO translate -->'), [[0, 'TODO', 'translate']]);
});

test('word tags need a boundary, are case-insensitive, and accept owner/colon forms', () => {
  assert.deepEqual(tags('python', '# TODOS are not todos\n# todo(maya): lowercase\n# FIXME - dash'), [
    [1, 'TODO', 'lowercase'],
    [2, 'FIXME', 'dash'],
  ]);
});

test('language quirks: Rust lifetimes, SQL, Lua blocks', () => {
  assert.deepEqual(tags('rust', "fn f<'a>(x: &'a str) {} // TODO lifetimes"), [[0, 'TODO', 'lifetimes']]);
  assert.deepEqual(tags('sql', "SELECT '--' AS x; -- TODO index this"), [[0, 'TODO', 'index this']]);
  assert.deepEqual(tags('lua', '--[[ TODO block ]] x = 1 -- FIXME line'), [[0, 'TODO', 'block'], [0, 'FIXME', 'line']]);
});

test('match ranges cover the tag through the end of the comment', () => {
  const [span] = findComments(['let x; // TODO: later'], syntaxFor('typescript')!);
  const m = matchTag(span, DEFAULT_TAGS)!;
  assert.equal('let x; // TODO: later'.slice(m.start, m.end), 'TODO: later');
});

test('language detection from file paths', () => {
  assert.equal(languageForPath('src/a.tsx'), 'typescriptreact');
  assert.equal(languageForPath('/x/Dockerfile'), 'dockerfile');
  assert.equal(languageForPath('.env.local'), 'dotenv');
  assert.equal(languageForPath('README'), undefined);
});

test('GDScript (Godot) comments are recognized, in the editor and in workspace scans', () => {
  assert.equal(languageForPath('res/player.gd'), 'gdscript');
  const spans = findComments(['var speed = 10 # TODO: tune this', 'var tag = "# not a comment"'], syntaxFor('gdscript')!);
  assert.deepEqual(spans.map(s => s.text.trim()), ['TODO: tune this']);
  assert.deepEqual(syntaxForEditor('gdscript'), syntaxFor('gdscript'));
  assert.deepEqual(syntaxForEditor('plaintext', '/game/player.gd'), syntaxFor('gdscript'), '.gd opened as plain text');
});

test('unknown languages fall back to common comment styles in the editor; data formats do not', () => {
  const syntax = syntaxForEditor('some-new-language')!;
  const spans = findComments(['x = 1 // TODO: a', 'y = 2 # FIXME: b', '/* NOTE: c */'], syntax);
  assert.deepEqual(spans.map(s => s.text.trim()), ['TODO: a', 'FIXME: b', 'NOTE: c']);
  for (const id of ['plaintext', 'json', 'log', 'csv']) assert.equal(syntaxForEditor(id), undefined, id);
  assert.equal(syntaxFor('some-new-language'), undefined, 'workspace scan stays conservative');
});
