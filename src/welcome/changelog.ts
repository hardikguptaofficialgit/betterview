import { h } from '../core/dom';
import { iconEl } from '../core/icons';

export interface ChangelogItem {
  version: string;
  tagline: string;
  date?: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogItem[] = [
  {
    version: 'v0.1.0',
    tagline:
      'First release: 7 visual components, works on Gemini and Grok, light and dark mode, one-click setup, works fully offline: no data leaves your browser.',
    date: 'Launch release',
    highlights: [
      '7 visual components: Flow diagrams, Step-by-step guides, Tables, Comparisons, Charts, Mermaid diagrams, Quizzes',
      'Native rendering directly inside Gemini and Grok chat streams',
      'Polished light and dark mode with system theme detection',
      'One-click automated instruction setup and manual copy fallback',
      'Privacy first: works fully offline with no external servers or tracking',
    ],
  },
];

export function renderChangelog(entries: ChangelogItem[]): HTMLElement {
  const container = h('div', { class: 'changelog-timeline', role: 'region', 'aria-label': "What's new changelog" });

  for (const entry of entries) {
    const itemEl = h(
      'article',
      { class: 'changelog-item' },
      h(
        'div',
        { class: 'changelog-rail', 'aria-hidden': 'true' },
        h('div', { class: 'changelog-dot' }),
        h('div', { class: 'changelog-line' }),
      ),
      h(
        'div',
        { class: 'changelog-content' },
        h(
          'div',
          { class: 'changelog-header' },
          h('span', { class: 'version-pill' }, entry.version),
          entry.date ? h('span', { class: 'changelog-date' }, entry.date) : null,
        ),
        h('p', { class: 'changelog-tagline' }, entry.tagline),
        h(
          'ul',
          { class: 'changelog-list' },
          ...entry.highlights.map((highlight) =>
            h(
              'li',
              { class: 'changelog-highlight' },
              h('span', { class: 'highlight-icon', 'aria-hidden': 'true' }, iconEl('check', 14)),
              h('span', { class: 'highlight-text' }, highlight),
            ),
          ),
        ),
      ),
    );
    container.appendChild(itemEl);
  }

  return container;
}
