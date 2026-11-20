import { ThemeMode } from './theme';
import { UISpec, UIType, UI_TYPES } from './types';
import { tryParse, sniffType } from './parse';
import { validateSpec } from './validate';
import { clear, h } from './dom';
import { RENDERERS, RenderContext } from '../components/index';
import baseCss from './styles/base.css?inline';
import { COMPONENT_STYLES } from '../components/styles';

export interface BlockHandle {
  update(text: string): void;
  finalize(): void;
  setTheme(t: ThemeMode): void;
  destroy(): void;
  readonly state: 'skeleton' | 'rendered' | 'fallback';
}

const ALL_STYLES = [baseCss, ...COMPONENT_STYLES];
let cachedSheets: CSSStyleSheet[] | null = null;

function applyStylesToShadowRoot(shadowRoot: ShadowRoot): void {
  try {
    if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
      if (!cachedSheets) {
        cachedSheets = ALL_STYLES.map((css) => {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(css);
          return sheet;
        });
      }
      shadowRoot.adoptedStyleSheets = cachedSheets;
      return;
    }
  } catch {
    // fallback below
  }

  for (const css of ALL_STYLES) {
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    shadowRoot.appendChild(styleEl);
  }
}

function createSkeleton(typeHint?: UIType): HTMLElement {
  const card = h('div', { class: 'iui-card' });
  if (typeHint === 'flow') {
    const grid = h('div', { class: 'iui-skel-flow-grid' });
    for (let r = 0; r < 3; r++) {
      const row = h(
        'div',
        { class: 'iui-skel-flow-row' },
        h('div', { class: 'iui-skel iui-skel-flow-box' }),
        h('div', { class: 'iui-skel iui-skel-flow-box' }),
      );
      grid.appendChild(row);
    }
    card.appendChild(grid);
  } else if (typeHint === 'table') {
    for (let i = 0; i < 5; i++) {
      card.appendChild(h('div', { class: 'iui-skel iui-skel-line' }));
    }
  } else if (typeHint === 'chart') {
    card.appendChild(h('div', { class: 'iui-skel iui-skel-chart' }));
  } else if (typeHint === 'quiz') {
    for (let i = 0; i < 3; i++) {
      card.appendChild(h('div', { class: 'iui-skel iui-skel-quiz-bar' }));
    }
  } else {
    // default: 4 lines
    for (let i = 0; i < 4; i++) {
      card.appendChild(h('div', { class: 'iui-skel iui-skel-line' }));
    }
  }
  return card;
}

