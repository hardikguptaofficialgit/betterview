// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import {
  GEMINI_ADAPTER,
  GROK_ADAPTER,
  pickAdapter,
  isUiBlock,
  isCodeOnlyWrapper,
  appendInstruction,
  hasBetterViewMarker,
  extractInstructionVersion,
  hasOlderInstruction,
  fillGeminiMemoryDialog,
  runGeminiSetup,
  runGrokSetup,
  isGeminiSavedInfoPath,
  findGeminiAddButton,
} from '../src/content/sites';
import {
  SETUP_INSTRUCTION,
  getCompactInstruction,
  SYSTEM_INSTRUCTION,
  SYSTEM_INSTRUCTION_SHORT,
  CURRENT_INSTRUCTION_VERSION,
} from '../src/shared/systemInstruction';
import { grokIconSvg } from '../src/core/brandIcons';

describe('System Instruction', () => {
  it('SETUP_INSTRUCTION conforms to constraints', () => {
    expect(SETUP_INSTRUCTION.length).toBeLessThanOrEqual(1400);
    expect(SETUP_INSTRUCTION.startsWith('[BetterView v4]')).toBe(true);
    expect(SETUP_INSTRUCTION).toContain('ui');
    expect(SETUP_INSTRUCTION).toContain('3');
    expect(getCompactInstruction()).toBe(SETUP_INSTRUCTION);
  });

  it('Instruction tests: version is 4, marker present, contains "Never more than 3", length not greater than before', () => {
    expect(CURRENT_INSTRUCTION_VERSION).toBe(4);
    const compact = getCompactInstruction();
    expect(compact).toContain('[BetterView v4]');
    expect(compact).toContain('Never more than 3');
    expect(compact).toContain('NEVER generate or create images');
    expect(compact.length).toBeLessThanOrEqual(1400);
    expect(SYSTEM_INSTRUCTION).toContain('Never more than 3');
    expect(SYSTEM_INSTRUCTION).toContain('NEVER generate or create images');
    expect(SYSTEM_INSTRUCTION_SHORT).toContain('Never more than 3');
    expect(SYSTEM_INSTRUCTION_SHORT).toContain('NEVER generate or create images');
    expect(SYSTEM_INSTRUCTION.length).toBeLessThanOrEqual(2825);
    expect(SYSTEM_INSTRUCTION_SHORT.length).toBeLessThanOrEqual(1820);
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

  it('Grok wrapperOf never returns an element containing a <p>', () => {
    const message = document.createElement('div');
    message.className = 'grok-message';
    message.innerHTML = `
      <p>Introduction paragraph</p>
      <div class="code-wrapper">
        <div><span>ui</span></div>
        <pre><code>test</code></pre>
      </div>
      <p>Follow-up paragraph</p>
    `;
    const pre = message.querySelector('pre')!;
    const wrapper = GROK_ADAPTER.wrapperOf(pre);
    expect(wrapper).not.toBe(message);
    expect(wrapper.className).toBe('code-wrapper');
    expect(wrapper.querySelector('p')).toBeNull();

    // Direct pre inside message with <p>
    const directMessage = document.createElement('div');
    directMessage.innerHTML = `
      <p>Text</p>
      <pre><code>code</code></pre>
    `;
    const directPre = directMessage.querySelector('pre')!;
    const directWrap = GROK_ADAPTER.wrapperOf(directPre);
    expect(directWrap).toBe(directPre);
    expect(directWrap.querySelector('p')).toBeNull();
  });
});

describe('isCodeOnlyWrapper', () => {
  it('returns true when wrapper === block', () => {
    const pre = document.createElement('pre');
    expect(isCodeOnlyWrapper(pre, pre)).toBe(true);
  });

  it('returns true when wrapper has only code block and small label/button', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<span>ui</span><button>Copy code</button><pre><code>test</code></pre>';
    const pre = wrap.querySelector('pre')!;
    expect(isCodeOnlyWrapper(wrap, pre)).toBe(true);
  });

  it('returns false when wrapper contains forbidden elements outside block', () => {
    const forbiddenTags = ['p', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'blockquote', 'hr'];
    for (const tag of forbiddenTags) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<${tag}>Forbidden</${tag}><pre><code>test</code></pre>`;
      const pre = wrap.querySelector('pre')!;
      expect(isCodeOnlyWrapper(wrap, pre)).toBe(false);
    }
  });

  it('returns false when outside text exceeds 40 characters', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div>This is some lengthy explanation text outside the code block that exceeds 40 characters</div><pre><code>test</code></pre>';
    const pre = wrap.querySelector('pre')!;
    expect(isCodeOnlyWrapper(wrap, pre)).toBe(false);
  });

  it('ignores button text when computing outside text length', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<span>ui</span><button>This is a very long button text that exceeds 40 characters easily</button><pre><code>test</code></pre>';
    const pre = wrap.querySelector('pre')!;
    expect(isCodeOnlyWrapper(wrap, pre)).toBe(true);
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

  it('updates instruction if new instruction has a higher version (v1->v2, v2->v3)', () => {
    const existing = 'Existing text\n\n[BetterView] instructions already here';
    const instructionV2 = '[BetterView v2] new instructions';
    const resultV2 = appendInstruction(existing, instructionV2);
    expect(resultV2).toBe('Existing text\n\n[BetterView v2] new instructions');

    const existingV2 = 'Existing text\n\n[BetterView v2] v2 instructions';
    const instructionV3 = '[BetterView v3] v3 instructions';
    const resultV3 = appendInstruction(existingV2, instructionV3);
    expect(resultV3).toBe('Existing text\n\n[BetterView v3] v3 instructions');
  });

  it('Setup tests for v2->v3 upgrade detection (hasOldEntry true, not already)', () => {
    const bodyWithV2 = 'Your instructions for Gemini\n\n[BetterView v2] old prompt';
    const verV2 = extractInstructionVersion(bodyWithV2);
    expect(verV2).toBe(2);
    const hasOldEntryV2 = hasOlderInstruction(bodyWithV2);
    expect(hasOldEntryV2).toBe(true);
    const alreadyV2 = verV2 !== null && verV2 >= CURRENT_INSTRUCTION_VERSION;
    expect(alreadyV2).toBe(false);

    const bodyWithV4 = 'Your instructions for Gemini\n\n[BetterView v4] latest prompt';
    const verV4 = extractInstructionVersion(bodyWithV4);
    expect(verV4).toBe(4);
    const hasOldEntryV4 = hasOlderInstruction(bodyWithV4);
    expect(hasOldEntryV4).toBe(false);
    const alreadyV4 = verV4 !== null && verV4 >= CURRENT_INSTRUCTION_VERSION;
    expect(alreadyV4).toBe(true);
  });

  it('detects instruction versions: highest among multiple markers, and older markers detection', () => {
    // text with v2 then v3 -> extractInstructionVersion 3 and hasOlderInstruction true
    const textV2V3 = 'Your instructions for Gemini\n\n[BetterView v2] old prompt\n\n[BetterView v3] latest prompt';
    expect(extractInstructionVersion(textV2V3)).toBe(3);
    expect(hasOlderInstruction(textV2V3)).toBe(true);

    // text with v3 then v2 (reverse order) -> extractInstructionVersion 3 and hasOlderInstruction true
    const textV3V2 = 'Your instructions for Gemini\n\n[BetterView v3] latest prompt\n\n[BetterView v2] old prompt';
    expect(extractInstructionVersion(textV3V2)).toBe(3);
    expect(hasOlderInstruction(textV3V2)).toBe(true);

    // only v4 -> false
    const textOnlyV4 = 'Your instructions for Gemini\n\n[BetterView v4] latest prompt';
    expect(extractInstructionVersion(textOnlyV4)).toBe(4);
    expect(hasOlderInstruction(textOnlyV4)).toBe(false);

    // only plain [BetterView] -> 1 and true
    const textPlain = 'Your instructions for Gemini\n\n[BetterView] original prompt';
    expect(extractInstructionVersion(textPlain)).toBe(1);
    expect(hasOlderInstruction(textPlain)).toBe(true);

    // text without any markers -> null and false
    const textNone = 'Your instructions for Gemini\n\nNothing here';
    expect(extractInstructionVersion(textNone)).toBeNull();
    expect(hasOlderInstruction(textNone)).toBe(false);
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

    expect(textarea.value.startsWith('[BetterView v4] ')).toBe(true);
    expect(textarea.value).toBe(getCompactInstruction());
    expect(submitClicked).toBe(true);

    overlay.remove();
  });

  it('dispatches input, change, and blur events and refills if value reset', async () => {
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
    let blurCount = 0;

    textarea.addEventListener('keyup', () => { keyupCount++; });
    textarea.addEventListener('change', () => { changeCount++; });
    textarea.addEventListener('blur', () => { blurCount++; });
    textarea.addEventListener('input', () => {
      inputCount++;
      // Enable on second attempt (retry after value reset)
      if (inputCount === 1) {
        textarea.value = '';
      } else {
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
    expect(blurCount).toBeGreaterThanOrEqual(2);
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

  it('never fills the page chat composer when the Saved Info dialog is absent', async () => {
    const page = document.createElement('main');
    page.innerHTML = '<div contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini"></div><button>Send</button>';
    document.body.appendChild(page);
    const composer = page.querySelector<HTMLElement>('[contenteditable="true"]')!;

    await expect(fillGeminiMemoryDialog(page, { waitTimeoutMs: 100, pollIntervalMs: 20 })).rejects.toThrow(
      "Couldn't find the text box",
    );
    expect(composer.textContent).toBe('');

    page.remove();
  });
});

describe('runGeminiSetup', () => {
  it('fills and submits the form Gemini opened automatically as the dialog already open path', async () => {
    document.body.replaceChildren();
    const dialog = document.createElement('edit-memory-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<textarea aria-label="Enter new memory"></textarea><button data-test-id="submit-button" disabled>Submit</button>';
    const textarea = dialog.querySelector('textarea')!;
    const submit = dialog.querySelector<HTMLButtonElement>('button')!;
    textarea.addEventListener('input', () => { submit.disabled = false; });
    submit.addEventListener('click', () => dialog.remove());
    document.body.appendChild(dialog);

    const result = await runGeminiSetup({
      readyTimeoutMs: 100,
      addRetryMs: 50,
      verifyTimeoutMs: 200,
      pollMs: 20,
    });

    expect(result.status).toBe('added');
    expect(result.version).toBe(CURRENT_INSTRUCTION_VERSION);
    expect(textarea.value).toBe(getCompactInstruction());
    expect(dialog.isConnected).toBe(false);
    expect(document.querySelector('button')).toBeNull();
  });

  it('fills and submits Gemini\'s automatically opened shadow-root form as the dialog already open path', async () => {
    document.body.replaceChildren();
    const host = document.createElement('gemini-saved-info');
    const shadow = host.attachShadow({ mode: 'open' });
    const section = document.createElement('section');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<textarea aria-label="Memory"></textarea><button>Submit</button>';
    const editor = dialog.querySelector('textarea')!;
    const submit = dialog.querySelector('button')!;
    submit.addEventListener('click', () => dialog.remove());
    shadow.append(dialog, section);
    document.body.appendChild(host);

    const result = await runGeminiSetup({
      readyTimeoutMs: 100,
      addRetryMs: 50,
      verifyTimeoutMs: 200,
      pollMs: 20,
    });
    expect(result.status).toBe('added');
    expect(editor.value).toBe(getCompactInstruction());
    expect(dialog.isConnected).toBe(false);
  });

  it('page with Add button (mdc label "Add"): clicking opens dialog, fills, submits, and appends list item', async () => {
    document.body.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Saved info';
    const list = document.createElement('ul');

    const addBtn = document.createElement('button');
    addBtn.className = 'mdc-button';
    const span = document.createElement('span');
    span.className = 'mdc-button__label';
    span.textContent = 'Add';
    addBtn.appendChild(span);

    let addClicks = 0;
    let dialogTextarea: HTMLTextAreaElement | null = null;
    addBtn.addEventListener('click', () => {
      addClicks++;
      const dialog = document.createElement('edit-memory-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.innerHTML = `
        <textarea aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button" disabled>Submit</button>
      `;
      dialogTextarea = dialog.querySelector('textarea')!;
      const submit = dialog.querySelector<HTMLButtonElement>('button')!;
      dialogTextarea.addEventListener('input', () => {
        submit.disabled = false;
        submit.removeAttribute('disabled');
      });
      submit.addEventListener('click', () => {
        dialog.remove();
        const li = document.createElement('li');
        li.textContent = dialogTextarea!.value;
        list.appendChild(li);
      });
      document.body.appendChild(dialog);
    });

    document.body.append(heading, addBtn, list);

    const result = await runGeminiSetup({
      readyTimeoutMs: 500,
      addRetryMs: 100,
      verifyTimeoutMs: 500,
      pollMs: 20,
    });

    expect(result.status).toBe('added');
    expect(result.version).toBe(CURRENT_INSTRUCTION_VERSION);
    expect(addClicks).toBe(1);
    expect(dialogTextarea).not.toBeNull();
    expect(dialogTextarea!.value).toBe(getCompactInstruction());
    expect(list.textContent).toContain(getCompactInstruction());
  });

  it('Add button that only opens the dialog on the 2nd click -> added (retry works)', async () => {
    document.body.replaceChildren();
    const addBtn = document.createElement('button');
    const span = document.createElement('span');
    span.className = 'mdc-button__label';
    span.textContent = 'Add';
    addBtn.appendChild(span);

    let clicks = 0;
    addBtn.addEventListener('click', () => {
      clicks++;
      if (clicks >= 2) {
        const dialog = document.createElement('edit-memory-dialog');
        dialog.setAttribute('role', 'dialog');
        dialog.innerHTML = `
          <textarea aria-label="Enter new memory"></textarea>
          <button data-test-id="submit-button" disabled>Submit</button>
        `;
        const textarea = dialog.querySelector('textarea')!;
        const submit = dialog.querySelector<HTMLButtonElement>('button')!;
        textarea.addEventListener('input', () => {
          submit.disabled = false;
        });
        submit.addEventListener('click', () => {
          dialog.remove();
          const item = document.createElement('div');
          item.textContent = textarea.value;
          document.body.appendChild(item);
        });
        document.body.appendChild(dialog);
      }
    });

    document.body.appendChild(addBtn);

    const result = await runGeminiSetup({
      readyTimeoutMs: 500,
      addRetryMs: 60,
      verifyTimeoutMs: 500,
      pollMs: 15,
    });

    expect(result.status).toBe('added');
    expect(clicks).toBe(2);
  });

  it('page already containing "[BetterView v<CURRENT>]" entry text -> already, Add NOT clicked', async () => {
    document.body.replaceChildren();
    const entry = document.createElement('div');
    entry.textContent = `Saved instructions: [BetterView v${CURRENT_INSTRUCTION_VERSION}] some instructions`;

    const addBtn = document.createElement('button');
    const span = document.createElement('span');
    span.className = 'mdc-button__label';
    span.textContent = 'Add';
    addBtn.appendChild(span);

    let addClicked = false;
    addBtn.addEventListener('click', () => {
      addClicked = true;
    });

    document.body.append(entry, addBtn);

    const result = await runGeminiSetup({
      readyTimeoutMs: 200,
      addRetryMs: 50,
      verifyTimeoutMs: 200,
      pollMs: 20,
    });

    expect(result.status).toBe('already');
    expect(result.version).toBe(CURRENT_INSTRUCTION_VERSION);
    expect(result.hasOldEntry).toBe(false);
    expect(addClicked).toBe(false);
  });

  it('page with older "[BetterView v3]" entry -> adds and result.hasOldEntry === true', async () => {
    document.body.replaceChildren();
    const oldEntry = document.createElement('div');
    oldEntry.textContent = 'Saved instructions: [BetterView v3] older instructions';

    const addBtn = document.createElement('button');
    addBtn.setAttribute('aria-label', 'Add memory');

    addBtn.addEventListener('click', () => {
      const dialog = document.createElement('edit-memory-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.innerHTML = `
        <textarea aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button" disabled>Submit</button>
      `;
      const textarea = dialog.querySelector('textarea')!;
      const submit = dialog.querySelector<HTMLButtonElement>('button')!;
      textarea.addEventListener('input', () => {
        submit.disabled = false;
        submit.removeAttribute('disabled');
      });
      submit.addEventListener('click', () => {
        dialog.remove();
        const item = document.createElement('div');
        item.textContent = textarea.value;
        document.body.appendChild(item);
      });
      document.body.appendChild(dialog);
    });

    document.body.append(oldEntry, addBtn);

    const result = await runGeminiSetup({
      readyTimeoutMs: 500,
      addRetryMs: 80,
      verifyTimeoutMs: 500,
      pollMs: 20,
    });

    expect(result.status).toBe('added');
    expect(result.hasOldEntry).toBe(true);
  });

  it('no Add button / no dialog -> failed with error mentioning Add button', async () => {
    document.body.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Your instructions for Gemini';
    document.body.appendChild(heading);

    const result = await runGeminiSetup({
      readyTimeoutMs: 50,
      addRetryMs: 40,
      verifyTimeoutMs: 50,
      pollMs: 10,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/Add button/i);
  });

  it('error toast "Something went wrong" after submit (dialog stays) -> failed', async () => {
    document.body.replaceChildren();
    const dialog = document.createElement('edit-memory-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <textarea aria-label="Enter new memory"></textarea>
      <button data-test-id="submit-button" disabled>Submit</button>
    `;
    const textarea = dialog.querySelector('textarea')!;
    const submit = dialog.querySelector<HTMLButtonElement>('button')!;
    textarea.addEventListener('input', () => {
      submit.disabled = false;
      submit.removeAttribute('disabled');
    });
    submit.addEventListener('click', () => {
      const toast = document.createElement('div');
      toast.className = 'error-toast';
      toast.textContent = 'Something went wrong. Please try again later.';
      document.body.appendChild(toast);
    });
    document.body.appendChild(dialog);

    const result = await runGeminiSetup({
      readyTimeoutMs: 500,
      addRetryMs: 100,
      verifyTimeoutMs: 500,
      pollMs: 20,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/Gemini rejected the entry: Something went wrong/i);
    expect(dialog.isConnected).toBe(true);
  });

  it('auto-opened dialog with non-empty unrelated user text -> failed, text unchanged', async () => {
    document.body.replaceChildren();
    const userText = 'Remember that my dog name is Rover and my birthday is May 4th.';
    const dialog = document.createElement('edit-memory-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <textarea aria-label="Enter new memory">${userText}</textarea>
      <button data-test-id="submit-button">Submit</button>
    `;
    document.body.appendChild(dialog);

    const textarea = dialog.querySelector('textarea')!;

    const result = await runGeminiSetup({
      readyTimeoutMs: 200,
      addRetryMs: 50,
      verifyTimeoutMs: 200,
      pollMs: 20,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/existing|overwriting/i);
    expect(textarea.value).toBe(userText);
  });

  it('isGeminiSavedInfoPath correctly classifies saved-info paths and non-saved-info paths', () => {
    expect(isGeminiSavedInfoPath('/saved-info')).toBe(true);
    expect(isGeminiSavedInfoPath('/saved-info/')).toBe(true);
    expect(isGeminiSavedInfoPath('/u/1/saved-info')).toBe(true);
    expect(isGeminiSavedInfoPath('/u/0/saved-info/')).toBe(true);
    expect(isGeminiSavedInfoPath('/app')).toBe(false);
    expect(isGeminiSavedInfoPath('/saved-info-x')).toBe(false);
    expect(isGeminiSavedInfoPath('/')).toBe(false);
  });

  it('a pre-opened dialog means Add isn\'t clicked', async () => {
    document.body.replaceChildren();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const addBtn = document.createElement('button');
    addBtn.className = 'create-memory-button';
    addBtn.textContent = 'Add';
    let addClicked = false;
    addBtn.addEventListener('click', () => {
      addClicked = true;
    });

    const dialog = document.createElement('mat-dialog-container');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <edit-memory-dialog>
        <textarea class="edit-memory-input" aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button" class="edit-memory-submit-button" disabled>Submit</button>
      </edit-memory-dialog>
    `;
    const textarea = dialog.querySelector('textarea')!;
    const submit = dialog.querySelector<HTMLButtonElement>('button[data-test-id="submit-button"]')!;
    textarea.addEventListener('input', () => {
      submit.disabled = false;
      submit.removeAttribute('disabled');
      submit.classList.remove('mat-mdc-button-disabled');
    });
    submit.addEventListener('click', () => {
      dialog.remove();
    });

    document.body.append(addBtn, dialog);

    const result = await runGeminiSetup({
      readyTimeoutMs: 500,
      addRetryMs: 100,
      verifyTimeoutMs: 500,
      pollMs: 20,
    });

    expect(result.status).toBe('added');
    expect(addClicked).toBe(false);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('dialog already open (skipping Add)'));
    infoSpy.mockRestore();
  });

  it('a value reset after fill triggers a refill', async () => {
    document.body.replaceChildren();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const dialog = document.createElement('mat-dialog-container');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <edit-memory-dialog>
        <textarea class="edit-memory-input" aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button" class="edit-memory-submit-button" disabled>Submit</button>
      </edit-memory-dialog>
    `;
    const textarea = dialog.querySelector('textarea')!;
    const submit = dialog.querySelector<HTMLButtonElement>('button[data-test-id="submit-button"]')!;

    let fills = 0;
    textarea.addEventListener('input', () => {
      fills++;
      if (fills === 1) {
        // Simulate Angular resetting the value after first fill
        textarea.value = '';
      } else {
        submit.disabled = false;
        submit.removeAttribute('disabled');
        submit.classList.remove('mat-mdc-button-disabled');
      }
    });

    submit.addEventListener('click', () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);

    const result = await runGeminiSetup({
      readyTimeoutMs: 500,
      addRetryMs: 100,
      verifyTimeoutMs: 500,
      pollMs: 20,
    });

    expect(result.status).toBe('added');
    expect(fills).toBeGreaterThanOrEqual(2);
    expect(textarea.value).toBe(getCompactInstruction());
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('fill attempt 1 value length'));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('fill attempt 2 value length'));
    infoSpy.mockRestore();
  });

  it('a Submit that stays disabled gives the clear error and no click', async () => {
    document.body.replaceChildren();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const dialog = document.createElement('mat-dialog-container');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <edit-memory-dialog>
        <textarea class="edit-memory-input" aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button" class="edit-memory-submit-button mat-mdc-button-disabled" disabled>Submit</button>
      </edit-memory-dialog>
    `;
    const submit = dialog.querySelector<HTMLButtonElement>('button[data-test-id="submit-button"]')!;

    let submitClicked = false;
    submit.addEventListener('click', () => {
      submitClicked = true;
    });

    document.body.appendChild(dialog);

    const result = await runGeminiSetup({
      readyTimeoutMs: 200,
      addRetryMs: 50,
      verifyTimeoutMs: 200,
      pollMs: 20,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe("Gemini's Submit button stayed disabled after filling");
    expect(submitClicked).toBe(false);

    // Verify "submitted memory dialog" was never logged
    const loggedCalls = infoSpy.mock.calls.map((c) => String(c[0]));
    expect(loggedCalls.some((c) => c.includes('submitted memory dialog'))).toBe(false);

    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('two dialogs means the topmost is used', async () => {
    document.body.replaceChildren();

    // Dialog 1: lower/earlier dialog
    const dialog1 = document.createElement('mat-dialog-container');
    dialog1.setAttribute('role', 'dialog');
    dialog1.innerHTML = `
      <edit-memory-dialog>
        <textarea class="edit-memory-input" aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button" class="edit-memory-submit-button" disabled>Submit</button>
      </edit-memory-dialog>
    `;
    const ta1 = dialog1.querySelector('textarea')!;
    const btn1 = dialog1.querySelector<HTMLButtonElement>('button[data-test-id="submit-button"]')!;
    let btn1Clicked = false;
    btn1.addEventListener('click', () => {
      btn1Clicked = true;
    });

    // Dialog 2: topmost/last dialog
    const dialog2 = document.createElement('mat-dialog-container');
    dialog2.setAttribute('role', 'dialog');
    dialog2.innerHTML = `
      <edit-memory-dialog>
        <textarea class="edit-memory-input" aria-label="Enter new memory"></textarea>
        <button data-test-id="submit-button" class="edit-memory-submit-button" disabled>Submit</button>
      </edit-memory-dialog>
    `;
    const ta2 = dialog2.querySelector('textarea')!;
    const btn2 = dialog2.querySelector<HTMLButtonElement>('button[data-test-id="submit-button"]')!;
    let btn2Clicked = false;
    ta2.addEventListener('input', () => {
      btn2.disabled = false;
      btn2.removeAttribute('disabled');
      btn2.classList.remove('mat-mdc-button-disabled');
    });
    btn2.addEventListener('click', () => {
      btn2Clicked = true;
      dialog2.remove();
    });

    document.body.append(dialog1, dialog2);

    const result = await runGeminiSetup({
      readyTimeoutMs: 500,
      addRetryMs: 100,
      verifyTimeoutMs: 500,
      pollMs: 20,
    });

    expect(result.status).toBe('added');
    expect(btn1Clicked).toBe(false);
    expect(btn2Clicked).toBe(true);
    expect(ta1.value).toBe('');
    expect(ta2.value).toBe(getCompactInstruction());
  });
});

describe('Brand Icons', () => {
  it('grokIconSvg returns an svg containing a path with fill-rule evenodd (not a circle+line)', () => {
    const svg = grokIconSvg();
    expect(svg.tagName.toLowerCase()).toBe('svg');
    const path = svg.querySelector('path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('fill-rule')).toBe('evenodd');
    expect(svg.querySelector('circle')).toBeNull();
    expect(svg.querySelector('line')).toBeNull();
  });
});

describe('runGrokSetup', () => {
  it('opens Grok Settings → Customize and saves the custom instructions', async () => {
    const profile = document.createElement('button');
    profile.setAttribute('aria-label', 'Profile');
    profile.addEventListener('click', () => {
      const settings = document.createElement('button');
      settings.textContent = 'Settings';
      settings.addEventListener('click', () => {
        const customize = document.createElement('button');
        customize.textContent = 'Customize';
        customize.addEventListener('click', () => {
          const region = document.createElement('section');
          region.setAttribute('role', 'region');
          region.setAttribute('aria-label', 'Customize');
          region.innerHTML = '<textarea aria-label="Instructions"></textarea><button>Save</button>';
          document.body.replaceChildren(region);
        });
        document.body.replaceChildren(customize);
      });
      document.body.replaceChildren(settings);
    });
    document.body.appendChild(profile);

    const result = await runGrokSetup();
    expect(result.status).toBe('added');
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value.startsWith('[BetterView v4]')).toBe(true);
    document.body.replaceChildren();
  });

  it('saves the current v4 instruction successfully', async () => {
    const region = document.createElement('div');
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', 'Customize');
    region.innerHTML = `
      <button role="combobox">Custom</button>
      <textarea aria-label="Instructions"></textarea>
      <button>Save</button>
    `;
    document.body.appendChild(region);

    const result = await runGrokSetup();
    const textarea = region.querySelector('textarea')!;
    expect(result.status).toBe('added');
    expect(textarea.value.startsWith('[BetterView v4]')).toBe(true);

    region.remove();
  });

  it('recognizes an existing current instruction without duplicating it', async () => {
    const region = document.createElement('div');
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', 'Customize');
    region.innerHTML = `
      <button role="combobox">Custom</button>
      <textarea aria-label="Instructions">[BetterView v4] current instruction</textarea>
      <button>Save</button>
    `;
    document.body.appendChild(region);

    const result = await runGrokSetup();
    expect(result.status).toBe('already');
    expect(region.querySelector('textarea')?.value).toBe('[BetterView v4] current instruction');

    region.remove();
  });

  it("returns failed when the textarea value doesn't contain the marker after save", async () => {
    const region = document.createElement('div');
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', 'Customize');
    region.innerHTML = `
      <button role="combobox">Custom</button>
      <textarea aria-label="Instructions"></textarea>
      <button>Save</button>
    `;
    document.body.appendChild(region);

    const textarea = region.querySelector('textarea')!;
    const saveBtn = region.querySelector<HTMLButtonElement>('button:last-of-type')!;

    // When Save is clicked, simulate failure by reverting textarea to empty/old text
    saveBtn.addEventListener('click', () => {
      textarea.value = 'Failed to persist';
    });

    const result = await runGrokSetup();
    expect(result.status).toBe('failed');
    expect(result.error).toBe("Grok didn't save");

    region.remove();
  });
});
