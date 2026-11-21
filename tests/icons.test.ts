// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { iconEl, isAllowedIcon, normalizeIconName, typeIconEl } from '../src/core/icons';

describe('Lucide icon system', () => {
  it('renders consistent outline SVGs using currentColor', () => {
    const icon = iconEl('arrow-up-right', 20, 'test-icon');
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon.getAttribute('width')).toBe('20');
    expect(icon.getAttribute('height')).toBe('20');
    expect(icon.getAttribute('stroke')).toBe('currentColor');
    expect(icon.getAttribute('stroke-width')).toBe('1.8');
    expect(icon.getAttribute('stroke-linecap')).toBe('round');
    expect(icon.getAttribute('stroke-linejoin')).toBe('round');
    expect(icon.getAttribute('class')).toBe('test-icon');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses semantic Lucide icons for visual card types', () => {
    const icon = typeIconEl('flow', 18);
    expect(icon.getAttribute('stroke')).toBe('currentColor');
    expect(icon.querySelector('path, circle, rect, line, polyline, polygon')).not.toBeNull();
  });

  it('normalizes names and keeps model icon validation compatible', () => {
    expect(normalizeIconName('ArrowUpRight')).toBe('arrow-up-right');
    expect(isAllowedIcon('arrow-up-right')).toBe(true);
    expect(isAllowedIcon('chart-line')).toBe(true);
    expect(isAllowedIcon('made-up-icon')).toBe(false);
  });
});
