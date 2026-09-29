/** Comment delimiters per VS Code language id. */
export interface CommentSyntax {
  line: string[];
  block: [string, string][];
  /** String delimiters; defaults to ", ' and `. Rust and Lisps use ' for other things. */
  quotes?: string[];
}

const C_LIKE: CommentSyntax = { line: ['//'], block: [['/*', '*/']] };
const HASH: CommentSyntax = { line: ['#'], block: [] };
const DASH: CommentSyntax = { line: ['--'], block: [] };
const XML: CommentSyntax = { line: [], block: [['<!--', '-->']] };

const BY_LANGUAGE: Record<string, CommentSyntax> = {};
const assign = (syntax: CommentSyntax, ids: string) => ids.split(' ').forEach(id => (BY_LANGUAGE[id] = syntax));

assign(C_LIKE, 'c cpp csharp cuda-cpp dart go groovy java javascript javascriptreact jsonc kotlin less objective-c objective-cpp proto scala scss solidity swift typescript typescriptreact vue zig glsl hlsl haxe apex');
assign(HASH, 'shellscript python ruby perl r yaml dockerfile makefile toml coffeescript elixir julia nim powershell properties cmake graphql terraform nix fish tcl gitignore ignore dotenv crystal');
assign(DASH, 'sql plsql haskell purescript elm ada vhdl');
assign(XML, 'html xml svg markdown vue-html razor');
BY_LANGUAGE.css = { line: [], block: [['/*', '*/']] };
BY_LANGUAGE.php = { line: ['//', '#'], block: [['/*', '*/']] };
BY_LANGUAGE.lua = { line: ['--'], block: [['--[[', ']]']] };
BY_LANGUAGE.rust = { line: ['//'], block: [['/*', '*/']], quotes: ['"'] };
BY_LANGUAGE.clojure = { line: [';'], block: [], quotes: ['"'] };
BY_LANGUAGE.lisp = { line: [';'], block: [], quotes: ['"'] };
BY_LANGUAGE.scheme = { line: [';'], block: [], quotes: ['"'] };
BY_LANGUAGE.ini = { line: [';', '#'], block: [] };
BY_LANGUAGE.bat = { line: ['REM ', '::'], block: [] };
BY_LANGUAGE.vb = { line: ["'"], block: [] };
BY_LANGUAGE.latex = { line: ['%'], block: [] };
BY_LANGUAGE.matlab = { line: ['%'], block: [] };
BY_LANGUAGE.erlang = { line: ['%'], block: [] };
BY_LANGUAGE.fsharp = { line: ['//'], block: [['(*', '*)']] };
BY_LANGUAGE.ocaml = { line: [], block: [['(*', '*)']] };
BY_LANGUAGE.razor = { line: [], block: [['@*', '*@'], ['<!--', '-->']] };
BY_LANGUAGE.svelte = { line: ['//'], block: [['/*', '*/'], ['<!--', '-->']] };
BY_LANGUAGE.astro = { line: ['//'], block: [['/*', '*/'], ['<!--', '-->']] };
BY_LANGUAGE.vue = { line: ['//'], block: [['/*', '*/'], ['<!--', '-->']] };

export function syntaxFor(languageId: string): CommentSyntax | undefined {
  return BY_LANGUAGE[languageId];
}

/** Comment syntax by file extension, for scanning files that aren't open in an editor. */
const BY_EXTENSION: Record<string, string> = {
  ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact', mjs: 'javascript', cjs: 'javascript',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', go: 'go', java: 'java', kt: 'kotlin', kts: 'kotlin',
  rs: 'rust', swift: 'swift', scala: 'scala', dart: 'dart', groovy: 'groovy', gradle: 'groovy', m: 'objective-c', mm: 'objective-cpp',
  css: 'css', scss: 'scss', less: 'less', vue: 'vue', svelte: 'svelte', astro: 'astro', php: 'php', proto: 'proto', sol: 'solidity', zig: 'zig',
  py: 'python', rb: 'ruby', pl: 'perl', r: 'r', sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', yml: 'yaml', yaml: 'yaml',
  toml: 'toml', ex: 'elixir', exs: 'elixir', jl: 'julia', ps1: 'powershell', tf: 'terraform', nix: 'nix', graphql: 'graphql', gql: 'graphql',
  sql: 'sql', hs: 'haskell', elm: 'elm', lua: 'lua', clj: 'clojure', cljs: 'clojure', html: 'html', htm: 'html', xml: 'xml', svg: 'svg',
  md: 'markdown', vb: 'vb', tex: 'latex', erl: 'erlang', fs: 'fsharp', ml: 'ocaml', ini: 'ini', cfg: 'ini', bat: 'bat', cmd: 'bat',
};

export function languageForPath(path: string): string | undefined {
  const base = path.split(/[\\/]/).pop()!.toLowerCase();
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  if (base.startsWith('.env')) return 'dotenv';
  const dot = base.lastIndexOf('.');
  return dot === -1 ? undefined : BY_EXTENSION[base.slice(dot + 1)];
}
