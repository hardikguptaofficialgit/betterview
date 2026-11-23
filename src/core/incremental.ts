import { Color, UIType } from './types';
import { clear, h } from './dom';
import { iconEl } from './icons';

export interface TypeMeta {
  icon: string;
  color: Color;
  label: string;
}

export const TYPE_META: Record<UIType, TypeMeta> = {
  flow: { icon: 'tree-structure', color: 'blue', label: 'Flow' },
  stepper: { icon: 'steps', color: 'blue', label: 'Steps' },
  table: { icon: 'table', color: 'stone', label: 'Table' },
  compare: { icon: 'scales', color: 'amber', label: 'Compare' },
  quiz: { icon: 'question', color: 'green', label: 'Quiz' },
  chart: { icon: 'chart-bar', color: 'purple', label: 'Chart' },
  mermaid: { icon: 'graph', color: 'purple', label: 'Diagram' },
  callout: { icon: 'info', color: 'blue', label: 'Callout' },
  stats: { icon: 'trend-up', color: 'teal', label: 'Stats' },
  tabs: { icon: 'tabs', color: 'stone', label: 'Tabs' },
  timeline: { icon: 'hourglass', color: 'rose', label: 'Timeline' },
  followups: { icon: 'sparkle', color: 'mint', label: 'Suggestions' },
  math: { icon: 'function', color: 'purple', label: 'Math' },
  code: { icon: 'code', color: 'sky', label: 'Code' },
  checklist: { icon: 'check', color: 'green', label: 'Checklist' },
  form: { icon: 'list', color: 'blue', label: 'Form' },
  image: { icon: 'image', color: 'purple', label: 'Image' },
  dashboard: { icon: 'layout-dashboard', color: 'stone', label: 'Dashboard' },
  generic: { icon: 'sparkle', color: 'stone', label: 'Details' },
};

export interface DiffResult<T> {
  added: { item: T; key: string | number; index: number }[];
  existingCount: number;
}

/**
 * Diffs incoming child items against an existing key set.
 * Returns only the new items to append, ensuring already-rendered items
 * are never re-rendered.
 */
export function diffChildren<T>(
  existingKeys: Set<string | number>,
  incomingItems: T[],
  getKey: (item: T, index: number) => string | number,
): DiffResult<T> {
  const added: { item: T; key: string | number; index: number }[] = [];
  for (let i = 0; i < incomingItems.length; i++) {
    const item = incomingItems[i];
    const key = getKey(item, i);
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      added.push({ item, key, index: i });
    }
  }
  return { added, existingCount: existingKeys.size };
}

/**
 * Diffs incoming child items and appends newly added elements to the container.
 */
export function diffAndAppendChildren<T>(
  container: HTMLElement,
  existingKeys: Set<string | number>,
  incomingItems: T[],
  getKey: (item: T, index: number) => string | number,
  renderItem: (item: T, index: number) => HTMLElement,
): HTMLElement[] {
  const diff = diffChildren(existingKeys, incomingItems, getKey);
  const elements: HTMLElement[] = [];
  for (const { item, index } of diff.added) {
    const el = renderItem(item, index);
    container.appendChild(el);
    elements.push(el);
  }
  return elements;
}

/**
 * Builds type-specific skeletons with deterministic widths and reserved min-heights.
 */
