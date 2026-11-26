// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { startScanner } from '../src/content/scanner';
import { GEMINI_ADAPTER, GROK_ADAPTER, extractMermaidSource, mermaidSourceToUiPayload } from '../src/content/sites';
import { RENDERERS } from '../src/components';

describe('startScanner', () => {
  it('extracts labelled and unlabelled Mermaid source without classifying ordinary code', () => {
    const flowchart = 'flowchart TD\n  A[Login] --> B{Valid?}\n  B -->|Yes| C[Dashboard]';
    expect(extractMermaidSource(flowchart)).toBe(flowchart);
    expect(extractMermaidSource('```mermaid\n' + flowchart + '\n```')).toBe(flowchart);
    expect(extractMermaidSource('```\n' + flowchart + '\n```')).toBe(flowchart);
    expect(extractMermaidSource('const value = 1;', 'javascript')).toBeNull();
    expect(extractMermaidSource('Here is a flowchart: ' + flowchart)).toBeNull();
    expect(extractMermaidSource('```javascript\n' + flowchart + '\n```')).toBeNull();
    expect(JSON.parse(mermaidSourceToUiPayload(flowchart))).toMatchObject({ type: 'mermaid', code: flowchart });
  });

  it('converts Gemini Mermaid code blocks into a rendered Mermaid component', () => {
    const container = document.createElement('div');
    container.innerHTML = '<code-block><pre><code class="language-mermaid">flowchart TD\n A[Login] --> B[Dashboard]</code></pre></code-block>';
    document.body.appendChild(container);
    const codeBlock = container.querySelector('code-block') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);
    const host = container.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.shadowRoot?.querySelector('.iui-mermaid-card')).not.toBeNull();
    expect(codeBlock.style.display).toBe('none');
    scanner.stop();
    container.remove();

    const rawContainer = document.createElement('div');
    rawContainer.innerHTML = '<code-block><pre><code>flowchart TD\n A[Start] --> B[Finish]</code></pre></code-block>';
    document.body.appendChild(rawContainer);
    const rawScanner = startScanner(GEMINI_ADAPTER, () => 'dark', rawContainer);
    const rawHost = rawContainer.querySelector('.iui-host') as HTMLElement;
    expect(rawHost).not.toBeNull();
    expect(rawHost.shadowRoot?.querySelector('.iui-mermaid-card')).not.toBeNull();
    rawScanner.stop();
    rawContainer.remove();
  });

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

  it('renders Gemini UI blocks that live inside an open shadow root', () => {
    const container = document.createElement('div');
    const responseHost = document.createElement('model-response');
    const shadow = responseHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <code-block>
        <div class="code-block-decoration">Code snippet</div>
        <pre><code data-test-id="code-content">{"type":"flow","title":"Shadow DOM flow","nodes":[{"id":"a","label":"Start"}],"edges":[]}</code></pre>
      </code-block>
    `;
    container.appendChild(responseHost);
    const codeBlock = shadow.querySelector('code-block') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'dark', container);

    expect(codeBlock.style.display).toBe('none');
    const host = shadow.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.shadowRoot?.querySelector('.flow-card')).not.toBeNull();

    scanner.stop();
    container.remove();
  });

  it('detects and renders Gemini-like DOM with "Code snippet" decoration and pretty-printed flow JSON', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block>
        <div class="code-block-decoration">Code snippet</div>
        <pre><code>{\n  "type": "flow",\n  "nodes": [\n    {"id": "a", "label": "Start"}\n  ]\n}</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);
    const codeBlock = container.querySelector('code-block') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

    expect(codeBlock.style.display).toBe('none');
    expect(codeBlock.getAttribute('data-iui-hidden')).toBe('1');
    const host = container.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.shadowRoot?.querySelector('.flow-card')).not.toBeNull();

    scanner.stop();
    container.remove();
  });

  it('triggers render when streaming text updates into complete flow JSON on Gemini-like DOM', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block>
        <div class="code-block-decoration">Code snippet</div>
        <pre><code data-test-id="code-content">{\n</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);
    const codeBlock = container.querySelector('code-block') as HTMLElement;
    const codeEl = container.querySelector('code') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

    // During streaming incomplete JSON: code-block remains visible, no host mounted
    expect(codeBlock.style.display).toBe('');
    expect(container.querySelector('.iui-host')).toBeNull();

    // Now Gemini streams the rest of the flow JSON
    codeEl.textContent = '{\n  "type": "flow",\n  "nodes": [\n    {"id": "a", "label": "Start"}\n  ]\n}';
    scanner.rescan();

    // Now that JSON parses fully, it renders and hides the code-block
    expect(codeBlock.style.display).toBe('none');
    expect(codeBlock.getAttribute('data-iui-hidden')).toBe('1');
    const host = container.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.shadowRoot?.querySelector('.flow-card')).not.toBeNull();

    scanner.stop();
    container.remove();
  });

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

  it('renders checklist, RSVP form, and dashboard JSON from ordinary code snippets', () => {
    const specs = [
      {
        type: 'checklist', title: 'Pre-Flight Checklist',
        items: ['Check in online', 'Confirm passport', 'Pack charger'].map((text) => ({ text })),
      },
      {
        type: 'form', title: 'Event RSVP', submitLabel: 'Submit RSVP',
        fields: [
          { id: 'name', label: 'Name', type: 'text', required: true },
          { id: 'email', label: 'Email', type: 'email', required: true },
          { id: 'attendance', label: 'Attendance', type: 'radio', options: ['Yes', 'No'] },
          { id: 'dietary', label: 'Dietary notes', type: 'textarea' },
        ],
      },
      {
        type: 'dashboard', title: 'Q1 Sales Overview',
        items: [
          { title: 'Key Metrics', visual: { type: 'stats', items: [{ label: 'Total sales', value: '$40k' }, { label: 'Total orders', value: 263 }] } },
          { title: 'Monthly sales', visual: { type: 'chart', chartType: 'bar', labels: ['Jan', 'Feb', 'Mar'], datasets: [{ label: 'Sales', data: [12, 15, 13] }] } },
        ],
      },
    ];

    for (const spec of specs) {
      const container = document.createElement('div');
      const response = createGeminiBlock(JSON.stringify(spec));
      container.appendChild(response);
      document.body.appendChild(container);
      const scanner = startScanner(GEMINI_ADAPTER, () => 'dark', container);
      const host = response.querySelector('.iui-host') as HTMLElement;

      expect(host).not.toBeNull();
      expect(host.shadowRoot?.querySelector(`.iui-${spec.type}-card`)).not.toBeNull();
      expect(host.shadowRoot?.querySelector('.iui-partial-error-note')).toBeNull();
      expect(response.querySelector('code-block')?.getAttribute('data-iui-hidden')).toBe('1');

      scanner.stop();
      container.remove();
    }
  });

  it('keeps source visible and adds a fallback note if a renderer throws synchronously', () => {
    const originalRenderer = RENDERERS.checklist;
    RENDERERS.checklist = (() => { throw new Error('simulated renderer failure'); }) as typeof RENDERERS.checklist;
    const container = document.createElement('div');
    const response = createGeminiBlock(JSON.stringify({
      type: 'checklist', title: 'Fallback check', items: [{ text: 'Keep this source visible' }],
    }));
    container.appendChild(response);
    document.body.appendChild(container);
    const codeBlock = response.querySelector('code-block') as HTMLElement;
    let scanner: ReturnType<typeof startScanner> | undefined;

    try {
      expect(() => { scanner = startScanner(GEMINI_ADAPTER, () => 'dark', container); }).not.toThrow();
      expect(codeBlock.style.display).toBe('');
      expect(codeBlock.hasAttribute('data-betterview-handled')).toBe(false);
      const noteHost = container.querySelector('.iui-host') as HTMLElement;
      expect(noteHost.shadowRoot?.querySelector('.iui-fallback-note')?.textContent)
        .toBe("Couldn't render this UI block");
    } finally {
      scanner?.stop();
      RENDERERS.checklist = originalRenderer;
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

  it('mounts card toolbar with 4 icon buttons (Copy data, Export card, View source, Expand card) and sets data-host on .iui-root', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block id="tb-wrap">
        <div class="code-block-decoration">ui</div>
        <pre><code class="language-ui">{"type":"callout","tone":"tip","title":"Tip","text":"Hi"}</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);

    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);
    const host = container.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();
    const shadow = host?.shadowRoot;
    expect(shadow).not.toBeNull();

    const root = shadow?.querySelector('.iui-root') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute('data-host')).toBe('gemini');

    const toolbar = shadow?.querySelector('.iui-card-toolbar');
    expect(toolbar).not.toBeNull();

    const buttons = toolbar?.querySelectorAll('button');
    expect(buttons?.length).toBe(4);

    const ariaLabels = Array.from(buttons || []).map((b) => b.getAttribute('aria-label'));
    expect(ariaLabels).toEqual(['Copy data', 'Export card', 'View source', 'Expand card']);

    scanner.stop();
    container.remove();
  });

  it('traps modal focus inside visible controls in the Shadow DOM', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block id="modal-tree">
        <div class="code-block-decoration">ui</div>
        <pre><code>{"type":"tree","title":"Architecture","root":{"id":"root","label":"Root","children":[{"id":"child","label":"Child"}]}}</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);
    const shadowRoot = container.querySelector<HTMLElement>('.iui-host')?.shadowRoot;
    expect(shadowRoot).not.toBeNull();

    shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Expand card"]')!.click();
    const modal = shadowRoot!.querySelector<HTMLElement>('.iui-modal-container')!;
    const hiddenWrap = document.createElement('div');
    hiddenWrap.hidden = true;
    hiddenWrap.appendChild(document.createElement('button'));
    modal.appendChild(hiddenWrap);

    const focusable = Array.from(modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )).filter((el) => !el.matches(':disabled') && !el.closest('[hidden], [inert], [aria-hidden="true"]'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    expect(focusable).not.toContain(hiddenWrap.querySelector('button'));

    last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(shadowRoot!.activeElement).toBe(first);

    first.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(shadowRoot!.activeElement).toBe(last);

    scanner.stop();
    container.remove();
  });
});

describe('M15: Safe wrapper, prose preservation, and flicker-free streaming', () => {
  it('(a) Grok-like DOM: keeps h2, p, ul intact and visible, mounts host at code wrapper spot', () => {
    const container = document.createElement('div');
    const message = document.createElement('div');
    message.className = 'message-bubble';
    message.innerHTML = `
      <h2>Executive Summary</h2>
      <p>Here are the latest operational metrics for Q3:</p>
      <div class="grok-code-wrapper">
        <div class="grok-code-header"><span>ui</span><button>Copy</button></div>
        <pre><code class="language-ui">{"type":"stats","title":"Q3 Metrics","items":[{"label":"Uptime","value":"99.9%"}]}</code></pre>
      </div>
      <p>Key takeaways:</p>
      <ul>
        <li>Service reliability reached target</li>
        <li>Zero high-severity incidents</li>
      </ul>
    `;
    container.appendChild(message);
    document.body.appendChild(container);

    const h2 = message.querySelector('h2')!;
    const p1 = message.querySelectorAll('p')[0];
    const p2 = message.querySelectorAll('p')[1];
    const ul = message.querySelector('ul')!;
    const h2Text = h2.textContent;
    const p1Text = p1.textContent;
    const p2Text = p2.textContent;
    const ulText = ul.textContent;
    const codeWrapper = message.querySelector('.grok-code-wrapper') as HTMLElement;

    const scanner = startScanner(GROK_ADAPTER, () => 'light', container);

    // Every h2/p/ul is still present, visible (no display:none, no data-iui-hidden) and textContent unchanged
    expect(h2.style.display).not.toBe('none');
    expect(h2.hasAttribute('data-iui-hidden')).toBe(false);
    expect(h2.textContent).toBe(h2Text);

    expect(p1.style.display).not.toBe('none');
    expect(p1.hasAttribute('data-iui-hidden')).toBe(false);
    expect(p1.textContent).toBe(p1Text);

    expect(p2.style.display).not.toBe('none');
    expect(p2.hasAttribute('data-iui-hidden')).toBe(false);
    expect(p2.textContent).toBe(p2Text);

    expect(ul.style.display).not.toBe('none');
    expect(ul.hasAttribute('data-iui-hidden')).toBe(false);
    expect(ul.textContent).toBe(ulText);

    // Code wrapper is hidden
    expect(codeWrapper.style.display).toBe('none');
    expect(codeWrapper.getAttribute('data-iui-hidden')).toBe('1');

    // Host sits at exact spot where code wrapper was (previousSibling of codeWrapper, both children of message)
    const host = message.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.parentElement).toBe(message);
    expect(codeWrapper.parentElement).toBe(message);
    expect(codeWrapper.previousElementSibling).toBe(host);
    expect(host.previousElementSibling).toBe(p1);
    expect(codeWrapper.nextElementSibling).toBe(p2);

    scanner.stop();
    container.remove();
  });

  it('(b) Grok message with single <pre> and prose siblings in same parent: only <pre> is hidden, never container', () => {
    const container = document.createElement('div');
    const message = document.createElement('div');
    message.className = 'grok-message-container';
    message.innerHTML = `
      <p>Here is your data:</p>
      <pre><code class="language-ui">{"type":"table","title":"Data","columns":["A","B"],"rows":[["1","2"]]}</code></pre>
      <p>Let me know if you need more details.</p>
    `;
    container.appendChild(message);
    document.body.appendChild(container);

    const pre = message.querySelector('pre') as HTMLElement;
    const scanner = startScanner(GROK_ADAPTER, () => 'light', container);

    // Message container is NOT hidden
    expect(message.style.display).not.toBe('none');
    expect(message.hasAttribute('data-iui-hidden')).toBe(false);

    // Pre is hidden
    expect(pre.style.display).toBe('none');
    expect(pre.getAttribute('data-iui-hidden')).toBe('1');

    // Prose siblings untouched
    const paras = message.querySelectorAll('p');
    expect(paras[0].style.display).not.toBe('none');
    expect(paras[1].style.display).not.toBe('none');

    scanner.stop();
    container.remove();
  });

  it('(c) Gemini-like DOM: prose stays untouched, only code-block is hidden', () => {
    const container = document.createElement('div');
    const message = document.createElement('div');
    message.className = 'gemini-message';
    message.innerHTML = `
      <h3>Instructions</h3>
      <p>Follow these steps:</p>
      <code-block>
        <div class="code-block-decoration">ui</div>
        <pre><code class="language-ui">{"type":"stepper","title":"Steps","steps":[{"title":"1","detail":"Start"}]}</code></pre>
      </code-block>
      <p>Done!</p>
    `;
    container.appendChild(message);
    document.body.appendChild(container);

    const cb = message.querySelector('code-block') as HTMLElement;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

    expect(cb.style.display).toBe('none');
    expect(cb.getAttribute('data-iui-hidden')).toBe('1');

    const h3 = message.querySelector('h3')!;
    const paras = message.querySelectorAll('p');
    expect(h3.style.display).not.toBe('none');
    expect(paras[0].style.display).not.toBe('none');
    expect(paras[1].style.display).not.toBe('none');

    scanner.stop();
    container.remove();
  });

  it('(d) Streaming: incomplete ui block shows skeleton of fixed 120px height, feeding partial text preserves node identity, completing renders card', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block>
        <pre><code class="language-ui">{"type": "flow"</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);

    const codeEl = container.querySelector('code')!;
    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);

    const host = container.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();

    // Incomplete ui block shows a skeleton of fixed 120px height
    const skeletonCard = host.shadowRoot?.querySelector('.iui-skeleton-card') as HTMLElement;
    expect(skeletonCard).not.toBeNull();
    expect(skeletonCard.style.height).toBe('120px');
    expect(skeletonCard.style.minHeight).toBe('120px');
    expect(skeletonCard.style.maxHeight).toBe('120px');

    // Feeding more partial text does not replace the skeleton element (same node identity)
    codeEl.textContent = '{"type": "flow", "title": "System Architecture", "nodes": [';
    scanner.rescan();

    const skeletonCardAfter = host.shadowRoot?.querySelector('.iui-skeleton-card') as HTMLElement;
    expect(skeletonCardAfter).toBe(skeletonCard); // exact same node reference!

    // Completing the JSON renders the card
    codeEl.textContent =
      '{"type": "flow", "title": "System Architecture", "nodes": [{"id":"a","label":"A"}], "edges": []}';
    scanner.rescan();

    const renderedCard = host.shadowRoot?.querySelector('.iui-card:not(.iui-skeleton-card)');
    expect(renderedCard).not.toBeNull();

    scanner.stop();
    container.remove();
  });

  it('(e) stop() restores exactly the hidden element and leaves prose identical', () => {
    const container = document.createElement('div');
    const message = document.createElement('div');
    message.innerHTML = `
      <h2>Executive Summary</h2>
      <p>Paragraph before</p>
      <div class="grok-wrapper">
        <div class="header"><span>ui</span><button>Copy</button></div>
        <pre><code class="language-ui">{"type":"callout","tone":"info","title":"Note","text":"Hello"}</code></pre>
      </div>
      <p>Paragraph after</p>
    `;
    container.appendChild(message);
    document.body.appendChild(container);

    const initialInnerHtml = message.innerHTML;

    const scanner = startScanner(GROK_ADAPTER, () => 'light', container);

    const host = message.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();

    scanner.stop();

    expect(message.querySelector('.iui-host')).toBeNull();
    expect(message.innerHTML).toBe(initialInnerHtml);

    container.remove();
  });

  it('mounts card toolbar with 4 icon buttons (Copy data, Export card, View source, Expand card) and sets data-host on .iui-root', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block id="tb-wrap">
        <div class="code-block-decoration">ui</div>
        <pre><code class="language-ui">{"type":"callout","tone":"tip","title":"Tip","text":"Hi"}</code></pre>
      </code-block>
    `;
    document.body.appendChild(container);

    const scanner = startScanner(GEMINI_ADAPTER, () => 'light', container);
    const host = container.querySelector('.iui-host') as HTMLElement;
    expect(host).not.toBeNull();
    const shadow = host?.shadowRoot;
    expect(shadow).not.toBeNull();

    const root = shadow?.querySelector('.iui-root') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute('data-host')).toBe('gemini');

    const toolbar = shadow?.querySelector('.iui-card-toolbar');
    expect(toolbar).not.toBeNull();

    const buttons = toolbar?.querySelectorAll('button');
    expect(buttons?.length).toBe(4);

    const ariaLabels = Array.from(buttons || []).map((b) => b.getAttribute('aria-label'));
    expect(ariaLabels).toEqual(['Copy data', 'Export card', 'View source', 'Expand card']);

    scanner.stop();
    container.remove();
  });
});
