// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import {
  tokenize,
  tokenizeLines,
  normalizeLanguage,
} from '../src/components/codeTokenizer';
import { renderCode } from '../src/components/code';
import { CodeSpec } from '../src/core/types';

describe('Code Tokenizer: language normalization', () => {
  it('normalizes common language aliases', () => {
    expect(normalizeLanguage('javascript')).toBe('js');
    expect(normalizeLanguage('typescript')).toBe('ts');
    expect(normalizeLanguage('py')).toBe('python');
    expect(normalizeLanguage('sh')).toBe('bash');
    expect(normalizeLanguage('xml')).toBe('html');
    expect(normalizeLanguage('scss')).toBe('css');
    expect(normalizeLanguage('')).toBe('text');
  });
});

describe('Code Tokenizer: JavaScript & TypeScript', () => {
  it('tokenizes keywords, identifiers, strings, and operators', () => {
    const code = 'const greeting: string = "hello world";';
    const tokens = tokenize(code, 'ts');

    expect(tokens.some((t) => t.type === 'keyword' && t.value === 'const')).toBe(true);
    expect(tokens.some((t) => t.type === 'string' && t.value === '"hello world"')).toBe(true);
    expect(tokens.some((t) => t.type === 'operator' && t.value === '=')).toBe(true);
  });

  it('tokenizes function calls and numbers', () => {
    const code = 'function calculate(x: number) { return x * 42; }';
    const tokens = tokenize(code, 'ts');

    expect(tokens.some((t) => t.type === 'keyword' && t.value === 'function')).toBe(true);
    expect(tokens.some((t) => t.type === 'function' && t.value === 'calculate')).toBe(true);
    expect(tokens.some((t) => t.type === 'number' && t.value === '42')).toBe(true);
  });

  it('tokenizes single-line and multiline comments', () => {
    const code = '// line comment\n/* block comment */';
    const tokens = tokenize(code, 'js');

    expect(tokens.some((t) => t.type === 'comment' && t.value === '// line comment')).toBe(true);
    expect(tokens.some((t) => t.type === 'comment' && t.value === '/* block comment */')).toBe(true);
  });

  it('tokenizes boolean literals', () => {
    const code = 'const flag = true; const empty = null;';
    const tokens = tokenize(code, 'js');
    expect(tokens.some((t) => t.type === 'boolean' && t.value === 'true')).toBe(true);
    expect(tokens.some((t) => t.type === 'boolean' && t.value === 'null')).toBe(true);
  });
});

describe('Code Tokenizer: Python', () => {
  it('tokenizes def, docstrings, # comments, numbers, and True/False/None', () => {
    const code = 'def hello(name):\n    # Greet user\n    """Docstring"""\n    return True if name else None';
    const tokens = tokenize(code, 'python');

    expect(tokens.some((t) => t.type === 'keyword' && t.value === 'def')).toBe(true);
    expect(tokens.some((t) => t.type === 'function' && t.value === 'hello')).toBe(true);
    expect(tokens.some((t) => t.type === 'comment' && t.value === '# Greet user')).toBe(true);
    expect(tokens.some((t) => t.type === 'string' && t.value === '"""Docstring"""')).toBe(true);
    expect(tokens.some((t) => t.type === 'boolean' && t.value === 'True')).toBe(true);
    expect(tokens.some((t) => t.type === 'boolean' && t.value === 'None')).toBe(true);
  });
});

describe('Code Tokenizer: JSON', () => {
  it('tokenizes keys as properties, strings, numbers, and booleans', () => {
    const code = '{\n  "name": "BetterView",\n  "active": true,\n  "count": 100\n}';
    const tokens = tokenize(code, 'json');

    expect(tokens.some((t) => t.type === 'property' && t.value === '"name"')).toBe(true);
    expect(tokens.some((t) => t.type === 'string' && t.value === '"BetterView"')).toBe(true);
    expect(tokens.some((t) => t.type === 'boolean' && t.value === 'true')).toBe(true);
    expect(tokens.some((t) => t.type === 'number' && t.value === '100')).toBe(true);
  });
});

