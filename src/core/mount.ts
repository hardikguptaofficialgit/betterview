import { ThemeMode } from './theme';
import { readHostTypography, applyHostTheme } from './hostTheme';
import { UISpec, UIType, UI_TYPES } from './types';
import { tryParse, sniffType } from './parse';
import { parsePartialJson } from './partialJson';
import { validateSpec } from './validate';
import { clear, h } from './dom';
import { iconEl, typeIconEl } from './icons';
import { TYPE_META } from './incremental';
import { RENDERERS, RenderContext } from '../components/index';
import baseCss from './styles/base.css?inline';
import { COMPONENT_STYLES } from '../components/styles';
import { exportCard, showCardToast } from './export';
import { loadSettings, onSettingsChange } from '../shared/settings';

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
    host?: 'gemini' | 'grok';
    insert?: 'after' | 'inside' | 'before';
    onStateChange?: (state: 'skeleton' | 'rendered' | 'fallback') => void;
    initialText?: string;
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
  const rootAttrs: Record<string, string> = {
    class: 'iui-root',
    'data-theme': currentTheme,
  };
  if (opts.host) {
    rootAttrs['data-host'] = opts.host;
  }
  const root = h('div', rootAttrs);
  shadowRoot.appendChild(root);

  const initialTypography = readHostTypography(anchor);
  applyHostTheme(root, opts.host, currentTheme, initialTypography);

  let currentState: 'skeleton' | 'rendered' | 'fallback' = 'skeleton';
  let cleanups: (() => void)[] = [];
  let finalizeTimer: number | null = null;

  let lastText: string | null = null;
  let lastRawText = '';
  let lastErrorMessage = '';
  let lastRenderedSpec: UISpec | null = null;
  let lastRenderedSpecJson = '';

  let hasGoodRender = false;
  let activeModalEl: HTMLElement | null = null;
  let watermarkEnabled = true;

  loadSettings()
    .then((s) => {
      watermarkEnabled = s.watermark !== false;
    })
    .catch(() => {});
  cleanups.push(
    onSettingsChange((s) => {
      watermarkEnabled = s.watermark !== false;
    }),
  );

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



  function createHeaderToolbar(
    titleText: string,
    getSpec: () => UISpec | null,
    getCardEl: () => HTMLElement | null,
  ): {
    header: HTMLElement;
    sourcePanel: HTMLElement;
    sourcePre: HTMLElement;
  } {
    const meta = (lastRenderedSpec && TYPE_META[lastRenderedSpec.type]) || {
      icon: 'sparkle',
      color: 'stone',
      label: 'UI',
    };

    let iconColor = meta.color;
    if (lastRenderedSpec && lastRenderedSpec.type === 'callout') {
      const tone = (lastRenderedSpec as any).tone;
      if (tone === 'success') iconColor = 'mint';
      else if (tone === 'warning') iconColor = 'amber';
      else if (tone === 'tip') iconColor = 'purple';
      else iconColor = 'blue';
    }

    const header = h('div', { class: 'iui-card-header' });

    // Left: 20px bare Phosphor icon + title group
    const headerLeft = h('div', { class: 'iui-header-left' });
    const iconBox = h(
      'div',
      { class: 'iui-type-iconbox' },
      lastRenderedSpec ? typeIconEl(lastRenderedSpec.type, 18) : iconEl(meta.icon, 18),
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
    const copyTooltip = h('span', { class: 'iui-tooltip', role: 'tooltip' }, 'Copy data');
    const copyBtn = h(
      'button',
      {
        class: 'iui-tool-btn',
        type: 'button',
        'aria-label': 'Copy data',
        onClick: async (e: Event) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(lastRawText);
            clear(copyBtn);
            copyBtn.appendChild(iconEl('check', 16));
            copyTooltip.textContent = 'Copied';
            copyBtn.appendChild(copyTooltip);
            setTimeout(() => {
              clear(copyBtn);
              copyBtn.appendChild(iconEl('copy', 16));
              copyTooltip.textContent = 'Copy data';
              copyBtn.appendChild(copyTooltip);
            }, 1500);
          } catch {
            // ignore clipboard errors
          }
        },
      },
      iconEl('copy', 16),
      copyTooltip,
    );

    // 2. Export button and dropdown menu
    const exportWrap = h('div', { class: 'iui-export-wrap' });
    const exportMenu = h('div', { class: 'iui-export-menu is-hidden', role: 'menu' });

    function closeExportMenu(): void {
      exportMenu.classList.add('is-hidden');
      exportBtn.setAttribute('aria-expanded', 'false');
      toolbar.classList.remove('is-open');
      document.removeEventListener('click', closeExportMenu);
    }

    function toggleExportMenu(): void {
      const isHidden = exportMenu.classList.contains('is-hidden');
      if (isHidden) {
        clear(exportMenu);
        const spec = getSpec();
        const canSvg = spec ? ['flow', 'mermaid', 'chart'].includes(spec.type) : false;

        const copyItem = h(
          'button',
          {
            class: 'iui-export-item',
            type: 'button',
            role: 'menuitem',
            onClick: async (e: Event) => {
              e.stopPropagation();
              closeExportMenu();
              const cardEl = getCardEl();
              if (cardEl) {
                await exportCard(cardEl, 'copy', {
                  watermark: watermarkEnabled,
                  theme: currentTheme,
                  allStyles: ALL_STYLES,
                  cardType: spec?.type,
                  title: spec?.title,
                });
              }
            },
          },
          iconEl('image', 16, 'iui-export-item-icon'),
          document.createTextNode('Copy as image'),
        );

        const pngItem = h(
          'button',
          {
            class: 'iui-export-item',
            type: 'button',
            role: 'menuitem',
            onClick: async (e: Event) => {
              e.stopPropagation();
              closeExportMenu();
              const cardEl = getCardEl();
              if (cardEl) {
                await exportCard(cardEl, 'png', {
                  watermark: watermarkEnabled,
                  theme: currentTheme,
                  allStyles: ALL_STYLES,
                  cardType: spec?.type,
                  title: spec?.title,
                });
              }
            },
          },
          iconEl('download-simple', 16, 'iui-export-item-icon'),
          document.createTextNode('Download PNG'),
        );

        const jsonItem = h(
          'button',
          {
            class: 'iui-export-item',
            type: 'button',
            role: 'menuitem',
            onClick: async (e: Event) => {
              e.stopPropagation();
              closeExportMenu();
              try {
                await navigator.clipboard.writeText(lastRawText);
                const cardEl = getCardEl();
                if (cardEl) {
                  showCardToast(cardEl, 'JSON copied \u2713');
                }
              } catch {}
            },
          },
          iconEl('code', 16, 'iui-export-item-icon'),
          document.createTextNode('Copy JSON'),
        );

        exportMenu.appendChild(copyItem);
        exportMenu.appendChild(pngItem);
        exportMenu.appendChild(jsonItem);

        if (canSvg) {
          const svgItem = h(
            'button',
            {
              class: 'iui-export-item',
              type: 'button',
              role: 'menuitem',
              onClick: async (e: Event) => {
                e.stopPropagation();
                closeExportMenu();
                const cardEl = getCardEl();
                if (cardEl) {
                  await exportCard(cardEl, 'svg', {
                    watermark: watermarkEnabled,
                    theme: currentTheme,
                    allStyles: ALL_STYLES,
                    cardType: spec?.type,
                    title: spec?.title,
                  });
                }
              },
            },
            iconEl('code', 16, 'iui-export-item-icon'),
            document.createTextNode('Download SVG'),
          );
          exportMenu.appendChild(svgItem);
        }

        exportMenu.classList.remove('is-hidden');
        exportBtn.setAttribute('aria-expanded', 'true');
        toolbar.classList.add('is-open');
        setTimeout(() => {
          document.addEventListener('click', closeExportMenu);
        }, 10);
      } else {
        closeExportMenu();
      }
    }

    const exportTooltip = h('span', { class: 'iui-tooltip', role: 'tooltip' }, 'Export card');
    const exportBtn = h(
      'button',
      {
        class: 'iui-tool-btn',
        type: 'button',
        'aria-label': 'Export card',
        'aria-haspopup': 'menu',
        'aria-expanded': 'false',
        onClick: (e: Event) => {
          e.stopPropagation();
          toggleExportMenu();
        },
      },
      iconEl('export', 16),
      exportTooltip,
    );

    exportWrap.appendChild(exportBtn);
    exportWrap.appendChild(exportMenu);

    // 3. View source button
    const sourceTooltip = h('span', { class: 'iui-tooltip', role: 'tooltip' }, 'View source');
    const sourceBtn = h(
      'button',
      {
        class: 'iui-tool-btn',
        type: 'button',
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
      iconEl('code', 16),
      sourceTooltip,
    );

    toolbar.appendChild(copyBtn);
    toolbar.appendChild(exportWrap);
    toolbar.appendChild(sourceBtn);
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
        host: opts.host,
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

  function createGenericSkeleton(typeHint?: UIType): HTMLElement {
    const card = h('div', {
      class: 'iui-card iui-skeleton-card',
      style:
        'height: 120px; min-height: 120px; max-height: 120px; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; padding: 14px;',
    });

    const header = h('div', {
      class: 'iui-skel-header',
      style: 'display: flex; align-items: center; gap: 8px;',
    });
    const icon = h('div', {
      class: 'iui-skel',
      style: 'width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;',
    });
    const label = h(
      'span',
      {
        class: 'iui-skel-label',
        style: 'font-size: 12px; font-weight: 500; color: var(--iui-muted, #737373);',
      },
      typeHint ? TYPE_META[typeHint]?.label || typeHint : 'UI block',
    );
    header.appendChild(icon);
    header.appendChild(label);
    card.appendChild(header);

    const lines = h('div', { style: 'display: flex; flex-direction: column; gap: 8px;' });
    const line1 = h('div', { class: 'iui-skel iui-skel-line', style: 'width: 85%; height: 14px; margin: 0;' });
    const line2 = h('div', { class: 'iui-skel iui-skel-line', style: 'width: 55%; height: 14px; margin: 0;' });
    lines.appendChild(line1);
    lines.appendChild(line2);
    card.appendChild(lines);

    return card;
  }

  function showSkeleton(typeHint?: UIType): void {
    if (currentState === 'skeleton') {
      const existingCard = root.querySelector<HTMLElement>('.iui-skeleton-card');
      if (existingCard) {
        if (typeHint) {
          const labelEl = existingCard.querySelector<HTMLElement>('.iui-skel-label');
          if (labelEl) {
            labelEl.textContent = TYPE_META[typeHint]?.label || typeHint;
          }
        }
        return;
      }
    }

    runCleanups();
    clear(root);
    const wrapper = h('div', { class: 'iui-rendered-wrap' });
    const skel = createGenericSkeleton(typeHint);
    wrapper.appendChild(skel);
    root.appendChild(wrapper);
    currentState = 'skeleton';
    opts.onStateChange?.('skeleton');
  }

  function showFallback(errorMessage: string, rawText: string): void {
    runCleanups();
    clear(root);

    // Build a collapsed "Show source" toggle instead of dumping raw JSON
    let isExpanded = false;
    const pre = h('pre', { class: 'iui-fallback-pre' }, rawText);
    pre.style.display = 'none';

    const toggleBtn = h(
      'button',
      {
        type: 'button',
        class: 'iui-show-source-btn',
        onClick: () => {
          isExpanded = !isExpanded;
          pre.style.display = isExpanded ? '' : 'none';
          toggleBtn.textContent = isExpanded ? 'Hide source' : 'Show source';
        },
      },
      'Show source',
    );

    const fallback = h(
      'div',
      { class: 'iui-fallback iui-fallback-collapsed' },
      toggleBtn,
      pre,
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
        host: opts.host,
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

      const { header, sourcePanel, sourcePre } = createHeaderToolbar(
        titleText,
        () => lastRenderedSpec,
        () => componentEl,
      );

      // Insert header as first child of component card
      componentEl.insertBefore(header, componentEl.firstChild);
      // Insert source panel just under header
      header.after(sourcePanel);

      const wrapper = h('div', { class: 'iui-rendered-wrap' });
      wrapper.appendChild(componentEl);

      clear(root);
      root.appendChild(wrapper);

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

  let lastRenderTime = 0;
  let renderThrottleTimer: number | null = null;
  let pendingRenderSpec: UISpec | null = null;
  let pendingRenderText = '';

  function scheduleThrottledRender(spec: UISpec, text: string): void {
    const now = Date.now();
    const elapsed = now - lastRenderTime;

    if (elapsed >= 250) {
      if (renderThrottleTimer !== null) {
        window.clearTimeout(renderThrottleTimer);
        renderThrottleTimer = null;
      }
      pendingRenderSpec = null;
      lastRenderTime = now;
      renderSpec(spec, text);
    } else {
      pendingRenderSpec = spec;
      pendingRenderText = text;
      if (renderThrottleTimer === null) {
        renderThrottleTimer = window.setTimeout(() => {
          renderThrottleTimer = null;
          if (pendingRenderSpec) {
            lastRenderTime = Date.now();
            const s = pendingRenderSpec;
            const t = pendingRenderText;
            pendingRenderSpec = null;
            renderSpec(s, t);
          }
        }, 250 - elapsed);
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

  let mountedSynchronously = false;
  if (opts.initialText) {
    lastText = opts.initialText;
    lastRawText = opts.initialText;
    const parseRes = tryParse(opts.initialText);
    if (parseRes.ok && typeof parseRes.value === 'object' && parseRes.value !== null) {
      const valRes = validateSpec(parseRes.value);
      if (valRes.ok) {
        renderSpec(valRes.spec, opts.initialText);
        mountedSynchronously = true;
      }
    }
  }

  if (!mountedSynchronously) {
    showSkeleton();
  }

  function finalize(): void {
    if (finalizeTimer !== null) {
      window.clearTimeout(finalizeTimer);
      finalizeTimer = null;
    }
    if (renderThrottleTimer !== null) {
      window.clearTimeout(renderThrottleTimer);
      renderThrottleTimer = null;
      if (pendingRenderSpec) {
        const s = pendingRenderSpec;
        const t = pendingRenderText;
        pendingRenderSpec = null;
        renderSpec(s, t);
        return;
      }
    }

    let specToRender: UISpec | null = null;
    const parseRes = tryParse(lastRawText);
    if (parseRes.ok && typeof parseRes.value === 'object' && parseRes.value !== null) {
      const valRes = validateSpec(parseRes.value);
      if (valRes.ok) {
        specToRender = valRes.spec;
      }
    }
    if (!specToRender) {
      const partial = parsePartialJson(lastRawText);
      if (partial.ok && partial.value && typeof partial.value === 'object') {
        const valRes = validateSpec(partial.value);
        if (valRes.ok) {
          specToRender = valRes.spec;
        }
      }
    }

    if (!specToRender && parseRes.ok && typeof parseRes.value === 'object' && parseRes.value !== null && !Array.isArray(parseRes.value)) {
      const genObj = parseRes.value as Record<string, unknown>;
      specToRender = {
        type: 'generic',
        title: typeof genObj.title === 'string' ? genObj.title : undefined,
        originalType: typeof genObj.type === 'string' ? genObj.type : undefined,
        data: genObj,
      };
    }

    if (specToRender) {
      renderSpec(specToRender, lastRawText);
      return;
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
    if (currentState === 'rendered') {
      let spec: UISpec | null = null;
      const parseRes = tryParse(text);
      if (parseRes.ok && typeof parseRes.value === 'object' && parseRes.value !== null) {
        const valRes = validateSpec(parseRes.value);
        if (valRes.ok) {
          spec = valRes.spec;
        }
      }
      if (!spec) {
        const partial = parsePartialJson(text);
        if (partial.ok && partial.value && typeof partial.value === 'object') {
          const valRes = validateSpec(partial.value);
          if (valRes.ok) {
            spec = valRes.spec;
          }
        }
      }

      if (spec) {
        const canonical = JSON.stringify(spec);
        if (canonical !== lastRenderedSpecJson) {
          scheduleThrottledRender(spec, text);
        } else {
          const pre = root.querySelector<HTMLElement>('.iui-source-pre');
          if (pre) pre.textContent = text;
        }
      }
      return;
    }

    // While JSON is incomplete, keep the skeleton
    const parseRes = tryParse(text);
    if (parseRes.ok && typeof parseRes.value === 'object' && parseRes.value !== null) {
      const valRes = validateSpec(parseRes.value);
      if (valRes.ok) {
        lastErrorMessage = '';
        renderSpec(valRes.spec, text);
        return;
      } else {
        lastErrorMessage = valRes.error;
      }
    } else {
      lastErrorMessage = 'Parsing JSON';
    }

    const hint = sniffType(text);
    showSkeleton(hint);
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

      processUpdate(text);
    },
    finalize,
    setTheme(t: ThemeMode) {
      currentTheme = t;
      root.setAttribute('data-theme', t);
      const typography = readHostTypography(anchor);
      applyHostTheme(root, opts.host, t, typography);
      if (currentState === 'rendered' && lastRenderedSpec) {
        renderSpec(lastRenderedSpec, lastRawText);
      }
    },
    destroy() {
      if (finalizeTimer !== null) {
        window.clearTimeout(finalizeTimer);
        finalizeTimer = null;
      }
      if (renderThrottleTimer !== null) {
        window.clearTimeout(renderThrottleTimer);
        renderThrottleTimer = null;
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
