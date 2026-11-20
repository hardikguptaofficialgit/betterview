// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { startScanner } from '../src/content/scanner';
import { GEMINI_ADAPTER, GROK_ADAPTER } from '../src/content/sites';

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
