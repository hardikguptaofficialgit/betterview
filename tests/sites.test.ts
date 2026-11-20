// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import {
  GEMINI_ADAPTER,
  GROK_ADAPTER,
  pickAdapter,
  isUiBlock,
  appendInstruction,
  hasBetterViewMarker,
  fillGeminiMemoryDialog,
  runGeminiSetup,
} from '../src/content/sites';
import { getCompactInstruction, SYSTEM_INSTRUCTION } from '../src/shared/systemInstruction';

describe('System Instruction', () => {
  it('getCompactInstruction starts with marker and is under 2900 characters', () => {
    const compact = getCompactInstruction();
    expect(compact.startsWith('[BetterView v2] ')).toBe(true);
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

  it('finds code blocks as code-block elements and dedupes them', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code-block id="cb1"><pre id="pre1"><code data-test-id="code-content">one</code></pre></code-block>
      <div class="code-block" id="cb2"><pre id="pre2"><code>two</code></pre></div>
    `;
    const blocks = GEMINI_ADAPTER.findCodeBlocks(container);
    expect(blocks.length).toBe(2);
    expect(blocks[0].id).toBe('cb1');
    expect(blocks[1].id).toBe('cb2');
  });

  it('detects language from code class or code-block-decoration', () => {
    const wrap1 = document.createElement('code-block');
    wrap1.innerHTML = '<pre><code class="language-ui">{"type":"flow"}</code></pre>';
    expect(GEMINI_ADAPTER.languageOf(wrap1)).toBe('ui');

    const wrap2 = document.createElement('code-block');
    wrap2.innerHTML = '<div class="code-block-decoration">ui</div><pre><code>{"type":"quiz"}</code></pre>';
    expect(GEMINI_ADAPTER.languageOf(wrap2)).toBe('ui');

    const wrap3 = document.createElement('code-block');
    wrap3.innerHTML = '<span>json</span><pre><code>{"type":"quiz"}</code></pre>';
    expect(GEMINI_ADAPTER.languageOf(wrap3)).toBe('json');

    // "Code snippet" should not be treated as a language label
    const wrap4 = document.createElement('code-block');
    wrap4.innerHTML = '<div class="code-block-decoration"><span>Code snippet</span></div><pre><code>{"type":"flow"}</code></pre>';
    expect(GEMINI_ADAPTER.languageOf(wrap4)).toBeNull();
  });

  it('returns wrapperOf for block or pre', () => {
    const wrapper = document.createElement('code-block');
    const pre = document.createElement('pre');
    wrapper.appendChild(pre);
    document.body.appendChild(wrapper);
    expect(GEMINI_ADAPTER.wrapperOf(pre)).toBe(wrapper);
    expect(GEMINI_ADAPTER.wrapperOf(wrapper)).toBe(wrapper);
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

describe('isUiBlock detection without language label', () => {
  it('recognizes explicit ui language blocks', () => {
    const el = document.createElement('pre');
    el.innerHTML = '<code class="language-ui">{}</code>';
    expect(isUiBlock(GEMINI_ADAPTER, el)).toBe(true);
  });

  it('recognizes Gemini code-block with "Code snippet" decoration by JSON type', () => {
    const types = ['flow', 'stepper', 'table', 'compare', 'quiz', 'chart', 'mermaid'];
    for (const t of types) {
      const el = document.createElement('code-block');
      el.innerHTML = `
        <div class="code-block">
          <div class="formatted-code-block-internal-container">
            <div class="code-block-decoration"><span>Code snippet</span></div>
            <pre><code role="text" data-test-id="code-content">{"type":"${t}","title":"Test ${t}"}</code></pre>
          </div>
        </div>
      `;
      expect(isUiBlock(GEMINI_ADAPTER, el)).toBe(true);
    }
  });

  it('recognizes streaming incomplete JSON by regex', () => {
    const el = document.createElement('code-block');
    el.innerHTML = `
      <div class="code-block">
        <pre><code data-test-id="code-content">{"type": "flow", "title": "In-flight</code></pre>
      </div>
    `;
    expect(isUiBlock(GEMINI_ADAPTER, el)).toBe(true);
  });

  it('leaves ordinary JSON without a matching type untouched', () => {
    const nonMatching = [
      '{"type":"user","name":"Alice"}',
      '{"items":[1,2,3]}',
      '{"status":"ok"}',
      '[1, 2, 3]',
      'const x = 1;',
    ];
    for (const json of nonMatching) {
      const el = document.createElement('code-block');
      el.innerHTML = `
        <div class="code-block">
          <pre><code data-test-id="code-content">${json}</code></pre>
        </div>
      `;
      expect(isUiBlock(GEMINI_ADAPTER, el)).toBe(false);
    }
  });

  it('applies JSON type detection to Grok adapter without ui label', () => {
    const el = document.createElement('pre');
    el.innerHTML = '<code>{"type":"flow","title":"Grok flow"}</code>';
    expect(isUiBlock(GROK_ADAPTER, el)).toBe(true);

    const normal = document.createElement('pre');
    normal.innerHTML = '<code>{"type":"settings","dark":true}</code>';
    expect(isUiBlock(GROK_ADAPTER, normal)).toBe(false);
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

  it('updates instruction if new instruction has a higher version', () => {
    const existing = 'Existing text\n\n[BetterView] instructions already here';
    const instruction = '[BetterView v2] new instructions';
    const result = appendInstruction(existing, instruction);
    expect(result).toBe('Existing text\n\n[BetterView v2] new instructions');
  });

  it('detects BetterView marker case-insensitively', () => {
    expect(hasBetterViewMarker('[BetterView] instructions')).toBe(true);
    expect(hasBetterViewMarker('[betterview] instructions')).toBe(true);
    expect(hasBetterViewMarker('Gemini remembers: [BETTERVIEW] show visuals')).toBe(true);
    expect(hasBetterViewMarker('Hello world')).toBe(false);
  });
});

describe('fillGeminiMemoryDialog in fake overlay container', () => {
  it('fills memory dialog and clicks submit when button is enabled', async () => {
    const overlay = document.createElement('div');
    overlay.className = 'cdk-overlay-container';
    overlay.innerHTML = `
      <edit-memory-dialog class="mat-mdc-dialog-component-host">
        <h2 mat-dialog-title>What do you want Gemini to remember?</h2>
        <mat-dialog-content><mat-form-field class="edit-memory-form-field">
          <textarea rows="1" matinput cdktextareaautosize aria-label="Enter new memory" class="edit-memory-input" maxlength="3000"></textarea>
        </mat-form-field></mat-dialog-content>
        <mat-dialog-actions align="end">
          <button mat-button mat-dialog-close type="button">Cancel</button>
          <button mat-flat-button data-test-id="submit-button" disabled="true" class="edit-memory-submit-button">Submit</button>
        </mat-dialog-actions>
      </edit-memory-dialog>
    `;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('textarea')!;
    const submitBtn = overlay.querySelector<HTMLButtonElement>('button[data-test-id="submit-button"]')!;

    let submitClicked = false;
    submitBtn.addEventListener('click', () => {
      submitClicked = true;
    });

    textarea.addEventListener('input', () => {
      // Simulate Gemini enabling the submit button after input
      submitBtn.disabled = false;
      submitBtn.removeAttribute('disabled');
    });

    await fillGeminiMemoryDialog(overlay, { waitTimeoutMs: 2000, pollIntervalMs: 50 });

    expect(textarea.value.startsWith('[BetterView v2] ')).toBe(true);
    expect(textarea.value).toBe(getCompactInstruction());
    expect(submitClicked).toBe(true);

    overlay.remove();
  });

  it('dispatches input, change, and keyup events and retries fill if disabled', async () => {
    const overlay = document.createElement('div');
    overlay.className = 'cdk-overlay-container';
    overlay.innerHTML = `
      <edit-memory-dialog class="mat-mdc-dialog-component-host">
        <textarea aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button" disabled="true">Submit</button>
      </edit-memory-dialog>
    `;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('textarea')!;
    const submitBtn = overlay.querySelector<HTMLButtonElement>('button')!;

    let keyupCount = 0;
    let changeCount = 0;
    let inputCount = 0;

    textarea.addEventListener('keyup', () => { keyupCount++; });
    textarea.addEventListener('change', () => { changeCount++; });
    textarea.addEventListener('input', () => {
      inputCount++;
      // Enable on second attempt (retry)
      if (inputCount >= 2) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('disabled');
      }
    });

    submitBtn.addEventListener('click', () => {
      overlay.querySelector('edit-memory-dialog')?.remove();
    });

    await fillGeminiMemoryDialog(overlay, { waitTimeoutMs: 1000, pollIntervalMs: 30, waitForClose: true });

    expect(inputCount).toBeGreaterThanOrEqual(2);
    expect(changeCount).toBeGreaterThanOrEqual(2);
    expect(keyupCount).toBeGreaterThanOrEqual(2);

    overlay.remove();
  });

  it('throws "Dialog didn\'t close" when waitForClose is true and dialog remains open', async () => {
    const overlay = document.createElement('div');
    overlay.className = 'cdk-overlay-container';
    overlay.innerHTML = `
      <edit-memory-dialog class="mat-mdc-dialog-component-host">
        <textarea aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button">Submit</button>
      </edit-memory-dialog>
    `;
    document.body.appendChild(overlay);

    await expect(
      fillGeminiMemoryDialog(overlay, { waitTimeoutMs: 150, pollIntervalMs: 30, waitForClose: true })
    ).rejects.toThrow("Dialog didn't close");

    overlay.remove();
  });

  it('fails with precise error if textarea cannot be found', async () => {
    const overlay = document.createElement('div');
    overlay.className = 'cdk-overlay-container';
    overlay.innerHTML = `
      <edit-memory-dialog class="mat-mdc-dialog-component-host">
        <h2>What do you want Gemini to remember?</h2>
      </edit-memory-dialog>
    `;
    document.body.appendChild(overlay);

    await expect(fillGeminiMemoryDialog(overlay, { waitTimeoutMs: 200, pollIntervalMs: 50 })).rejects.toThrow(
      "Couldn't find the text box",
    );

    overlay.remove();
  });
});
