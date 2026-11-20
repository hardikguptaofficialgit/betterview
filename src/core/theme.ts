export type ThemeMode = 'light' | 'dark';

export function detectHostTheme(): ThemeMode {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const html = document.documentElement;
  const body = document.body;

  if (
    body?.classList.contains('dark-theme') ||
    html?.hasAttribute('dark') ||
    html?.classList.contains('dark')
  ) {
    return 'dark';
  }

  function parseColor(col: string): { r: number; g: number; b: number } | null {
    if (!col || col === 'transparent') return null;
    const m = col.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/);
    if (!m) return null;
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (a === 0) return null;
    return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]) };
  }

  function getBg(el: HTMLElement | null): string {
    if (!el || typeof window === 'undefined' || !window.getComputedStyle) return '';
    return window.getComputedStyle(el).backgroundColor || '';
  }

  const bodyBg = parseColor(getBg(body));
  const htmlBg = bodyBg ? null : parseColor(getBg(html));
  const chosen = bodyBg || htmlBg;

  if (chosen) {
    const lum = (0.2126 * chosen.r + 0.7152 * chosen.g + 0.0722 * chosen.b) / 255;
    return lum < 0.5 ? 'dark' : 'light';
  }

  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

export function watchHostTheme(cb: (t: ThemeMode) => void): () => void {
  let current = detectHostTheme();

  const check = () => {
    const next = detectHostTheme();
    if (next !== current) {
      current = next;
      cb(next);
    }
  };

  const observer =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver(check)
      : null;

  const obsOpts: MutationObserverInit = {
    attributes: true,
    attributeFilter: ['class', 'style', 'dark'],
  };

  if (observer && typeof document !== 'undefined') {
    if (document.documentElement) {
      observer.observe(document.documentElement, obsOpts);
    }
    if (document.body) {
      observer.observe(document.body, obsOpts);
    }
  }

  const media =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  if (media) {
    media.addEventListener('change', check);
  }

  return () => {
    if (observer) {
      observer.disconnect();
    }
    if (media) {
      media.removeEventListener('change', check);
    }
  };
}
