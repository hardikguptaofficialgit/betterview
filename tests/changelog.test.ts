// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { CHANGELOG, renderChangelog, ChangelogItem } from '../src/welcome/changelog';

describe('Changelog module', () => {
  it('contains valid v0.1.0 changelog entry', () => {
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(1);
    const first = CHANGELOG[0];
    expect(first.version).toBe('v0.1.0');
    expect(first.tagline).toContain('First release');
    expect(first.tagline).toContain('7 visual components');
    expect(first.highlights.length).toBeGreaterThanOrEqual(5);
  });

  it('renders changelog timeline into DOM without innerHTML', () => {
    const el = renderChangelog(CHANGELOG);
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.className).toBe('changelog-timeline');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe("What's new changelog");

    const items = el.querySelectorAll('.changelog-item');
    expect(items.length).toBe(CHANGELOG.length);

    const firstItem = items[0];
    const versionPill = firstItem.querySelector('.version-pill');
    expect(versionPill?.textContent).toBe('v0.1.0');

    const tagline = firstItem.querySelector('.changelog-tagline');
    expect(tagline?.textContent).toContain('First release');

    const highlights = firstItem.querySelectorAll('.changelog-highlight');
    expect(highlights.length).toBe(CHANGELOG[0].highlights.length);

    const icons = firstItem.querySelectorAll('.highlight-icon svg');
    expect(icons.length).toBe(CHANGELOG[0].highlights.length);
  });

  it('supports appending multiple versions cleanly', () => {
    const customEntries: ChangelogItem[] = [
      {
        version: 'v0.2.0',
        tagline: 'Second update with new features',
        date: 'Next Release',
        highlights: ['Feature A', 'Feature B'],
      },
      ...CHANGELOG,
    ];

    const el = renderChangelog(customEntries);
    const items = el.querySelectorAll('.changelog-item');
    expect(items.length).toBe(2);

    const v2Pill = items[0].querySelector('.version-pill');
    expect(v2Pill?.textContent).toBe('v0.2.0');

    const v1Pill = items[1].querySelector('.version-pill');
    expect(v1Pill?.textContent).toBe('v0.1.0');
  });
});