export function createTypeSkeleton(typeHint?: UIType): HTMLElement {
  const card = h('div', { class: 'iui-card iui-skeleton-card' });

  if (typeHint === 'flow') {
    const wrap = h('div', { class: 'iui-skel-flow-wrap' });
    const pill1 = h('div', { class: 'iui-skel iui-skel-flow-pill', style: 'width: 180px;' });
    const line1 = h('div', { class: 'iui-skel-flow-line' });
    const pill2 = h('div', { class: 'iui-skel iui-skel-flow-pill', style: 'width: 160px;' });
    const line2 = h('div', { class: 'iui-skel-flow-line' });
    const pill3 = h('div', { class: 'iui-skel iui-skel-flow-pill', style: 'width: 200px;' });
    wrap.appendChild(pill1);
    wrap.appendChild(line1);
    wrap.appendChild(pill2);
    wrap.appendChild(line2);
    wrap.appendChild(pill3);
    card.appendChild(wrap);
  } else if (typeHint === 'table') {
    const wrap = h('div', { class: 'iui-skel-table-wrap' });
    const header = h('div', { class: 'iui-skel iui-skel-table-header' });
    wrap.appendChild(header);
    const rowWidths = ['92%', '78%', '86%', '68%'];
    for (const w of rowWidths) {
      wrap.appendChild(h('div', { class: 'iui-skel iui-skel-table-row', style: `width: ${w};` }));
    }
    card.appendChild(wrap);
  } else if (typeHint === 'stepper') {
    const wrap = h('div', { class: 'iui-skel-stepper-wrap' });
    const stepWidths = ['80%', '65%', '90%', '70%'];
    for (const w of stepWidths) {
      const row = h(
        'div',
        { class: 'iui-skel-stepper-row' },
        h('div', { class: 'iui-skel iui-skel-stepper-circle' }),
        h('div', { class: 'iui-skel iui-skel-stepper-bar', style: `width: ${w};` }),
      );
      wrap.appendChild(row);
    }
    card.appendChild(wrap);
  } else if (typeHint === 'compare') {
    const wrap = h('div', { class: 'iui-skel-compare-wrap' });
    for (let c = 0; c < 2; c++) {
      const col = h('div', { class: 'iui-skel-compare-col' });
      col.appendChild(h('div', { class: 'iui-skel', style: 'height: 24px; width: 60%;' }));
      col.appendChild(h('div', { class: 'iui-skel', style: 'height: 16px; width: 90%;' }));
      col.appendChild(h('div', { class: 'iui-skel', style: 'height: 16px; width: 75%;' }));
      col.appendChild(h('div', { class: 'iui-skel', style: 'height: 16px; width: 85%;' }));
      wrap.appendChild(col);
    }
    card.appendChild(wrap);
  } else if (typeHint === 'quiz') {
    const wrap = h('div', { class: 'iui-skel-quiz-wrap' });
    wrap.appendChild(h('div', { class: 'iui-skel iui-skel-quiz-q' }));
    const optWidths = ['95%', '80%', '90%', '75%'];
    for (const w of optWidths) {
      wrap.appendChild(h('div', { class: 'iui-skel iui-skel-quiz-opt', style: `width: ${w};` }));
    }
    card.appendChild(wrap);
  } else if (typeHint === 'chart') {
    const wrap = h('div', { class: 'iui-skel-chart-wrap' });
    const heights = ['45%', '80%', '60%', '90%', '70%'];
    for (const hVal of heights) {
      wrap.appendChild(h('div', { class: 'iui-skel iui-skel-chart-bar', style: `height: ${hVal};` }));
    }
    card.appendChild(wrap);
  } else if (typeHint === 'mermaid') {
    const wrap = h('div', { class: 'iui-skel-mermaid-wrap' });
    wrap.appendChild(h('div', { class: 'iui-skel iui-skel-mermaid-box' }));
    wrap.appendChild(h('div', { class: 'iui-skel-mermaid-arrow' }));
    wrap.appendChild(h('div', { class: 'iui-skel iui-skel-mermaid-box' }));
    wrap.appendChild(h('div', { class: 'iui-skel-mermaid-arrow' }));
    wrap.appendChild(h('div', { class: 'iui-skel iui-skel-mermaid-box' }));
    card.appendChild(wrap);
  } else if (typeHint === 'callout') {
    card.appendChild(h('div', { class: 'iui-skel', style: 'height: 72px; width: 100%;' }));
  } else if (typeHint === 'stats') {
    const wrap = h('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px;' });
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 80px;' }));
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 80px;' }));
    card.appendChild(wrap);
  } else if (typeHint === 'tabs') {
    card.appendChild(h('div', { class: 'iui-skel', style: 'height: 32px; width: 50%; border-radius: 999px;' }));
    card.appendChild(h('div', { class: 'iui-skel', style: 'height: 90px; margin-top: 10px;' }));
  } else if (typeHint === 'timeline') {
    const wrap = h('div', { class: 'iui-skel-stepper-wrap' });
    for (let i = 0; i < 3; i++) {
      const row = h(
        'div',
        { class: 'iui-skel-stepper-row' },
        h('div', { class: 'iui-skel', style: 'width: 14px; height: 14px; border-radius: 999px;' }),
        h('div', { class: 'iui-skel', style: 'height: 20px; flex: 1;' }),
      );
      wrap.appendChild(row);
    }
    card.appendChild(wrap);
  } else if (typeHint === 'followups') {
    const wrap = h('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap;' });
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 34px; width: 120px; border-radius: 999px;' }));
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 34px; width: 160px; border-radius: 999px;' }));
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 34px; width: 140px; border-radius: 999px;' }));
    card.appendChild(wrap);
  } else if (typeHint === 'math') {
    const wrap = h('div', { style: 'display: flex; flex-direction: column; gap: 12px; align-items: center;' });
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 48px; width: 70%; border-radius: 8px;' }));
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 24px; width: 85%; border-radius: 6px;' }));
    card.appendChild(wrap);
  } else if (typeHint === 'code') {
    const wrap = h('div', { style: 'display: flex; flex-direction: column; gap: 8px;' });
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 28px; width: 100%; border-radius: 6px; margin-bottom: 6px;' }));
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 16px; width: 60%;' }));
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 16px; width: 80%;' }));
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 16px; width: 45%;' }));
    wrap.appendChild(h('div', { class: 'iui-skel', style: 'height: 16px; width: 70%;' }));
    card.appendChild(wrap);
  } else {
    // Default 4 lines with varied deterministic widths
    const widths = ['100%', '82%', '94%', '65%'];
    for (const w of widths) {
      card.appendChild(h('div', { class: 'iui-skel iui-skel-line', style: `width: ${w};` }));
    }
  }

  return card;
}
