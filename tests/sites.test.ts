// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  GEMINI_ADAPTER,
  GROK_ADAPTER,
  pickAdapter,
  isUiBlock,
  appendInstruction,
  hasBetterViewMarker,
} from '../src/content/sites';
import { getCompactInstruction, SYSTEM_INSTRUCTION } from '../src/shared/systemInstruction';

describe('System Instruction', () => {
  it('getCompactInstruction starts with marker and is under 2900 characters', () => {
    const compact = getCompactInstruction();
    expect(compact.startsWith('[BetterView] ')).toBe(true);
    expect(compact.length).toBeLessThanOrEqual(2900);
    expect(compact).toContain(SYSTEM_INSTRUCTION);
  });
});

describe('SiteAdapter: Gemini', () => {
  it('matches gemini.google.com URLs', () => {
    expect(GEMINI_ADAPTER.matches({ hostname: 'gemini.google.com' } as Location)).toBe(true);
    expect(GEMINI_ADAPTER.matches({ hostname: 'sub.gemini.google.com' } as Location)).toBe(true);
    expect(GEMINI_ADAPTER.matches({ hostname: 'google.com' } as Location)).toBe(false);
  });

  it('detects isNewChat correctly for gemini', () => {
    expect(GEMINI_ADAPTER.isNewChat({ pathname: '/app' } as Location)).toBe(true);
    expect(GEMINI_ADAPTER.isNewChat({ pathname: '/u/0/app' } as Location)).toBe(true);
    expect(GEMINI_ADAPTER.isNewChat({ pathname: '/gem/my-bot' } as Location)).toBe(true);
    expect(GEMINI_ADAPTER.isNewChat({ pathname: '/app/c/123456' } as Location)).toBe(false);
  });

  it('finds code blocks and dedupes them', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block><pre id="pre1"><code>one</code></pre></code-block>
      <div class="code-block"><pre id="pre2"><code>two</code></pre></div>
    `;
    const blocks = GEMINI_ADAPTER.findCodeBlocks(container);
    expect(blocks.length).toBe(2);
    expect(blocks[0].id).toBe('pre1');
    expect(blocks[1].id).toBe('pre2');
  });

  it('detects language from code class or code-block-decoration', () => {
    const wrap1 = document.createElement('code-block');
    wrap1.innerHTML = '<pre><code class="language-ui">{"type":"flow"}</code></pre>';
    const pre1 = wrap1.querySelector('pre')!;
    expect(GEMINI_ADAPTER.languageOf(pre1)).toBe('ui');

    const wrap2 = document.createElement('code-block');
    wrap2.innerHTML = '<div class="code-block-decoration">ui</div><pre><code>{"type":"quiz"}</code></pre>';
    const pre2 = wrap2.querySelector('pre')!;
    expect(GEMINI_ADAPTER.languageOf(pre2)).toBe('ui');

    const wrap3 = document.createElement('code-block');
    wrap3.innerHTML = '<span>json</span><pre><code>{"type":"quiz"}</code></pre>';
    const pre3 = wrap3.querySelector('pre')!;
    expect(GEMINI_ADAPTER.languageOf(pre3)).toBe('json');
  });

  it('returns wrapperOf for pre', () => {
    const wrapper = document.createElement('code-block');
    const pre = document.createElement('pre');
    wrapper.appendChild(pre);
    document.body.appendChild(wrapper);
    expect(GEMINI_ADAPTER.wrapperOf(pre)).toBe(wrapper);
    wrapper.remove();
  });
});

describe('SiteAdapter: Grok', () => {
  it('matches grok.com URLs', () => {
    expect(GROK_ADAPTER.matches({ hostname: 'grok.com' } as Location)).toBe(true);
    expect(GROK_ADAPTER.matches({ hostname: 'x.com' } as Location)).toBe(false);
  });

  it('detects isNewChat correctly for grok', () => {
    expect(GROK_ADAPTER.isNewChat({ pathname: '/' } as Location)).toBe(true);
    expect(GROK_ADAPTER.isNewChat({ pathname: '/chat' } as Location)).toBe(true);
    expect(GROK_ADAPTER.isNewChat({ pathname: '/c/conversation-id' } as Location)).toBe(false);
  });

  it('detects languageOf using ancestor traversal', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div>
        <div><span>ui</span><button>Copy</button></div>
        <pre><code>{"type":"table"}</code></pre>
      </div>
    `;
    const pre = container.querySelector('pre')!;
    expect(GROK_ADAPTER.languageOf(pre)).toBe('ui');
  });

  it('resolves wrapperOf via ancestor traversal', () => {
    const outer = document.createElement('div');
    outer.className = 'grok-card';
    outer.innerHTML = `
      <div><span>ui</span></div>
      <pre><code>test</code></pre>
    `;
    const pre = outer.querySelector('pre')!;
    expect(GROK_ADAPTER.wrapperOf(pre)).toBe(outer);
  });
});

describe('pickAdapter', () => {
  it('picks adapter based on hostname', () => {
    expect(pickAdapter({ hostname: 'gemini.google.com' } as Location)).toBe(GEMINI_ADAPTER);
    expect(pickAdapter({ hostname: 'grok.com' } as Location)).toBe(GROK_ADAPTER);
    expect(pickAdapter({ hostname: 'unknown.site' } as Location)).toBeNull();
  });
});

describe('isUiBlock helper', () => {
  it('recognizes explicit ui language blocks', () => {
    const el = document.createElement('pre');
    el.innerHTML = '<code class="language-ui">{}</code>';
    expect(isUiBlock(GEMINI_ADAPTER, el)).toBe(true);
  });

  it('recognizes json/plaintext blocks if content looks like UI block', () => {
    const el = document.createElement('pre');
    el.innerHTML = '<code class="language-json">{"type":"flow","title":"test"}</code>';
    expect(isUiBlock(GEMINI_ADAPTER, el)).toBe(true);
  });

  it('rejects non-UI blocks', () => {
    const el = document.createElement('pre');
    el.innerHTML = '<code class="language-python">print("hello")</code>';
    expect(isUiBlock(GEMINI_ADAPTER, el)).toBe(false);
  });
});

describe('Auto-setup append & marker logic', () => {
  it('preserves existing text and appends instruction', () => {
    const existing = 'You are a helpful coding assistant.';
    const instruction = '[BetterView] instruction';
    const result = appendInstruction(existing, instruction);
    expect(result).toBe(`${existing}\n\n${instruction}`);
  });

  it('does not duplicate if marker is already present', () => {
    const existing = 'Existing text\n\n[BetterView] instructions already here';
    const instruction = '[BetterView] new instructions';
    const result = appendInstruction(existing, instruction);
    expect(result).toBe(existing);
  });

  it('appends cleanly when existing text is empty', () => {
    const result = appendInstruction('', '[BetterView] instruction');
    expect(result).toBe('[BetterView] instruction');
  });

  it('detects BetterView marker correctly', () => {
    expect(hasBetterViewMarker('[BetterView] instructions')).toBe(true);
    expect(hasBetterViewMarker('Hello world')).toBe(false);
  });
});
