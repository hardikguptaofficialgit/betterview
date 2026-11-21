import { ChecklistSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';

export function renderChecklist(spec: ChecklistSpec, _ctx: RenderContext): HTMLElement {
  const card = h('section', { class: 'iui-card iui-checklist-card', 'aria-label': spec.title || 'Checklist' });
  const items = spec.items.map((item) => ({ ...item, checked: item.checked === true }));
  const header = h('div', { class: 'iui-checklist-header' });
  const heading = h('div', { class: 'iui-checklist-heading' },
    spec.title ? h('div', { class: 'iui-title iui-checklist-title' }, spec.title) : null,
    h('div', { class: 'iui-checklist-count', 'aria-live': 'polite' }),
  );
  const bulkButton = h('button', {
    type: 'button', class: 'iui-btn secondary iui-checklist-bulk',
    'aria-label': 'Mark all checklist items complete',
  }, 'Mark all');
  header.append(heading, bulkButton);

  const progressTrack = h('div', { class: 'iui-checklist-progress-track', role: 'progressbar', 'aria-label': 'Checklist progress', 'aria-valuemin': '0', 'aria-valuemax': String(items.length), 'aria-valuenow': '0' });
  const progressFill = h('div', { class: 'iui-checklist-progress-fill' });
  progressTrack.appendChild(progressFill);
  const list = h('div', { class: 'iui-checklist-items', role: 'group', 'aria-label': 'Checklist items' });
  const rows: { input: HTMLInputElement; row: HTMLElement; item: typeof items[number] }[] = [];

  function updateProgress(): void {
    const complete = items.filter((item) => item.checked).length;
    const percent = Math.round((complete / items.length) * 100);
    const count = heading.querySelector<HTMLElement>('.iui-checklist-count')!;
    count.textContent = `${complete} of ${items.length} completed · ${percent}%`;
    progressTrack.setAttribute('aria-valuenow', String(complete));
    progressFill.style.width = `${percent}%`;
    card.classList.toggle('is-complete', complete === items.length);
    bulkButton.textContent = complete === items.length ? 'Clear all' : 'Mark all';
    bulkButton.setAttribute('aria-label', complete === items.length ? 'Clear all checklist items' : 'Mark all checklist items complete');
    for (const { input, row, item } of rows) {
      input.checked = item.checked;
      row.classList.toggle('is-checked', item.checked);
    }
  }

  items.forEach((item, index) => {
    const input = h('input', { type: 'checkbox', class: 'iui-checklist-input', 'aria-label': item.text }) as HTMLInputElement;
    input.checked = item.checked;
    const copy = h('span', { class: 'iui-checklist-copy' },
      h('span', { class: 'iui-checklist-text' }, item.text),
      item.detail ? h('span', { class: 'iui-checklist-detail' }, item.detail) : null,
    );
    const row = h('label', { class: 'iui-checklist-row', style: `--checklist-index:${index}` },
      h('span', { class: 'iui-checklist-box' }, iconEl('check', 13)), input, copy,
    );
    input.addEventListener('change', () => {
      item.checked = input.checked;
      updateProgress();
    });
    rows.push({ input, row, item });
    list.appendChild(row);
  });

  bulkButton.addEventListener('click', () => {
    const shouldCheck = items.some((item) => !item.checked);
    items.forEach((item) => { item.checked = shouldCheck; });
    updateProgress();
  });

  card.append(header, progressTrack, list);
  updateProgress();
  return card;
}
