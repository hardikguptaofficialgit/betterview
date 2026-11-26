import { SiteAdapter, isUiBlock, getBlockCodeText, isCodeOnlyWrapper, extractMermaidSource, mermaidSourceToUiPayload } from './sites';
import { ThemeMode } from '../core/theme';
import { mountBlock, BlockHandle } from '../core/mount';
import { tryParse } from '../core/parse';
import { validateSpec } from '../core/validate';

interface TrackedItem {
  handle: BlockHandle;
  target: HTMLElement;
  lastText: string;
  noteHost?: HTMLElement;
  finalizeTimer?: number;
}

const renderedTextsCache = new Map<string, true>();

function markRenderedText(text: string): void {
  renderedTextsCache.set(text, true);
  if (renderedTextsCache.size > 200) {
    const oldest = renderedTextsCache.keys().next().value;
    if (oldest !== undefined) {
      renderedTextsCache.delete(oldest);
    }
  }
}

export function startScanner(
  adapter: SiteAdapter,
  getTheme: () => ThemeMode,
  rootOverride?: Element,
): {
  stop(): void;
  rescan(): void;
  setTheme(t: ThemeMode): void;
} {
  let currentRoot: Element | null = rootOverride ?? adapter.chatRoot();
  const tracked = new WeakMap<HTMLElement, TrackedItem>();
  const liveHandles = new Set<BlockHandle>();
  const trackedBlocks = new Set<HTMLElement>();

  let throttleTimer: number | null = null;
  let rafId: number | null = null;
  let lastScanTime = 0;
  let hasTrailing = false;
  let isStopped = false;

  function restoreFallbackWrapper(block: HTMLElement, item: TrackedItem, showNote = true): void {
    if (item.finalizeTimer !== undefined) {
      window.clearTimeout(item.finalizeTimer);
      item.finalizeTimer = undefined;
    }
    item.target.style.display = '';
    item.target.removeAttribute('data-iui-hidden');
    item.target.removeAttribute('data-betterview-handled');
    block.removeAttribute('data-betterview-handled');
    item.handle.destroy();
    liveHandles.delete(item.handle);

    // If the JSON never parses, leave Gemini's block visible as-is (no "Couldn't render").
    // Only show fallback note if explicitly marked as language ui or if showNote is true
    const lang = adapter.languageOf(block);
    const shouldShow = showNote && (lang === 'ui' || showNote);
    if (shouldShow && !item.noteHost && item.target.parentNode) {
      const noteHost = document.createElement('div');
      noteHost.className = 'iui-host';
      noteHost.setAttribute('data-iui', '1');
      const sr = noteHost.attachShadow({ mode: 'open' });
      const root = document.createElement('div');
      root.className = 'iui-root';
      root.setAttribute('data-theme', getTheme());
      const note = document.createElement('div');
      note.className = 'iui-fallback-note';
      note.style.fontSize = '12.5px';
      note.style.color = 'var(--iui-muted, #6B6B6B)';
      note.style.margin = '8px 0';
      note.textContent = "Couldn't render this UI block";
      root.appendChild(note);
      sr.appendChild(root);
      item.target.parentNode.insertBefore(noteHost, item.target);
      item.noteHost = noteHost;
    }
  }

  function scan(): void {
    if (isStopped) return;
    if (!currentRoot) {
      currentRoot = rootOverride ?? adapter.chatRoot();
      if (!currentRoot) return;
    }

    // Detached check
    for (const block of Array.from(trackedBlocks)) {
      if (!document.contains(block)) {
        const item = tracked.get(block);
        if (item) {
          if (item.finalizeTimer !== undefined) {
            window.clearTimeout(item.finalizeTimer);
          }
          item.handle.destroy();
          item.noteHost?.remove();
          liveHandles.delete(item.handle);
        }
        tracked.delete(block);
        trackedBlocks.delete(block);
      }
    }

    // Find candidate code blocks
    const blocks = adapter.findCodeBlocks(currentRoot);
    for (const block of blocks) {
      if (block.closest('.iui-host') || block.closest('[data-iui]')) {
        continue;
      }

      if (tracked.has(block)) {
        const item = tracked.get(block)!;
        const text = getBlockCodeText(adapter, block);
        if (text !== item.lastText) {
          item.lastText = text;
          const mermaidSource = extractMermaidSource(text, adapter.languageOf(block));
          item.handle.update(mermaidSource ? mermaidSourceToUiPayload(mermaidSource) : text);

          if (item.finalizeTimer !== undefined) {
            window.clearTimeout(item.finalizeTimer);
          }
          item.finalizeTimer = window.setTimeout(() => {
            if (item.handle.state === 'fallback') {
              const lang = adapter.languageOf(block);
              restoreFallbackWrapper(block, item, lang === 'ui');
            }
          }, 1600);
        }
        continue;
      }

      const wrapper = adapter.wrapperOf(block);
      if (
        block.getAttribute('data-betterview-handled') === '1' ||
        wrapper.getAttribute('data-betterview-handled') === '1'
      ) {
        continue;
      }

      if (!isUiBlock(adapter, block)) {
        continue;
      }

      const text = getBlockCodeText(adapter, block);
      const mermaidSource = extractMermaidSource(text, adapter.languageOf(block));
      const mountText = mermaidSource ? mermaidSourceToUiPayload(mermaidSource) : text;
      const target = isCodeOnlyWrapper(wrapper, block) ? wrapper : block;

      let initialText: string | undefined = undefined;
      if (renderedTextsCache.has(text)) {
        initialText = mountText;
      } else {
        const parseRes = tryParse(mountText);
        if (parseRes.ok && typeof parseRes.value === 'object' && parseRes.value !== null) {
          if (validateSpec(parseRes.value).ok) {
            initialText = mountText;
          }
        }
      }

      let item: TrackedItem | null = null;
      let pendingFallback = false;

      const handle = mountBlock(target, {
        theme: getTheme(),
        host: adapter.id,
        insert: 'before',
        initialText,
        onStateChange: (state) => {
          if (state === 'fallback' && !isStopped) {
            if (item) {
              restoreFallbackWrapper(block, item);
            } else {
              pendingFallback = true;
            }
          } else if (state === 'rendered') {
            if (item) markRenderedText(item.lastText);
            // Remove any leftover fallback note when successfully rendered
            if (item?.noteHost) {
              item.noteHost.remove();
              item.noteHost = undefined;
            }
          }
        },
      });

      if (handle.state === 'rendered') {
        markRenderedText(text);
      }

      target.style.display = 'none';
      target.setAttribute('data-iui-hidden', '1');
      target.setAttribute('data-betterview-handled', '1');
      block.setAttribute('data-betterview-handled', '1');

      const trackedItem: TrackedItem = {
        handle,
        target,
        lastText: text,
      };
      item = trackedItem;

      trackedItem.finalizeTimer = window.setTimeout(() => {
        if (handle.state === 'fallback') {
          const lang = adapter.languageOf(block);
          restoreFallbackWrapper(block, trackedItem, lang === 'ui');
        }
      }, 1600);

      tracked.set(block, trackedItem);
      liveHandles.add(handle);
      trackedBlocks.add(block);

      if (pendingFallback) {
        restoreFallbackWrapper(block, trackedItem);
      }

      if (!initialText) {
        handle.update(mountText);
      }
    }
  }

  function scheduleRafScan(): void {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      lastScanTime = Date.now();
      scan();
      if (currentRoot) observeOpenShadowRoots(currentRoot);
    });
  }

  function triggerThrottledScan(): void {
    if (isStopped) return;
    const now = Date.now();
    const elapsed = now - lastScanTime;
    const remaining = 120 - elapsed;

    if (remaining <= 0) {
      if (throttleTimer !== null) {
        window.clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      hasTrailing = false;
      scheduleRafScan();
    } else {
      hasTrailing = true;
      if (throttleTimer === null) {
        throttleTimer = window.setTimeout(() => {
          throttleTimer = null;
          if (hasTrailing && !isStopped) {
            hasTrailing = false;
            scheduleRafScan();
          }
        }, remaining);
      }
    }
  }

  const observer =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver((mutations) => {
          const isAllOurDom = mutations.every((m) => {
            const el = m.target instanceof Element ? m.target : m.target.parentElement;
            return el && (el.closest('.iui-host') || el.closest('[data-iui]'));
          });
          if (isAllOurDom) return;
          triggerThrottledScan();
        })
      : null;

  // MutationObserver does not cross shadow DOM boundaries. Gemini's response
  // renderer uses open shadow roots, so attach observers to each discovered root.
  const observedShadowRoots = new Set<ShadowRoot>();
  function observeOpenShadowRoots(scope: ParentNode): void {
    if (!observer) return;
    const visit = (parent: ParentNode): void => {
      parent.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.shadowRoot && !observedShadowRoots.has(el.shadowRoot)) {
          observedShadowRoots.add(el.shadowRoot);
          observer.observe(el.shadowRoot, { childList: true, subtree: true, characterData: true });
          visit(el.shadowRoot);
        }
      });
    };
    visit(scope);
  }

  if (observer && currentRoot) {
    observer.observe(currentRoot, { childList: true, subtree: true, characterData: true });
    observeOpenShadowRoots(currentRoot);
  }

  // Initial scan
  scan();

  // SPA navigation check
  let lastHref = typeof window !== 'undefined' ? window.location.href : '';
  const spaInterval = window.setInterval(() => {
    if (typeof window === 'undefined') return;
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      for (const h of liveHandles) {
        try {
          h.destroy();
        } catch {}
      }
      liveHandles.clear();
      for (const block of Array.from(trackedBlocks)) {
        const item = tracked.get(block);
        if (item) {
          if (item.finalizeTimer !== undefined) {
            window.clearTimeout(item.finalizeTimer);
          }
          item.target.style.display = '';
          item.target.removeAttribute('data-iui-hidden');
          item.target.removeAttribute('data-betterview-handled');
          block.removeAttribute('data-betterview-handled');
          item.noteHost?.remove();
        }
      }
      trackedBlocks.clear();

      if (observer) {
        observer.disconnect();
        observedShadowRoots.clear();
      }
      currentRoot = rootOverride ?? adapter.chatRoot();
      if (observer && currentRoot) {
        observer.observe(currentRoot, { childList: true, subtree: true, characterData: true });
        observeOpenShadowRoots(currentRoot);
        scan();
      }
    }
  }, 500);

  return {
    stop(): void {
      isStopped = true;
      if (throttleTimer !== null) {
        window.clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      hasTrailing = false;
      window.clearInterval(spaInterval);
      if (observer) {
        observer.disconnect();
      }
      for (const h of liveHandles) {
        try {
          h.destroy();
        } catch {}
      }
      liveHandles.clear();
      for (const block of Array.from(trackedBlocks)) {
        const item = tracked.get(block);
        if (item) {
          if (item.finalizeTimer !== undefined) {
            window.clearTimeout(item.finalizeTimer);
          }
          item.target.style.display = '';
          item.target.removeAttribute('data-iui-hidden');
          item.target.removeAttribute('data-betterview-handled');
          block.removeAttribute('data-betterview-handled');
          item.noteHost?.remove();
        }
      }
      trackedBlocks.clear();
    },
    rescan(): void {
      scan();
    },
    setTheme(t: ThemeMode): void {
      for (const h of liveHandles) {
        h.setTheme(t);
      }
      for (const block of Array.from(trackedBlocks)) {
        const item = tracked.get(block);
        if (item?.noteHost?.shadowRoot) {
          const root = item.noteHost.shadowRoot.querySelector('.iui-root');
          if (root) {
            root.setAttribute('data-theme', t);
          }
        }
      }
    },
  };
}
