import { ThemeMode } from './theme';

export interface Tokens {
  bg: string;
  surface: string;
  'surface-2': string;
  surface2?: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
  accent: string;
  'accent-bg': string;
  accentBg?: string;
  'radius-card': string;
  radiusCard?: string;
  'radius-inner': string;
  radiusInner?: string;
  font: string;
  mono: string;
  [key: string]: string | undefined;
}

export interface HostTypography {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  color?: string;
  backgroundColor?: string;
}

function createTokens(raw: {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
  accent: string;
  accentBg: string;
  radiusCard: string;
  radiusInner: string;
  font: string;
  mono: string;
}): Tokens {
  return {
    bg: raw.bg,
    '--iui-bg': raw.bg,
    surface: raw.surface,
    '--iui-surface': raw.surface,
    'surface-2': raw.surface2,
    surface2: raw.surface2,
    '--iui-surface-2': raw.surface2,
    border: raw.border,
    '--iui-border': raw.border,
    text: raw.text,
    '--iui-text': raw.text,
    muted: raw.muted,
    '--iui-muted': raw.muted,
    subtle: raw.subtle,
    '--iui-subtle': raw.subtle,
    accent: raw.accent,
    '--iui-accent': raw.accent,
    'accent-bg': raw.accentBg,
    accentBg: raw.accentBg,
    '--iui-accent-bg': raw.accentBg,
    'radius-card': raw.radiusCard,
    radiusCard: raw.radiusCard,
    '--iui-radius-card': raw.radiusCard,
    'radius-inner': raw.radiusInner,
    radiusInner: raw.radiusInner,
    '--iui-radius-inner': raw.radiusInner,
    font: raw.font,
    '--iui-font': raw.font,
    mono: raw.mono,
    '--iui-mono': raw.mono,
  };
}

export const HOST_THEMES: Record<'gemini' | 'grok', { light: Tokens; dark: Tokens }> = {
  gemini: {
    light: createTokens({
      bg: '#FFFFFF',
      surface: '#F0F4F9',
      surface2: '#E9EEF6',
      border: '#E1E3E1',
      text: '#1F1F1F',
      muted: '#444746',
      subtle: '#747775',
      accent: '#0B57D0',
      accentBg: '#D3E3FD',
      radiusCard: '16px',
      radiusInner: '12px',
      font: '"Google Sans Text", "Google Sans", Roboto, Arial, sans-serif',
      mono: '"Google Sans Mono", "Roboto Mono", ui-monospace, monospace',
    }),
    dark: createTokens({
      bg: '#131314',
      surface: '#1E1F20',
      surface2: '#282A2C',
      border: '#3C4043',
      text: '#E3E3E3',
      muted: '#C4C7C5',
      subtle: '#8E918F',
      accent: '#A8C7FA',
      accentBg: 'rgba(8,66,160,.4)',
      radiusCard: '16px',
      radiusInner: '12px',
      font: '"Google Sans Text", "Google Sans", Roboto, Arial, sans-serif',
      mono: '"Google Sans Mono", "Roboto Mono", ui-monospace, monospace',
    }),
  },
  grok: {
    light: createTokens({
      bg: '#FFFFFF',
      surface: '#FAFAFA',
      surface2: '#F2F2F2',
      border: 'rgba(0,0,0,.08)',
      text: '#0D0D0D',
      muted: '#6B6B6B',
      subtle: '#9A9A9A',
      accent: '#0D0D0D',
      accentBg: '#F2F2F2',
      radiusCard: '12px',
      radiusInner: '8px',
      font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    }),
    dark: createTokens({
      bg: '#141414',
      surface: '#1C1C1C',
      surface2: '#242424',
      border: 'rgba(255,255,255,.08)',
      text: '#F5F5F5',
      muted: '#A3A3A3',
      subtle: '#737373',
      accent: '#F5F5F5',
      accentBg: '#262626',
      radiusCard: '12px',
      radiusInner: '8px',
      font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    }),
  },
};

export const DEFAULT_THEME: { light: Tokens; dark: Tokens } = {
  light: createTokens({
    bg: '#FFFFFF',
    surface: '#FAFAFA',
    surface2: '#F4F4F5',
    border: 'rgba(0, 0, 0, 0.08)',
    text: '#0A0A0A',
    muted: '#6B6B6B',
    subtle: '#A3A3A3',
    accent: '#0A0A0A',
    accentBg: '#F4F4F5',
    radiusCard: '18px',
    radiusInner: '12px',
    font: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  }),
  dark: createTokens({
    bg: '#0f0f10',
    surface: '#18181A',
    surface2: '#222225',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#FAFAFA',
    muted: '#A3A3A3',
    subtle: '#71717A',
    accent: '#FAFAFA',
    accentBg: '#27272A',
    radiusCard: '18px',
    radiusInner: '12px',
    font: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  }),
};

