import { SiteAdapter, isUiBlock } from './sites';
import { ThemeMode } from '../core/theme';
import { mountBlock, BlockHandle } from '../core/mount';

interface TrackedItem {
  handle: BlockHandle;
  wrapper: HTMLElement;
  lastText: string;
  noteHost?: HTMLElement;
  finalizeTimer?: number;
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
  const trackedPres = new Set<HTMLElement>();

  let debounceTimer: number | null = null;
  let rafId: number | null = null;
  let scanPending = false;
  let isStopped = false;

  function restoreFallbackWrapper(pre: HTMLElement, item: TrackedItem): void {
    item.wrapper.style.display = '';
    item.wrapper.removeAttribute('data-iui-hidden');
    item.handle.destroy();
    liveHandles.delete(item.handle);

    if (!item.noteHost && item.wrapper.parentNode) {
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
      item.wrapper.parentNode.insertBefore(noteHost, item.wrapper);
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
    for (const pre of Array.from(trackedPres)) {
      if (!document.contains(pre)) {
        const item = tracked.get(pre);
        if (item) {
          if (item.finalizeTimer !== undefined) {
            window.clearTimeout(item.finalizeTimer);
          }
          item.handle.destroy();
          item.noteHost?.remove();
          liveHandles.delete(item.handle);
        }
        tracked.delete(pre);
        trackedPres.delete(pre);
      }
    }

    // Find candidate code blocks
    const pres = adapter.findCodeBlocks(currentRoot);
    for (const pre of pres) {
      if (pre.closest('.iui-host') || pre.closest('[data-iui]')) {
        continue;
      }
      if (!isUiBlock(adapter, pre)) {
        continue;
      }

      const text = pre.textContent ?? '';

      if (tracked.has(pre)) {
        const item = tracked.get(pre)!;
        if (text !== item.lastText) {
          item.lastText = text;
          item.handle.update(text);

          if (item.finalizeTimer !== undefined) {
            window.clearTimeout(item.finalizeTimer);
          }
          item.finalizeTimer = window.setTimeout(() => {
            if (item.handle.state === 'fallback') {
              restoreFallbackWrapper(pre, item);
            }
          }, 1600);
        }
      } else {
        const wrapper = adapter.wrapperOf(pre);
        let item: TrackedItem;

        const handle = mountBlock(wrapper, {
          theme: getTheme(),
          insert: 'after',
          onStateChange: (state) => {
            if (state === 'fallback' && !isStopped) {
              restoreFallbackWrapper(pre, item);
            }
          },
        });

        wrapper.style.display = 'none';
        wrapper.setAttribute('data-iui-hidden', '1');

        item = {
          handle,
          wrapper,
          lastText: text,
        };

        item.finalizeTimer = window.setTimeout(() => {
          if (handle.state === 'fallback') {
            restoreFallbackWrapper(pre, item);
          }
        }, 1600);

        tracked.set(pre, item);
        liveHandles.add(handle);
        trackedPres.add(pre);

        handle.update(text);
      }
    }
  }

  function scheduleScan(): void {
    if (isStopped) return;
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      if (!scanPending) {
        scanPending = true;
        rafId = window.requestAnimationFrame(() => {
          scanPending = false;
          rafId = null;
          scan();
        });
      }
    }, 150);
  }

  const observer =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => {
          scheduleScan();
        })
      : null;

  if (observer && currentRoot) {
    observer.observe(currentRoot, { childList: true, subtree: true, characterData: true });
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
      for (const pre of Array.from(trackedPres)) {
        const item = tracked.get(pre);
        if (item) {
          if (item.finalizeTimer !== undefined) {
            window.clearTimeout(item.finalizeTimer);
          }
          item.wrapper.style.display = '';
          item.wrapper.removeAttribute('data-iui-hidden');
          item.noteHost?.remove();
        }
      }
      trackedPres.clear();

      if (observer) {
        observer.disconnect();
      }
      currentRoot = rootOverride ?? adapter.chatRoot();
      if (observer && currentRoot) {
        observer.observe(currentRoot, { childList: true, subtree: true, characterData: true });
        scan();
      }
    }
  }, 500);

  return {
    stop(): void {
      isStopped = true;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
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
      for (const pre of Array.from(trackedPres)) {
        const item = tracked.get(pre);
        if (item) {
          if (item.finalizeTimer !== undefined) {
            window.clearTimeout(item.finalizeTimer);
          }
          item.wrapper.style.display = '';
          item.wrapper.removeAttribute('data-iui-hidden');
          item.noteHost?.remove();
        }
      }
      trackedPres.clear();
    },
    rescan(): void {
      scan();
    },
    setTheme(t: ThemeMode): void {
      for (const h of liveHandles) {
        h.setTheme(t);
      }
      for (const pre of Array.from(trackedPres)) {
        const item = tracked.get(pre);
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
