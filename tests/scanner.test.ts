// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { startScanner } from '../src/content/scanner';
import { GEMINI_ADAPTER } from '../src/content/sites';

describe('startScanner', () => {
  it('scans root, hides original wrapper and mounts host', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block id="wrapper1">
        <div class="code-block-decoration">ui</div>
        <pre><code class="language-ui">{"type":"stepper","title":"Steps","steps":[{"title":"S1","detail":"D1"}]}</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);

    const wrapper = container.querySelector('#wrapper1') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

    expect(wrapper.style.display).toBe('none');
    expect(wrapper.getAttribute('data-iui-hidden')).toBe('1');

    const host = container.querySelector('.iui-host');
    expect(host).not.toBeNull();

    scanner.stop();
    container.remove();
  });

  it('restores wrapper when stop() is called', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block id="wrapper2">
        <div class="code-block-decoration">ui</div>
        <pre><code class="language-ui">{"type":"stepper","title":"Steps","steps":[{"title":"S1","detail":"D1"}]}</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);

    const wrapper = container.querySelector('#wrapper2') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

    expect(wrapper.style.display).toBe('none');

    scanner.stop();
    expect(wrapper.style.display).toBe('');
    expect(wrapper.hasAttribute('data-iui-hidden')).toBe(false);

    container.remove();
  });

  it('un-hides wrapper and inserts note on fallback', async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block id="wrapper3">
        <div class="code-block-decoration">ui</div>
        <pre><code class="language-ui">{"type":"flow","title":"Invalid JSON</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);

    const wrapper = container.querySelector('#wrapper3') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

    // Wait for the 1600ms finalize timer to fire
    await new Promise((r) => setTimeout(r, 1700));

    // Wrapper should be unhidden
    expect(wrapper.style.display).toBe('');

    // Fallback note should be present above wrapper
    const noteHost = container.querySelector('.iui-host');
    expect(noteHost).not.toBeNull();
    const noteEl = noteHost?.shadowRoot?.querySelector('.iui-fallback-note');
    expect(noteEl?.textContent).toBe("Couldn't render this UI block");

    scanner.stop();
    container.remove();
  });
});

describe('Gemini live DOM code block detection (Bug #2)', () => {
  function createGeminiBlock(jsonText: string): HTMLElement {
    const responseEl = document.createElement('response-element');
    responseEl.className = 'no-md md-has-block-component';
    responseEl.innerHTML = `
      <code-block class="enable-luminous-code-block">
        <div class="code-block">
          <div class="formatted-code-block-internal-container">
            <div class="animated-opacity">
              <div class="code-block-decoration header-formatted"><span>Code snippet</span><div class="buttons"></div></div>
            </div>
            <pre><code role="text" data-test-id="code-content" class="code-container formatted">${jsonText}</code></pre>
          </div>
        </div>
      </code-block>
    `;
    return responseEl;
  }

  it('detects positive blocks for various types and mounts before code-block in response-element', () => {
    const testCases = [
      {
        type: 'flow',
        json: JSON.stringify({
          type: 'flow',
          title: 'Flow Diagram',
          nodes: [{ id: 'a', label: 'Start' }],
          edges: [],
        }),
      },
      {
        type: 'stepper',
        json: JSON.stringify({
          type: 'stepper',
          title: 'Step by Step',
          steps: [{ title: 'Step 1', detail: 'Detail 1' }],
        }),
      },
      {
        type: 'table',
        json: JSON.stringify({
          type: 'table',
          title: 'Data Table',
          columns: ['Col A', 'Col B'],
          rows: [['1', '2']],
        }),
      },
      {
        type: 'quiz',
        json: JSON.stringify({
          type: 'quiz',
          title: 'Knowledge Check',
          questions: [{ q: 'Question 1', options: ['A', 'B'], answer: 0, explain: 'Exp' }],
        }),
      },
    ];

    for (const tc of testCases) {
      const container = document.createElement('div');
      const responseEl = createGeminiBlock(tc.json);
      container.appendChild(responseEl);
      document.body.appendChild(container);

      const codeBlock = responseEl.querySelector('code-block') as HTMLElement;
      const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

      // 1. code-block must be hidden and marked handled
      expect(codeBlock.style.display).toBe('none');
      expect(codeBlock.getAttribute('data-iui-hidden')).toBe('1');
      expect(codeBlock.getAttribute('data-betterview-handled')).toBe('1');

      // 2. host must be mounted inside response-element, just before code-block
      const host = responseEl.querySelector('.iui-host') as HTMLElement;
      expect(host).not.toBeNull();
      expect(host.parentElement).toBe(responseEl);
      expect(host.nextElementSibling).toBe(codeBlock);

      // 3. Rendered component inside shadow root
      const renderedWrap = host.shadowRoot?.querySelector('.iui-rendered-wrap');
      expect(renderedWrap).not.toBeNull();

      scanner.stop();
      container.remove();
    }
  });

  it('leaves ordinary non-BetterView JSON code blocks untouched', () => {
    const nonBetterViewJson = [
      JSON.stringify({ type: 'user', name: 'Alice', id: 123 }),
      JSON.stringify({ title: 'Config', port: 8080 }),
      JSON.stringify({ items: ['apple', 'banana'], total: 2 }),
    ];

    for (const json of nonBetterViewJson) {
      const container = document.createElement('div');
      const responseEl = createGeminiBlock(json);
      container.appendChild(responseEl);
      document.body.appendChild(container);

      const codeBlock = responseEl.querySelector('code-block') as HTMLElement;
      const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

      // code-block must remain untouched
      expect(codeBlock.style.display).not.toBe('none');
      expect(codeBlock.hasAttribute('data-betterview-handled')).toBe(false);
      expect(codeBlock.hasAttribute('data-iui-hidden')).toBe(false);

      // No host should be mounted
      const host = responseEl.querySelector('.iui-host');
      expect(host).toBeNull();

      scanner.stop();
      container.remove();
    }
  });

  it('renders streaming skeleton for incomplete code block and mounts before code-block', () => {
    const container = document.createElement('div');
    // Incomplete streaming JSON
    const responseEl = createGeminiBlock('{"type": "flow", "title": "System Architecture"');
    container.appendChild(responseEl);
    document.body.appendChild(container);

    const codeBlock = responseEl.querySelector('code-block') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

    // Should detect as streaming BetterView block
    expect(codeBlock.style.display).toBe('none');
    expect(codeBlock.getAttribute('data-betterview-handled')).toBe('1');

    // Mounted before code-block inside response-element
    const host = responseEl.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.nextElementSibling).toBe(codeBlock);

    // In streaming / skeleton state
    const skel = host.shadowRoot?.querySelector('.iui-skel');
    expect(skel).not.toBeNull();

    scanner.stop();
    container.remove();
  });
});