export function selectHostTheme(host: string | undefined, mode: ThemeMode): Tokens {
  if (host === 'gemini' || host === 'grok') {
    return HOST_THEMES[host][mode];
  }
  return DEFAULT_THEME[mode];
}

export function readHostTypography(anchor?: Element | null): HostTypography {
  try {
    if (!anchor || typeof window === 'undefined' || !window.getComputedStyle) {
      return {};
    }
    const proseSelector =
      'message-content, .message-content, .markdown, .response-content-markdown, [class*="markdown"], .prose';
    let el: Element | null = null;
    if (typeof anchor.closest === 'function') {
      el = anchor.closest(proseSelector);
    }
    if (!el) {
      el = anchor.parentElement || anchor;
    }
    if (!el) return {};

    const style = window.getComputedStyle(el);
    if (!style) return {};

    const clean = (val: string | undefined | null) => {
      if (!val) return undefined;
      const trimmed = val.trim();
      if (!trimmed || trimmed === 'inherit' || trimmed === 'initial' || trimmed === 'unset') {
        return undefined;
      }
      return trimmed;
    };

    let bgEl: Element | null = el;
    let bgColor: string | undefined = undefined;
    while (bgEl && bgEl !== document.documentElement) {
      const bgStyle = window.getComputedStyle(bgEl);
      const bgVal = clean(bgStyle?.backgroundColor);
      if (bgVal && bgVal !== 'transparent' && bgVal !== 'rgba(0, 0, 0, 0)') {
        bgColor = bgVal;
        break;
      }
      bgEl = bgEl.parentElement;
    }

    return {
      fontFamily: clean(style.fontFamily),
      fontSize: clean(style.fontSize),
      lineHeight: clean(style.lineHeight),
      color: clean(style.color),
      backgroundColor: bgColor,
    };
  } catch {
    return {};
  }
}

function parseColorToRgb(col: string): { r: number; g: number; b: number } | null {
  if (!col) return null;
  col = col.trim().toLowerCase();
  if (col === 'transparent') return null;
  if (col === 'white') return { r: 255, g: 255, b: 255 };
  if (col === 'black') return { r: 0, g: 0, b: 0 };

  if (col.startsWith('#')) {
    const hex = col.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  const m = col.match(
    /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/,
  );
  if (m) {
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (a === 0) return null;
    return {
      r: Math.round(parseFloat(m[1])),
      g: Math.round(parseFloat(m[2])),
      b: Math.round(parseFloat(m[3])),
    };
  }

  return null;
}

function getLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(col1: string, col2: string): number {
  const rgb1 = parseColorToRgb(col1);
  const rgb2 = parseColorToRgb(col2);
  if (!rgb1 || !rgb2) return 1;
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function applyHostTheme(
  root: HTMLElement,
  host: string | undefined,
  mode: ThemeMode,
  typography?: HostTypography,
): void {
  const tokens = selectHostTheme(host, mode);

  // Background color from host if available
  const currentBg = (typography?.backgroundColor && parseColorToRgb(typography.backgroundColor))
    ? typography.backgroundColor
    : tokens.bg;
  root.style.setProperty('--iui-bg', currentBg);
  root.style.setProperty('--iui-surface', tokens.surface);
  root.style.setProperty('--iui-surface-2', tokens['surface-2']);
  root.style.setProperty('--iui-border', tokens.border);
  root.style.setProperty('--iui-muted', tokens.muted);
  root.style.setProperty('--iui-subtle', tokens.subtle);
  root.style.setProperty('--iui-accent', tokens.accent);
  root.style.setProperty('--iui-accent-bg', tokens['accent-bg']);
  root.style.setProperty('--iui-radius-card', tokens['radius-card']);
  root.style.setProperty('--iui-radius-inner', tokens['radius-inner']);
  root.style.setProperty('--iui-mono', tokens.mono);

  // Typography
  const font =
    typography?.fontFamily &&
    typography.fontFamily !== 'inherit' &&
    typography.fontFamily !== 'initial'
      ? typography.fontFamily
      : tokens.font;
  root.style.setProperty('--iui-font', font);

  if (typography?.fontSize && typography.fontSize !== 'inherit') {
    root.style.setProperty('--iui-fs', typography.fontSize);
  } else {
    root.style.setProperty('--iui-fs', host === 'gemini' ? '15px' : '13.5px');
  }

  if (typography?.lineHeight && typography.lineHeight !== 'inherit') {
    root.style.setProperty('--iui-lh', typography.lineHeight);
  } else {
    root.style.setProperty('--iui-lh', '1.55');
  }

  // Text color: only when computed color has enough contrast with --iui-bg
  let textColor = tokens.text;
  if (typography?.color) {
    const ratio = getContrastRatio(typography.color, currentBg);
    if (ratio >= 3.0) {
      textColor = typography.color;
    }
  }
  root.style.setProperty('--iui-text', textColor);
}
