import { TableSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';
import { iconEl } from '../core/icons';
import { renderMathText } from '../core/mathParser';
import { showCardToast } from '../core/export';

export function parseNumericValue(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s,₹$€%]/g, '');
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))([kKmMbB])?$/.exec(cleaned);
  if (!match) return null;
  const base = parseFloat(match[1]);
  if (Number.isNaN(base)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'k') return base * 1e3;
  if (suffix === 'm') return base * 1e6;
  if (suffix === 'b') return base * 1e9;
  return base;
}

export function parseDateValue(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 4) return null;
  // Don't treat pure numbers or currency or percentage as date
  if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed) || /[\$€₹%]/.test(trimmed)) return null;
  const hasDatePattern =
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(trimmed) ||
    /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(trimmed) ||
    /^[A-Za-z]{3,}\.?\s+\d{1,2}/.test(trimmed) ||
    /^\d{1,2}\s+[A-Za-z]{3,}/.test(trimmed) ||
    /^\d{4}-\d{2}-\d{2}T/.test(trimmed);
  if (!hasDatePattern) return null;
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) return null;
  return ts;
}

export type ColumnType = 'numeric' | 'date' | 'string';

/** Serialize table content as plain tab-separated text for spreadsheets. */
export function serializeTableValues(columns: string[], rows: string[][]): string {
  const cleanCell = (value: unknown): string =>
    String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
  return [columns, ...rows].map((row) => row.map(cleanCell).join('\t')).join('\n');
}

export function detectColumnType(rows: string[][], colIdx: number): ColumnType {
  let hasValid = false;
  let allNumeric = true;
  let allDate = true;

  for (const r of rows) {
    const val = r[colIdx];
    if (val !== undefined && val.trim() !== '') {
      hasValid = true;
      if (parseNumericValue(val) === null) {
        allNumeric = false;
      }
      if (parseDateValue(val) === null) {
        allDate = false;
      }
    }
  }

  if (hasValid && allNumeric) return 'numeric';
  if (hasValid && allDate) return 'date';
  return 'string';
}

export function compareCellValues(valA: string, valB: string, type: ColumnType): number {
  if (type === 'numeric') {
    const numA = parseNumericValue(valA);
    const numB = parseNumericValue(valB);
    if (numA !== null && numB !== null) {
      return numA - numB;
    }
  } else if (type === 'date') {
    const dateA = parseDateValue(valA);
    const dateB = parseDateValue(valB);
    if (dateA !== null && dateB !== null) {
      return dateA - dateB;
    }
  }
  return valA.localeCompare(valB, undefined, { numeric: true });
}

