// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  HOST_THEMES,
  DEFAULT_THEME,
  selectHostTheme,
  readHostTypography,
  applyHostTheme,
} from '../src/core/hostTheme';
import { mountBlock } from '../src/core/mount';
import { detectHostTheme } from '../src/core/theme';

describe('hostTheme', () => {
  it('detects explicit host theme attributes before falling back to system preference', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(detectHostTheme()).toBe('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    expect(detectHostTheme()).toBe('light');
    document.documentElement.removeAttribute('data-theme');
  });
  it('prefers the active body theme over a stale document shell theme', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.classList.add('dark');
    expect(detectHostTheme()).toBe('dark');
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('dark');
  });
  it("selectHostTheme('gemini','light').radius-card === '16px' and font includes 'Google Sans'; ('grok','dark').bg === '#141414'; unknown host returns default theme", () => {
    const geminiLight = selectHostTheme('gemini', 'light');
    expect(geminiLight['radius-card']).toBe('16px');
    expect(geminiLight.font).toContain('Google Sans');

    const grokDark = selectHostTheme('grok', 'dark');
    expect(grokDark.bg).toBe('#141414');

    const unknownLight = selectHostTheme('unknown' as any, 'light');
    expect(unknownLight).toBeDefined();
    expect(unknownLight.bg).toBe(DEFAULT_THEME.light.bg);
    expect(unknownLight['radius-card']).toBe(DEFAULT_THEME.light['radius-card']);

    const undefDark = selectHostTheme(undefined, 'dark');
    expect(undefDark).toBeDefined();
    expect(undefDark.bg).toBe(DEFAULT_THEME.dark.bg);
    expect(undefDark['radius-card']).toBe(DEFAULT_THEME.dark['radius-card']);
  });

  it('applyHostTheme sets --iui-font from typography when provided and falls back otherwise; low-contrast computed color is ignored', () => {
    const root = document.createElement('div');

    // 1. Sets --iui-font from typography when provided
    applyHostTheme(root, 'gemini', 'light', { fontFamily: 'CustomProseFont, sans-serif' });
    expect(root.style.getPropertyValue('--iui-font')).toBe('CustomProseFont, sans-serif');

    // 2. Falls back to palette font otherwise
    applyHostTheme(root, 'gemini', 'light', {});
    expect(root.style.getPropertyValue('--iui-font')).toContain('Google Sans');

    // 3. Low-contrast computed color is ignored (e.g. white text on light bg #FFFFFF)
    applyHostTheme(root, 'gemini', 'light', { color: 'rgb(255, 255, 255)' });
    expect(root.style.getPropertyValue('--iui-text')).toBe('#1F1F1F');

    // 4. High-contrast computed color is applied
    applyHostTheme(root, 'gemini', 'light', { color: 'rgb(10, 10, 10)' });
    expect(root.style.getPropertyValue('--iui-text')).toBe('rgb(10, 10, 10)');
  });

  it('rejects host text colors that contrast with the page but disappear on Gemini cards', () => {
    const root = document.createElement('div');
    applyHostTheme(root, 'gemini', 'light', {
      color: 'rgb(227, 227, 227)',
      backgroundColor: 'rgb(19, 19, 20)',
    });
    expect(root.style.getPropertyValue('--iui-text')).toBe('#1F1F1F');
  });

  it("mountBlock with opts.host='gemini' puts data-host=\"gemini\" on .iui-root; setTheme('dark') updates tokens", () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const target = document.createElement('div');
    container.appendChild(target);

    const handle = mountBlock(target, {
      theme: 'light',
      host: 'gemini',
    });

    const host = container.querySelector('.iui-host');
    expect(host).not.toBeNull();
    const shadow = host?.shadowRoot;
    expect(shadow).not.toBeNull();

    const root = shadow?.querySelector('.iui-root') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute('data-host')).toBe('gemini');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.style.getPropertyValue('--iui-bg')).toBe('#FFFFFF');
    expect(root.style.getPropertyValue('--iui-radius-card')).toBe('16px');

    // Call setTheme('dark') and verify tokens update
    handle.setTheme('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.style.getPropertyValue('--iui-bg')).toBe('#131314');
    expect(root.style.getPropertyValue('--iui-surface')).toBe('#1E1F20');
    expect(root.style.getPropertyValue('--iui-text')).toBe('#E3E3E3');

    handle.destroy();
    container.remove();
  });

  it('readHostTypography never throws on a detached element', () => {
    const detached = document.createElement('div');
    expect(() => {
      const typo = readHostTypography(detached);
      expect(typeof typo).toBe('object');
    }).not.toThrow();

    expect(() => {
      const typoNull = readHostTypography(null as any);
      expect(typeof typoNull).toBe('object');
    }).not.toThrow();

    expect(() => {
      const typoUndef = readHostTypography(undefined as any);
      expect(typeof typoUndef).toBe('object');
    }).not.toThrow();
  });

  it('readHostTypography extracts typography from closest prose container', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'markdown prose';
    wrapper.style.fontFamily = 'HostFont, sans-serif';
    wrapper.style.fontSize = '15px';
    wrapper.style.lineHeight = '24px';
    wrapper.style.color = 'rgb(30, 30, 30)';

    const anchor = document.createElement('div');
    wrapper.appendChild(anchor);
    document.body.appendChild(wrapper);

    const typo = readHostTypography(anchor);
    expect(typo.fontFamily).toBe('HostFont, sans-serif');
    expect(typo.fontSize).toBe('15px');
    expect(typo.lineHeight).toBe('24px');
    expect(typo.color).toBe('rgb(30, 30, 30)');

    wrapper.remove();
  });
});
