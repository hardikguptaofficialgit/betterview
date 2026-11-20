import { TableSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';

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

export function renderTable(spec: TableSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-table-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const columns = spec.columns || [];
  const rows = spec.rows || [];

  const isNumericCol: boolean[] = columns.map((_, colIdx) => {
    if (rows.length === 0) return false;
    let validCount = 0;
    for (const r of rows) {
      const val = r[colIdx];
      if (val !== undefined && val.trim() !== '') {
        if (parseNumericValue(val) === null) return false;
        validCount++;
      }
    }
    return validCount > 0;
  });

  const scrollWrap = h('div', { class: 'iui-table-wrap' });
  const innerScroll = h('div', { class: 'iui-table-scroll' });
  const table = h('table', { class: 'iui-table' });
  const thead = h('thead', { class: 'iui-table-header c-stone' });
  const headerTr = h('tr', { class: 'iui-table-header-tr' });

  type SortDir = 'none' | 'asc' | 'desc';
  let sortCol: number | null = null;
  let sortDir: SortDir = 'none';

  interface IndexedRow {
    row: string[];
    idx: number;
  }
  const originalRows: IndexedRow[] = rows.map((r, i) => ({ row: r, idx: i }));

  const tbody = h('tbody', { class: 'iui-table-tbody' });

  function renderRows(entries: IndexedRow[]): void {
    clear(tbody);
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
        const cellContent = isBest
          ? h('span', { class: 'iui-table-highlight-pill c-mint' }, cellText)
          : cellText;
        const td = h('td', { class: tdClasses.join(' ') }, cellContent);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  const thElements: HTMLElement[] = [];
  const btnElements: HTMLElement[] = [];
  const arrowElements: HTMLElement[] = [];

  function updateSort(): void {
    let sorted: IndexedRow[];
    if (sortCol === null || sortDir === 'none') {
      sorted = [...originalRows];
    } else {
      const col = sortCol;
      const dir = sortDir;
      sorted = [...originalRows].sort((a, b) => {
        const valA = a.row[col] ?? '';
        const valB = b.row[col] ?? '';
        const numA = parseNumericValue(valA);
        const numB = parseNumericValue(valB);
        let cmp: number;
        if (numA !== null && numB !== null) {
          cmp = numA - numB;
        } else {
          cmp = valA.localeCompare(valB, undefined, { numeric: true });
        }
        if (cmp === 0) {
          return a.idx - b.idx;
        }
        return dir === 'asc' ? cmp : -cmp;
      });
    }

    renderRows(sorted);

    for (let c = 0; c < columns.length; c++) {
      const th = thElements[c];
      const btn = btnElements[c];
      const arrow = arrowElements[c];
      if (sortCol === c && sortDir !== 'none') {
        const sortVal = sortDir === 'asc' ? 'ascending' : 'descending';
        th.setAttribute('aria-sort', sortVal);
        btn.setAttribute('aria-sort', sortVal);
        arrow.textContent = sortDir === 'asc' ? ' ↑' : ' ↓';
      } else {
        th.setAttribute('aria-sort', 'none');
        btn.setAttribute('aria-sort', 'none');
        arrow.textContent = '';
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
          updateSort();
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

  renderRows(originalRows);

  return card;
}