export function renderTable(spec: TableSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-table-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const columns = spec.columns || [];
  const rows = spec.rows || [];

  const columnTypes: ColumnType[] = columns.map((_, colIdx) => detectColumnType(rows, colIdx));
  const isNumericCol: boolean[] = columnTypes.map((t) => t === 'numeric');

  interface IndexedRow {
    row: string[];
    idx: number;
  }
  const originalRows: IndexedRow[] = rows.map((r, i) => ({ row: r, idx: i }));

  type SortDir = 'none' | 'asc' | 'desc';
  let sortCol: number | null = null;
  let sortDir: SortDir = 'none';
  let filterQuery = '';

  const actionsBar = h('div', { class: 'iui-table-actions' });
  const copyButton = h('button', {
    class: 'iui-table-copy-btn',
    type: 'button',
    'aria-label': 'Copy table data as plain text',
    onClick: async () => {
      const text = serializeTableValues(columns, rows);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = h('textarea', { class: 'iui-table-copy-fallback', readonly: true }) as HTMLTextAreaElement;
          textarea.value = text;
          card.appendChild(textarea);
          textarea.select();
          const copied = document.execCommand('copy');
          textarea.remove();
          if (!copied) throw new Error('Clipboard access is unavailable');
        }
        showCardToast(card, 'Table data copied · Paste into Sheets or Excel');
      } catch {
        showCardToast(card, 'Could not copy table data. Check clipboard permissions.');
      }
    },
  }, iconEl('copy', 14), 'Copy data');
  actionsBar.appendChild(copyButton);

  // Filter input bar for tables with > 6 rows
  let filterCountEl: HTMLElement | null = null;
  if (rows.length > 6) {
    const filterBar = h('div', { class: 'iui-table-filter-bar' });
    const filterWrap = h('div', { class: 'iui-table-filter-wrap' });
    const searchIcon = iconEl('magnifying-glass', 14, 'iui-table-filter-icon');

    const filterInput = h('input', {
      class: 'iui-table-filter-input',
      type: 'search',
      placeholder: 'Filter rows...',
      'aria-label': 'Filter table rows',
      onInput: (e: Event) => {
        filterQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
        updateDisplay();
      },
    }) as HTMLInputElement;

    filterCountEl = h('span', { class: 'iui-table-filter-count' }, `${rows.length} of ${rows.length} rows`);

    filterWrap.appendChild(searchIcon);
    filterWrap.appendChild(filterInput);
    filterBar.appendChild(filterWrap);
    filterBar.appendChild(filterCountEl);
    actionsBar.prepend(filterBar);
  }
  card.appendChild(actionsBar);

  const scrollWrap = h('div', { class: 'iui-table-wrap' });
  const innerScroll = h('div', { class: 'iui-table-scroll' });
  const table = h('table', { class: 'iui-table' });
  const thead = h('thead', { class: 'iui-table-header c-stone' });
  const headerTr = h('tr', { class: 'iui-table-header-tr' });

  const tbody = h('tbody', { class: 'iui-table-tbody' });

  function renderRows(entries: IndexedRow[]): void {
    clear(tbody);

    if (entries.length === 0) {
      const emptyTr = h('tr', { class: 'iui-table-empty-tr' });
      const emptyTd = h(
        'td',
        {
          class: 'iui-table-empty-td',
          colspan: String(Math.max(columns.length, 1)),
        },
        'No matching rows',
      );
      emptyTr.appendChild(emptyTd);
      tbody.appendChild(emptyTr);
      return;
    }

    for (const item of entries) {
      const tr = h('tr', { class: 'iui-table-tr' });
      tr.style.setProperty('--row-idx', String(item.idx));

      // Calculate best value column per row when spec.highlight is set
      let bestColIdx: number | null = null;
      if (spec.highlight) {
        const isMin = spec.highlight === 'min';
        let bestVal = isMin ? Infinity : -Infinity;
        let numCount = 0;
        for (let c = 0; c < columns.length; c++) {
          const val = parseNumericValue(item.row[c] ?? '');
          if (val !== null) {
            numCount++;
            if (isMin ? val < bestVal : val > bestVal) {
              bestVal = val;
              bestColIdx = c;
            }
          }
        }
        if (numCount < 2) {
          bestColIdx = null;
        }
      }

      for (let c = 0; c < columns.length; c++) {
        const cellText = item.row[c] ?? '';
        const tdClasses = ['iui-table-td'];
        if (isNumericCol[c]) {
          tdClasses.push('is-numeric');
        }
        const isBest = spec.highlight && c === bestColIdx;
        if (isBest) {
          tdClasses.push('is-highlighted');
        }

        const td = h('td', { class: tdClasses.join(' ') });
        if (isBest) {
          const pill = h('span', { class: 'iui-table-highlight-pill c-mint' });
          renderMathText(pill, cellText);
          td.appendChild(pill);
        } else {
          renderMathText(td, cellText);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  const thElements: HTMLElement[] = [];
  const btnElements: HTMLElement[] = [];
  const arrowElements: HTMLElement[] = [];

  function updateDisplay(): void {
    // 1. Filter rows
    let filtered = originalRows;
    if (filterQuery) {
      filtered = originalRows.filter((item) =>
        item.row.some((cell) => cell.toLowerCase().includes(filterQuery)),
      );
    }

    if (filterCountEl) {
      filterCountEl.textContent = `${filtered.length} of ${rows.length} rows`;
    }

    // 2. Sort rows
    let sorted: IndexedRow[];
    if (sortCol === null || sortDir === 'none') {
      sorted = [...filtered];
    } else {
      const col = sortCol;
      const dir = sortDir;
      const type = columnTypes[col];
      sorted = [...filtered].sort((a, b) => {
        const valA = a.row[col] ?? '';
        const valB = b.row[col] ?? '';
        const cmp = compareCellValues(valA, valB, type);
        if (cmp === 0) {
          return a.idx - b.idx;
        }
        return dir === 'asc' ? cmp : -cmp;
      });
    }

    renderRows(sorted);

    // Update header icons and ARIA attributes
    for (let c = 0; c < columns.length; c++) {
      const th = thElements[c];
      const btn = btnElements[c];
      const arrow = arrowElements[c];
      clear(arrow);

      if (sortCol === c && sortDir !== 'none') {
        const sortVal = sortDir === 'asc' ? 'ascending' : 'descending';
        th.setAttribute('aria-sort', sortVal);
        btn.setAttribute('aria-sort', sortVal);
        const iconName = sortDir === 'asc' ? 'caret-up' : 'caret-down';
        arrow.appendChild(iconEl(iconName, 12, 'iui-table-caret-svg'));
      } else {
        th.setAttribute('aria-sort', 'none');
        btn.setAttribute('aria-sort', 'none');
      }
    }
  }

  for (let c = 0; c < columns.length; c++) {
    const colName = columns[c] ?? '';
    const thClasses = ['iui-table-th'];
    if (isNumericCol[c]) {
      thClasses.push('is-numeric');
    }

    const arrow = h('span', { class: 'iui-table-sort-arrow' });
    arrowElements.push(arrow);

    const btn = h(
      'button',
      {
        class: 'iui-table-th-btn',
        type: 'button',
        'aria-sort': 'none',
        onClick: () => {
          if (sortCol !== c) {
            sortCol = c;
            sortDir = 'asc';
          } else {
            if (sortDir === 'asc') {
              sortDir = 'desc';
            } else if (sortDir === 'desc') {
              sortDir = 'none';
              sortCol = null;
            } else {
              sortDir = 'asc';
            }
          }
          updateDisplay();
        },
        onKeyDown: (e: Event) => {
          const ke = e as KeyboardEvent;
          if (ke.key === 'Enter' || ke.key === ' ') {
            e.preventDefault();
            btn.click();
          }
        },
      },
      colName,
      arrow,
    );
    btnElements.push(btn);

    const th = h('th', { class: thClasses.join(' '), scope: 'col', 'aria-sort': 'none' }, btn);
    thElements.push(th);
    headerTr.appendChild(th);
  }

  thead.appendChild(headerTr);
  table.appendChild(thead);
  table.appendChild(tbody);
  innerScroll.appendChild(table);
  scrollWrap.appendChild(innerScroll);
  card.appendChild(scrollWrap);

  updateDisplay();

  return card;
}
