export type ThemeMode = 'light' | 'dark';

export function detectHostTheme(): ThemeMode {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const html = document.documentElement;
  const body = document.body;

  // The body is closest to the active chat surface. Some hosts keep a
  // document-level theme attribute for their shell while the chat itself
  // switches independently.
  const bodyTheme = body?.getAttribute('data-theme') || body?.getAttribute('data-color-scheme');
  if (bodyTheme === 'dark' || bodyTheme === 'light') return bodyTheme;

  if (
    body?.classList.contains('dark-theme') ||
    body?.classList.contains('dark') ||
    html?.hasAttribute('dark') ||
    html?.classList.contains('dark') ||
    html?.classList.contains('dark-theme')
  ) {
    return 'dark';
  }

  if (body?.classList.contains('light') || html?.classList.contains('light')) return 'light';

  const documentTheme = html?.getAttribute('data-theme') || html?.getAttribute('data-color-scheme');
  if (documentTheme === 'dark' || documentTheme === 'light') return documentTheme;

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

  const themeSurfaces = [
    document.querySelector('main'),
    document.querySelector('[role="main"]'),
    document.querySelector('app-root'),
    body,
    html,
  ].filter((el): el is HTMLElement => el instanceof HTMLElement);
  let chosen: { r: number; g: number; b: number } | null = null;
  for (const surface of themeSurfaces) {
    const style = window.getComputedStyle?.(surface);
    const candidate = parseColor(style?.backgroundColor || '');
    if (candidate) {
      chosen = candidate;
      break;
    }
    const colorScheme = (style?.colorScheme || '').trim().split(/\s+/);
    if (colorScheme.includes('dark') && !colorScheme.includes('light')) return 'dark';
    if (colorScheme.includes('light') && !colorScheme.includes('dark')) return 'light';
  }

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
    attributeFilter: ['class', 'style', 'dark', 'data-theme', 'data-color-scheme'],
  };

  if (observer && typeof document !== 'undefined') {
    if (document.documentElement) {
      observer.observe(document.documentElement, { ...obsOpts, subtree: true });
    }
    if (document.body) {
      observer.observe(document.body, obsOpts);
    }
    const appSurface = document.querySelector('main, [role="main"], app-root');
    if (appSurface && appSurface !== document.body && appSurface !== document.documentElement) {
      observer.observe(appSurface, obsOpts);
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
