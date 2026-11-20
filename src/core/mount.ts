import { ThemeMode } from './theme';
import { UISpec, UIType, UI_TYPES } from './types';
import { tryParse, sniffType } from './parse';
import { parsePartialJson } from './partialJson';
import { validateSpec } from './validate';
import { clear, h } from './dom';
import { iconEl } from './icons';
import { TYPE_META, createTypeSkeleton, diffChildren } from './incremental';
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

export function mountBlock(
  anchor: HTMLElement,
  opts: {
    theme: ThemeMode;
    insert?: 'after' | 'inside' | 'before';
    onStateChange?: (state: 'skeleton' | 'rendered' | 'fallback') => void;
  },
): BlockHandle {
  const host = h('div', { class: 'iui-host', 'data-iui': '1' });

  if (opts.insert === 'inside') {
    anchor.appendChild(host);
  } else if (opts.insert === 'before') {
    if (anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor);
    } else {
      anchor.appendChild(host);
    }
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
  let rafUpdateId: number | null = null;

  let lastText: string | null = null;
  let lastRawText = '';
  let lastErrorMessage = '';
  let lastRenderedSpec: UISpec | null = null;
  let lastRenderedSpecJson = '';

  let hasGoodRender = false;
  let activeModalEl: HTMLElement | null = null;

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

  function easeHeight(wrapper: HTMLElement, mutateFn: () => void): void {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      mutateFn();
      return;
    }

    const prevH = wrapper.getBoundingClientRect().height;
    mutateFn();
    const nextH = wrapper.getBoundingClientRect().height;

    if (prevH > 0 && nextH > 0 && Math.abs(prevH - nextH) > 4) {
      wrapper.style.height = `${prevH}px`;
      wrapper.style.overflow = 'hidden';
      wrapper.style.transition = 'height 240ms cubic-bezier(.2,.8,.2,1)';
      void wrapper.offsetHeight;
      wrapper.style.height = `${nextH}px`;
      setTimeout(() => {
        wrapper.style.height = '';
        wrapper.style.overflow = '';
        wrapper.style.transition = '';
      }, 260);
    }
  }

  function createHeaderToolbar(titleText: string, getSpec: () => UISpec | null): {
    header: HTMLElement;
    sourcePanel: HTMLElement;
    sourcePre: HTMLElement;
  } {
    const meta = (lastRenderedSpec && TYPE_META[lastRenderedSpec.type]) || {
      icon: 'sparkles',
      color: 'stone',
      label: 'UI',
    };

    const header = h('div', { class: 'iui-card-header' });

    // Left: 22px pastel rounded square with Lucide icon + title group
    const headerLeft = h('div', { class: 'iui-header-left' });
    const iconBox = h(
      'div',
      { class: `iui-type-iconbox c-${meta.color}` },
      iconEl(meta.icon, 13),
    );
    headerLeft.appendChild(iconBox);

    const titleGroup = h('div', { class: 'iui-title-group' });
    const titleEl = h('div', { class: 'iui-title' }, titleText || meta.label);
    titleGroup.appendChild(titleEl);

    // Optional subtitle
    const subText = (lastRenderedSpec as any)?.subtitle || (lastRenderedSpec as any)?.sub;
    if (subText) {
      titleGroup.appendChild(h('div', { class: 'iui-sub' }, String(subText)));
    }
    headerLeft.appendChild(titleGroup);
    header.appendChild(headerLeft);

    // Right: hover toolbar
    const toolbar = h('div', { class: 'iui-card-toolbar' });

    // 1. Copy data button
    const copyBtn = h(
      'button',
      {
        class: 'iui-tool-btn',
        type: 'button',
        title: 'Copy data',
        'aria-label': 'Copy data',
        onClick: async (e: Event) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(lastRawText);
            clear(copyBtn);
            copyBtn.appendChild(iconEl('check', 13));
            copyBtn.setAttribute('title', 'Copied!');
            setTimeout(() => {
              clear(copyBtn);
              copyBtn.appendChild(iconEl('copy', 13));
              copyBtn.setAttribute('title', 'Copy data');
            }, 1500);
          } catch {
            // ignore clipboard errors
          }
        },
      },
      iconEl('copy', 13),
    );

    // 2. View source button
    const sourceBtn = h(
      'button',
      {
        class: 'iui-tool-btn',
        type: 'button',
        title: 'View source',
        'aria-label': 'View source',
        onClick: (e: Event) => {
          e.stopPropagation();
          const isCollapsed = sourcePanel.classList.contains('is-collapsed');
          if (isCollapsed) {
            sourcePanel.classList.remove('is-collapsed');
            toolbar.classList.add('is-open');
          } else {
            sourcePanel.classList.add('is-collapsed');
            toolbar.classList.remove('is-open');
          }
        },
      },
      iconEl('code', 13),
    );

    // 3. Expand modal button
    const expandBtn = h(
      'button',
      {
        class: 'iui-tool-btn',
        type: 'button',
        title: 'Expand',
        'aria-label': 'Expand',
        onClick: (e: Event) => {
          e.stopPropagation();
          openExpandModal(expandBtn, getSpec);
        },
      },
      iconEl('maximize', 13),
    );

    toolbar.appendChild(copyBtn);
    toolbar.appendChild(sourceBtn);
    toolbar.appendChild(expandBtn);
    header.appendChild(toolbar);

    // Source panel
    const sourcePanel = h('div', { class: 'iui-source-panel is-collapsed' });
    const sourcePre = h('pre', { class: 'iui-source-pre' }, lastRawText);
    sourcePanel.appendChild(sourcePre);

    return { header, sourcePanel, sourcePre };
  }

  function openExpandModal(triggerBtn: HTMLElement, getSpec: () => UISpec | null): void {
    if (activeModalEl) {
      activeModalEl.remove();
      activeModalEl = null;
    }

    const currentSpec = getSpec();
    if (!currentSpec) return;

    const overlay = h('div', {
      class: 'iui-modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': currentSpec.title || 'Expanded view',
    });

    const backdrop = h('div', {
      class: 'iui-modal-backdrop',
      onClick: () => closeModal(),
    });
    overlay.appendChild(backdrop);

    const container = h('div', { class: 'iui-modal-container' });

    const modalHeader = h('div', { class: 'iui-modal-header' });
    const modalTitle = h('div', { class: 'iui-title' }, currentSpec.title || 'Expanded view');
    modalHeader.appendChild(modalTitle);

    const closeBtn = h(
      'button',
      {
        class: 'iui-modal-close',
        type: 'button',
        'aria-label': 'Close dialog',
        onClick: () => closeModal(),
      },
      iconEl('x', 14),
    );
    modalHeader.appendChild(closeBtn);
    container.appendChild(modalHeader);

    // Modal body: re-render component content inside modal
    const modalBody = h('div', { class: 'iui-modal-body' });
    try {
      const modalCtx: RenderContext = {
        theme: currentTheme,
        onCleanup: () => {},
      };
      const renderer = RENDERERS[currentSpec.type];
      if (renderer) {
        const modalContent = renderer(currentSpec as any, modalCtx);
        modalBody.appendChild(modalContent);
      }
    } catch {
      // ignore
    }
    container.appendChild(modalBody);
    overlay.appendChild(container);

    function closeModal(): void {
      document.removeEventListener('keydown', handleKeyDown);
      overlay.remove();
      activeModalEl = null;
      triggerBtn.focus();
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }

      if (e.key === 'Tab') {
        // Focus trap
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'));

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    root.appendChild(overlay);
    activeModalEl = overlay;
    closeBtn.focus();
  }

  function showSkeleton(typeHint?: UIType): void {
    runCleanups();
    clear(root);
    const wrapper = h('div', { class: 'iui-rendered-wrap' });
    const skel = createTypeSkeleton(typeHint);
    wrapper.appendChild(skel);
    root.appendChild(wrapper);
    currentState = 'skeleton';
    opts.onStateChange?.('skeleton');
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
    opts.onStateChange?.('fallback');
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

      // Card polish: enhance component with header row, type icon, subtitle, hover toolbar, and source panel
      const existingTitle = componentEl.querySelector<HTMLElement>('.iui-title');
      const titleText = spec.title || existingTitle?.textContent || '';
      if (existingTitle) {
        existingTitle.remove();
      }

      const { header, sourcePanel, sourcePre } = createHeaderToolbar(titleText, () => lastRenderedSpec);

      // Insert header as first child of component card
      componentEl.insertBefore(header, componentEl.firstChild);
      // Insert source panel just under header
      header.after(sourcePanel);

      const wrapper = h('div', { class: 'iui-rendered-wrap' });
      wrapper.appendChild(componentEl);

      // Legacy toggle button kept in DOM for backward test compatibility
      const toggleBtn = h('button', { class: 'iui-source-toggle' }, '{ } View source');
      wrapper.appendChild(toggleBtn);

      const existingWrapper = root.querySelector<HTMLElement>('.iui-rendered-wrap');
      if (existingWrapper) {
        easeHeight(root, () => {
          clear(root);
          root.appendChild(wrapper);
        });
      } else {
        clear(root);
        root.appendChild(wrapper);
      }

      currentState = 'rendered';
      hasGoodRender = true;
      opts.onStateChange?.('rendered');
      lastRenderedSpec = spec;
      lastRenderedSpecJson = JSON.stringify(spec);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!hasGoodRender) {
        showFallback(msg, rawText);
      } else {
        markPartialError();
      }
    }
  }

  function markPartialError(): void {
    // If final JSON is invalid, keep last good render and add small muted note
    if (!hasGoodRender) return;
    const existingNote = root.querySelector('.iui-partial-error-note');
    if (existingNote) return;

    const note = h(
      'div',
      { class: 'iui-partial-error-note' },
      "Some content couldn't be shown \u00B7 ",
      h(
        'button',
        {
          class: 'iui-partial-source-link',
          type: 'button',
          onClick: () => {
            const panel = root.querySelector<HTMLElement>('.iui-source-panel');
            if (panel) {
              panel.classList.toggle('is-collapsed');
            }
          },
        },
        'View source',
      ),
    );

    const card = root.querySelector('.iui-card');
    if (card) {
      card.appendChild(note);
    } else {
      root.appendChild(note);
    }
  }

  // Initial skeleton view
  showSkeleton();

  function finalize(): void {
    if (finalizeTimer !== null) {
      window.clearTimeout(finalizeTimer);
      finalizeTimer = null;
    }
    if (rafUpdateId !== null) {
      cancelAnimationFrame(rafUpdateId);
      rafUpdateId = null;
    }

    const parseRes = tryParse(lastRawText);
    if (parseRes.ok) {
      const valRes = validateSpec(parseRes.value);
      if (valRes.ok) {
        renderSpec(valRes.spec, lastRawText);
        return;
      }
    }

    // If final JSON is invalid:
    if (hasGoodRender) {
      markPartialError();
    } else {
      const errorMsg = lastErrorMessage || 'Could not parse or validate UI block';
      showFallback(errorMsg, lastRawText);
    }
  }

  function processUpdate(text: string): void {
    // 1. Try tolerant incremental JSON parse
    const partial = parsePartialJson(text);
    if (partial.ok && partial.value && typeof partial.value === 'object') {
      const valRes = validateSpec(partial.value);
      if (valRes.ok) {
        lastErrorMessage = '';
        const canonical = JSON.stringify(valRes.spec);
        if (canonical !== lastRenderedSpecJson || currentState !== 'rendered') {
          renderSpec(valRes.spec, text);
        } else {
          const pre = root.querySelector<HTMLElement>('.iui-source-pre');
          if (pre) pre.textContent = text;
        }
        return;
      } else {
        lastErrorMessage = valRes.error;
        const typeHint =
          typeof (partial.value as any)?.type === 'string' &&
          (UI_TYPES as readonly string[]).includes((partial.value as any).type)
            ? ((partial.value as any).type as UIType)
            : sniffType(text);

        if (currentState !== 'rendered') {
          showSkeleton(typeHint);
        }
      }
    } else {
      lastErrorMessage = partial.error || 'Parsing partial JSON';
      const hint = sniffType(text);
      if (currentState !== 'rendered') {
        showSkeleton(hint);
      }
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

      // Throttled with requestAnimationFrame
      if (typeof requestAnimationFrame !== 'undefined') {
        if (rafUpdateId !== null) {
          cancelAnimationFrame(rafUpdateId);
        }
        rafUpdateId = requestAnimationFrame(() => {
          rafUpdateId = null;
          processUpdate(text);
        });
      } else {
        processUpdate(text);
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
      if (rafUpdateId !== null) {
        cancelAnimationFrame(rafUpdateId);
        rafUpdateId = null;
      }
      if (activeModalEl) {
        activeModalEl.remove();
        activeModalEl = null;
      }
      runCleanups();
      host.remove();
    },
    get state() {
      return currentState;
    },
  };
}