describe('Code Tokenizer: Bash, HTML, CSS', () => {
  it('tokenizes Bash variables, keywords, and comments', () => {
    const code = '#!/bin/bash\necho $USER\nif [ -z $VAR ]; then exit 0; fi';
    const tokens = tokenize(code, 'bash');

    expect(tokens.some((t) => t.type === 'comment')).toBe(true);
    expect(tokens.some((t) => t.type === 'keyword' && t.value === 'echo')).toBe(true);
    expect(tokens.some((t) => t.type === 'keyword' && t.value === 'if')).toBe(true);
    expect(tokens.some((t) => t.type === 'variable' && t.value === '$VAR')).toBe(true);
    expect(tokens.some((t) => t.type === 'variable' && t.value === '$USER')).toBe(true);
  });

  it('tokenizes HTML tags, attribute names, and values', () => {
    const code = '<div class="container" id="main"><!-- note --></div>';
    const tokens = tokenize(code, 'html');

    expect(tokens.some((t) => t.type === 'tag' && t.value === '<div')).toBe(true);
    expect(tokens.some((t) => t.type === 'attr-name' && t.value === 'class')).toBe(true);
    expect(tokens.some((t) => t.type === 'attr-value' && t.value === '"container"')).toBe(true);
    expect(tokens.some((t) => t.type === 'comment' && t.value === '<!-- note -->')).toBe(true);
  });

  it('tokenizes CSS selectors, properties, numbers with units, and colors', () => {
    const code = '.btn { color: #fff; padding: 12px; }';
    const tokens = tokenize(code, 'css');

    expect(tokens.some((t) => t.type === 'tag' && t.value === '.btn')).toBe(true);
    expect(tokens.some((t) => t.type === 'property' && t.value === 'color')).toBe(true);
    expect(tokens.some((t) => t.type === 'number' && t.value === '#fff')).toBe(true);
    expect(tokens.some((t) => t.type === 'number' && t.value === '12px')).toBe(true);
  });
});

describe('Code Tokenizer: line splitting', () => {
  it('splits code into lines while preserving token classification per line', () => {
    const code = 'const a = 1;\nconst b = 2;\n// End';
    const lines = tokenizeLines(code, 'js');

    expect(lines).toHaveLength(3);
    expect(lines[0].some((t) => t.type === 'keyword' && t.value === 'const')).toBe(true);
    expect(lines[1].some((t) => t.type === 'keyword' && t.value === 'const')).toBe(true);
    expect(lines[2].some((t) => t.type === 'comment' && t.value === '// End')).toBe(true);
  });
});

describe('Code Component: renderCode DOM construction', () => {
  it('renders code card with language pill, filename, line numbers, and copy button without innerHTML', () => {
    const spec: CodeSpec = {
      type: 'code',
      title: 'Quick Sort',
      language: 'typescript',
      filename: 'quicksort.ts',
      code: 'function sort(arr: number[]): number[] {\n  return arr.sort();\n}',
    };

    const card = renderCode(spec, { theme: 'light', onCleanup: () => {} });

    expect(card.classList.contains('iui-card')).toBe(true);
    expect(card.classList.contains('iui-code-card')).toBe(true);

    // Language pill and filename
    expect(card.querySelector('.iui-code-lang-pill')?.textContent).toBe('TS');
    expect(card.querySelector('.iui-code-filename')?.textContent).toBe('quicksort.ts');

    // Line numbers
    const lineRows = card.querySelectorAll('.iui-code-line');
    expect(lineRows).toHaveLength(3);
    const lineNums = Array.from(card.querySelectorAll('.iui-code-line-num')).map((el) => el.textContent);
    expect(lineNums).toEqual(['1', '2', '3']);

    // Spans with tokens built
    const tokenSpans = card.querySelectorAll('.token');
    expect(tokenSpans.length).toBeGreaterThan(0);

    // Soft-wrap toggle
    const wrapBtn = card.querySelector<HTMLButtonElement>('.iui-code-btn');
    expect(wrapBtn?.textContent).toBe('Wrap');
    const pre = card.querySelector('.iui-code-pre');
    expect(pre?.classList.contains('is-wrapped')).toBe(false);
    wrapBtn!.click();
    expect(pre?.classList.contains('is-wrapped')).toBe(true);
    wrapBtn!.click();
    expect(pre?.classList.contains('is-wrapped')).toBe(false);

    // Copy button
    const copyBtn = card.querySelectorAll<HTMLButtonElement>('.iui-code-btn')[1];
    expect(copyBtn?.textContent).toContain('Copy');
  });
});
