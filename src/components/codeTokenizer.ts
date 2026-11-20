export type TokenType =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'function'
  | 'operator'
  | 'punctuation'
  | 'tag'
  | 'attr-name'
  | 'attr-value'
  | 'property'
  | 'variable'
  | 'boolean'
  | 'plain';

export interface CodeToken {
  type: TokenType;
  value: string;
}

export function normalizeLanguage(lang: string | undefined): string {
  if (!lang) return 'text';
  const clean = lang.trim().toLowerCase();
  if (['js', 'jsx', 'javascript', 'mjs', 'cjs'].includes(clean)) return 'js';
  if (['ts', 'tsx', 'typescript', 'mts', 'cts'].includes(clean)) return 'ts';
  if (['py', 'python', 'py3'].includes(clean)) return 'python';
  if (['json', 'jsonc'].includes(clean)) return 'json';
  if (['sh', 'bash', 'shell', 'zsh'].includes(clean)) return 'bash';
  if (['html', 'htm', 'xml', 'svg'].includes(clean)) return 'html';
  if (['css', 'scss', 'less'].includes(clean)) return 'css';
  return clean;
}

interface Rule {
  type: TokenType;
  regex: RegExp;
}

function getRules(lang: string): Rule[] {
  switch (lang) {
    case 'js':
    case 'ts':
      return [
        { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
        { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y },
        {
          type: 'boolean',
          regex: /\b(true|false|null|undefined|NaN|Infinity)\b/y,
        },
        {
          type: 'keyword',
          regex:
            /\b(abstract|as|async|await|break|case|catch|class|const|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|of|package|private|protected|public|readonly|return|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield)\b/y,
        },
        { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/y },
        { type: 'number', regex: /\b0x[0-9a-fA-F]+\b|\b0b[01]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
        { type: 'operator', regex: /===|!==|==|!=|<=|>=|=>|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||[+\-*\/%&|^~!=<>?:.]/y },
        { type: 'punctuation', regex: /[{}()\[\],;]/y },
      ];

    case 'python':
      return [
        { type: 'comment', regex: /#[^\n]*/y },
        {
          type: 'string',
          regex: /"""[\s\S]*?"""|'''[\s\S]*?'''|[bB]?[rR]?"(?:\\.|[^"\\])*"|[bB]?[rR]?'(?:\\.|[^'\\])*'/y,
        },
        { type: 'boolean', regex: /\b(True|False|None)\b/y },
        {
          type: 'keyword',
          regex:
            /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/y,
        },
        { type: 'function', regex: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/y },
        { type: 'number', regex: /\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b/y },
        { type: 'operator', regex: /==|!=|<=|>=|\+=|-=|\*=|\/=|\/\/=|%=|\/\//y },
        { type: 'punctuation', regex: /[{}()\[\],;]/y },
      ];

    case 'json':
      return [
        { type: 'property', regex: /"(?:\\.|[^"\\])*"(?=\s*:)/y },
        { type: 'string', regex: /"(?:\\.|[^"\\])*"/y },
        { type: 'boolean', regex: /\b(true|false|null)\b/y },
        { type: 'number', regex: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
        { type: 'punctuation', regex: /[{}()\[\],:]/y },
      ];

    case 'bash':
      return [
        { type: 'comment', regex: /#[^\n]*/y },
        { type: 'string', regex: /"(?:\\.|[^"\\])*"|'[^']*'/y },
        { type: 'variable', regex: /\$(?:\{[a-zA-Z_0-9#?*!-]+\}|[a-zA-Z_0-9#?*!-]+)/y },
        {
          type: 'keyword',
          regex:
            /\b(if|then|else|elif|fi|for|while|until|do|done|in|case|esac|function|select|time|return|exit|export|source|local|echo|cd|pwd|cat|grep|sed|awk|chmod|chown|sudo)\b/y,
        },
        { type: 'operator', regex: /\|\||&&|>>|<<|==|!=|[|><;&=]/y },
        { type: 'number', regex: /\b\d+\b/y },
        { type: 'punctuation', regex: /[{}()\[\],]/y },
      ];

    case 'html':
      return [
        { type: 'comment', regex: /<!--[\s\S]*?-->/y },
        { type: 'tag', regex: /<\/?[a-zA-Z0-9-]+/y },
        { type: 'attr-value', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
        { type: 'attr-name', regex: /\b[a-zA-Z0-9-]+(?=\s*=)/y },
        { type: 'punctuation', regex: /[<>/=]/y },
      ];

    case 'css':
      return [
        { type: 'comment', regex: /\/\*[\s\S]*?\*\//y },
        { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
        { type: 'property', regex: /\b[a-zA-Z-]+(?=\s*:)/y },
        {
          type: 'number',
          regex: /#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(px|em|rem|%|vh|vw|deg|s|ms|fr)?\b/y,
        },
        { type: 'tag', regex: /\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+|:[a-zA-Z-]+/y },
        { type: 'punctuation', regex: /[{}():;,]/y },
      ];

    default:
      return [];
  }
}

/**
 * Tokenizes arbitrary source code into an array of tokens.
 */
export function tokenize(code: string, language: string): CodeToken[] {
  if (!code) return [];
  const normLang = normalizeLanguage(language);
  const rules = getRules(normLang);
  const tokens: CodeToken[] = [];

  let pos = 0;
  const len = code.length;

  while (pos < len) {
    let matched = false;

    for (const rule of rules) {
      rule.regex.lastIndex = pos;
      const match = rule.regex.exec(code);
      if (match && match.index === pos) {
        tokens.push({ type: rule.type, value: match[0] });
        pos += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Accumulate plain characters until the next potential token boundary
      let nextPos = pos + 1;
      tokens.push({ type: 'plain', value: code[pos] });
      pos = nextPos;
    }
  }

  // Merge contiguous 'plain' tokens
  const merged: CodeToken[] = [];
  for (const token of tokens) {
    if (merged.length > 0 && merged[merged.length - 1].type === 'plain' && token.type === 'plain') {
      merged[merged.length - 1].value += token.value;
    } else {
      merged.push({ ...token });
    }
  }

  return merged;
}

/**
 * Splits a list of tokens across line boundaries so each line has its own tokens.
 */
export function splitTokensIntoLines(tokens: CodeToken[]): CodeToken[][] {
  const lines: CodeToken[][] = [[]];

  for (const token of tokens) {
    if (!token.value.includes('\n')) {
      lines[lines.length - 1].push(token);
    } else {
      const parts = token.value.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push([]);
        }
        if (parts[i]) {
          lines[lines.length - 1].push({ type: token.type, value: parts[i] });
        }
      }
    }
  }

  return lines;
}

/**
 * Tokenizes code directly into lines of tokens.
 */
export function tokenizeLines(code: string, language: string): CodeToken[][] {
  const tokens = tokenize(code, language);
  return splitTokensIntoLines(tokens);
}