export function mountBlock(
  anchor: HTMLElement,
  opts: { theme: ThemeMode; insert?: 'after' | 'inside' },
): BlockHandle {
  const host = h('div', { class: 'iui-host', 'data-iui': '1' });

  if (opts.insert === 'inside') {
    anchor.appendChild(host);
  } else {
    if (anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor.nextSibling);
    } else {
      anchor.appendChild(host);
    }
  }

  const shadowRoot = host.attachShadow({ mode: 'open' });
  applyStylesToShadowRoot(shadowRoot);

  let currentTheme: ThemeMode = opts.theme;
  const root = h('div', { class: 'iui-root', 'data-theme': currentTheme });
  shadowRoot.appendChild(root);

  let currentState: 'skeleton' | 'rendered' | 'fallback' = 'skeleton';
  let cleanups: (() => void)[] = [];
  let finalizeTimer: number | null = null;
  let lastText: string | null = null;
  let lastRawText = '';
  let lastErrorMessage = '';
  let lastRenderedSpec: UISpec | null = null;
  let lastRenderedSpecJson = '';

  function runCleanups(): void {
    for (const fn of cleanups) {
      try {
        fn();
      } catch (err) {
        console.error('Error during render cleanup:', err);
      }
    }
    cleanups = [];
  }

  function showSkeleton(typeHint?: UIType): void {
    runCleanups();
    clear(root);
    const skel = createSkeleton(typeHint);
    root.appendChild(skel);
    currentState = 'skeleton';
  }

  function showFallback(errorMessage: string, rawText: string): void {
    runCleanups();
    clear(root);
    const noteText = errorMessage
      ? `Couldn't render this UI block: ${errorMessage}`
      : "Couldn't render this UI block";
    const fallback = h(
      'div',
      { class: 'iui-fallback' },
      h('div', { class: 'iui-fallback-note' }, noteText),
      h('pre', { class: 'iui-fallback-pre' }, rawText),
    );
    root.appendChild(fallback);
    currentState = 'fallback';
  }

  function renderSpec(spec: UISpec, rawText: string): void {
    runCleanups();
    try {
      const ctx: RenderContext = {
        theme: currentTheme,
        onCleanup(fn: () => void) {
          cleanups.push(fn);
        },
      };
      const renderer = RENDERERS[spec.type];
      if (!renderer) {
        throw new Error(`No renderer for type: ${spec.type}`);
      }
      const componentEl = renderer(spec as any, ctx);

      clear(root);
      const wrapper = h('div', { class: 'iui-rendered-wrap' });
      wrapper.appendChild(componentEl);

      let sourcePre: HTMLElement | null = null;
      const toggleBtn = h(
        'button',
        {
          class: 'iui-source-toggle',
          type: 'button',
          onClick: () => {
            if (!sourcePre) {
              sourcePre = h('pre', { class: 'iui-source-pre' }, lastRawText);
              wrapper.appendChild(sourcePre);
              toggleBtn.textContent = '{ } Hide source';
            } else {
              sourcePre.remove();
              sourcePre = null;
              toggleBtn.textContent = '{ } View source';
            }
          },
        },
        '{ } View source',
      );

      wrapper.appendChild(toggleBtn);
      root.appendChild(wrapper);

      currentState = 'rendered';
      lastRenderedSpec = spec;
      lastRenderedSpecJson = JSON.stringify(spec);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showFallback(msg, rawText);
    }
  }

  // Initial skeleton view
  showSkeleton();

  function finalize(): void {
    if (finalizeTimer !== null) {
      window.clearTimeout(finalizeTimer);
      finalizeTimer = null;
    }
    if (currentState !== 'rendered') {
      const errorMsg = lastErrorMessage || 'Could not parse or validate UI block';
      showFallback(errorMsg, lastRawText);
    }
  }

  return {
    update(text: string) {
      if (text === lastText) {
        return;
      }
      lastText = text;
      lastRawText = text;

      if (finalizeTimer !== null) {
        window.clearTimeout(finalizeTimer);
      }
      finalizeTimer = window.setTimeout(() => {
        finalize();
      }, 1500);

      const parseRes = tryParse(text);
      if (parseRes.ok) {
        const valRes = validateSpec(parseRes.value);
        if (valRes.ok) {
          lastErrorMessage = '';
          const canonical = JSON.stringify(valRes.spec);
          if (canonical !== lastRenderedSpecJson || currentState !== 'rendered') {
            renderSpec(valRes.spec, text);
          } else {
            const existingPre = root.querySelector<HTMLElement>('.iui-source-pre');
            if (existingPre) {
              existingPre.textContent = text;
            }
          }
        } else {
          lastErrorMessage = valRes.error;
          const rawVal = parseRes.value;
          const typeHint =
            rawVal &&
            typeof rawVal === 'object' &&
            'type' in rawVal &&
            typeof (rawVal as Record<string, unknown>).type === 'string' &&
            (UI_TYPES as readonly string[]).includes((rawVal as Record<string, unknown>).type as string)
              ? ((rawVal as Record<string, unknown>).type as UIType)
              : sniffType(text);
          showSkeleton(typeHint);
        }
      } else {
        lastErrorMessage = parseRes.error;
        showSkeleton(parseRes.typeHint);
      }
    },
    finalize,
    setTheme(t: ThemeMode) {
      currentTheme = t;
      root.setAttribute('data-theme', t);
      if (currentState === 'rendered' && lastRenderedSpec) {
        renderSpec(lastRenderedSpec, lastRawText);
      }
    },
    destroy() {
      if (finalizeTimer !== null) {
        window.clearTimeout(finalizeTimer);
        finalizeTimer = null;
      }
      runCleanups();
      host.remove();
    },
    get state() {
      return currentState;
    },
  };
}
