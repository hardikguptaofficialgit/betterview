import { ChartSpec, TableSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';
import { iconEl } from '../core/icons';
import { renderMathText } from '../core/mathParser';
import { showCardToast } from '../core/export';
import { renderChart } from './chart';

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

export function renderTable(
  spec: TableSpec,
  ctx: RenderContext,
  options: { allowViewSwitch?: boolean } = {},
): HTMLElement {
  const card = h('div', { class: 'iui-card iui-table-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const columns = spec.columns || [];
  const rows = spec.rows || [];

  const columnTypes: ColumnType[] = columns.map((_, colIdx) => detectColumnType(rows, colIdx));
  const isNumericCol: boolean[] = columnTypes.map((t) => t === 'numeric');
  const hasNumericCol = isNumericCol.some(Boolean);
  const canSwitchView = options.allowViewSwitch !== false && columns.length >= 2 && hasNumericCol && rows.length > 0;

  // Precompute max value for non-negative numeric columns (for proportional inline micro-bars)
  const colBarMax: (number | null)[] = columns.map((_, colIdx) => {
    if (!isNumericCol[colIdx] || rows.length < 2) return null;
    let maxVal = 0;
    let count = 0;
    for (const r of rows) {
      const val = parseNumericValue(r[colIdx] ?? '');
      if (val !== null) {
        if (val < 0) return null;
        if (val > maxVal) maxVal = val;
        count++;
      }
    }
    return count >= 2 && maxVal > 0 ? maxVal : null;
  });

  // Precompute numeric summary (Sum / Avg) per column
  const colSummary: ({ sum: number; avg: number; count: number } | null)[] = columns.map((_, colIdx) => {
    if (!isNumericCol[colIdx] || rows.length < 2) return null;
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const val = parseNumericValue(r[colIdx] ?? '');
      if (val !== null) {
        sum += val;
        count++;
      }
    }
    return count >= 2 ? { sum, avg: sum / count, count } : null;
  });

  interface IndexedRow {
    row: string[];
    idx: number;
  }
  const originalRows: IndexedRow[] = rows.map((r, i) => ({ row: r, idx: i }));

  type SortDir = 'none' | 'asc' | 'desc';
  type ViewMode = 'table' | 'chart' | 'cards';
  let sortCol: number | null = null;
  let sortDir: SortDir = 'none';
  let filterQuery = '';
  let viewMode: ViewMode = 'table';
  let currentEntries: IndexedRow[] = [...originalRows];

  const actionsBar = h('div', { class: 'iui-table-actions' });
  const rightActions = h('div', { class: 'iui-table-actions-right' });

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
  rightActions.appendChild(copyButton);

  let scrollWrap: HTMLElement;
  let chartViewHost: HTMLElement | null = null;
  let cardsViewHost: HTMLElement | null = null;
  let chartViewCleanup: (() => void) | null = null;

  const viewButtons: { mode: ViewMode; btn: HTMLButtonElement }[] = [];

  function renderCardsView(entries: IndexedRow[]): void {
    if (!cardsViewHost) return;
    clear(cardsViewHost);
    if (entries.length === 0) {
      cardsViewHost.appendChild(h('div', { class: 'iui-table-cards-empty' }, 'No matching rows'));
      return;
    }
    const primaryCol = Math.max(0, isNumericCol.findIndex((isNum) => !isNum));
    const grid = h('div', { class: 'iui-table-cards-grid' });
    for (const item of entries) {
      const kvCard = h('div', { class: 'iui-table-kv-card' });
      const head = h('div', { class: 'iui-table-kv-head' });
      renderMathText(head, item.row[primaryCol] ?? '');
      kvCard.appendChild(head);

      const body = h('div', { class: 'iui-table-kv-body' });
      for (let c = 0; c < columns.length; c++) {
        if (c === primaryCol) continue;
        const kvRow = h('div', { class: 'iui-table-kv-row' });
        kvRow.appendChild(h('span', { class: 'iui-table-kv-key' }, columns[c] ?? ''));
        const valSpan = h('span', { class: `iui-table-kv-val${isNumericCol[c] ? ' is-numeric' : ''}` });
        renderMathText(valSpan, item.row[c] ?? '');
        kvRow.appendChild(valSpan);
        body.appendChild(kvRow);
      }
      kvCard.appendChild(body);
      grid.appendChild(kvCard);
    }
    cardsViewHost.appendChild(grid);
  }

  function renderChartView(entries: IndexedRow[]): void {
    if (!chartViewHost) return;
    chartViewCleanup?.();
    chartViewCleanup = null;
    clear(chartViewHost);
    const labelCol = Math.max(0, isNumericCol.findIndex((isNum) => !isNum));
    const numericCols = columns
      .map((_, i) => i)
      .filter((i) => i !== labelCol && isNumericCol[i]);
    const targetCols = numericCols.length > 0 ? numericCols : columns.map((_, i) => i).filter((i) => i !== labelCol);

    const chartSpec: ChartSpec = {
      type: 'chart',
      chartType: columnTypes[labelCol] === 'date' ? 'line' : 'bar',
      labels: entries.map((entry) => entry.row[labelCol] ?? ''),
      datasets: targetCols.map((c) => ({
        label: columns[c] ?? `Col ${c + 1}`,
        data: entries.map((entry) => parseNumericValue(entry.row[c] ?? '') ?? 0),
      })),
    };
    const chartCtx = {
      ...ctx,
      onCleanup: (cleanup: () => void) => {
        chartViewCleanup = cleanup;
        ctx.onCleanup(cleanup);
      },
    };
    const chartEl = renderChart(chartSpec, chartCtx);
    chartViewHost.appendChild(chartEl);
  }

  function setViewMode(nextMode: ViewMode): void {
    viewMode = nextMode;
    for (const entry of viewButtons) {
      const active = entry.mode === viewMode;
      entry.btn.classList.toggle('is-active', active);
      entry.btn.setAttribute('aria-pressed', String(active));
    }
    scrollWrap.hidden = viewMode !== 'table';
    if (chartViewHost) {
      chartViewHost.hidden = viewMode !== 'chart';
      if (viewMode === 'chart') renderChartView(currentEntries);
    }
    if (cardsViewHost) {
      cardsViewHost.hidden = viewMode !== 'cards';
      if (viewMode === 'cards') renderCardsView(currentEntries);
    }
  }

  if (canSwitchView) {
    const viewSwitch = h('div', {
      class: 'iui-table-view-switch',
      role: 'group',
      'aria-label': 'Table view mode',
    });
    const modes: { mode: ViewMode; label: string }[] = [
      { mode: 'table', label: 'Table' },
      { mode: 'chart', label: 'Chart' },
      { mode: 'cards', label: 'Cards' },
    ];
    for (const m of modes) {
      const btn = h(
        'button',
        {
          type: 'button',
          class: `iui-table-view-btn${m.mode === 'table' ? ' is-active' : ''}`,
          'aria-pressed': m.mode === 'table' ? 'true' : 'false',
          onClick: () => setViewMode(m.mode),
        },
        m.label,
      ) as HTMLButtonElement;
      viewButtons.push({ mode: m.mode, btn });
      viewSwitch.appendChild(btn);
    }
    rightActions.prepend(viewSwitch);
  }
  actionsBar.appendChild(rightActions);

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

  scrollWrap = h('div', { class: 'iui-table-wrap' });
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
        const barMax = colBarMax[c];
        if (barMax !== null) {
          td.style.position = 'relative';
          const parsedVal = parseNumericValue(cellText);
          if (parsedVal !== null && parsedVal >= 0) {
            const pct = Math.min(100, Math.max(0, (parsedVal / barMax) * 100));
            const bar = h('span', { class: 'iui-table-cell-bar', 'aria-hidden': 'true' });
            bar.style.width = `${pct.toFixed(1)}%`;
            td.appendChild(bar);
          }
        }
        if (isBest) {
          const pill = h('span', { class: 'iui-table-highlight-pill c-mint' });
          renderMathText(pill, cellText);
          td.appendChild(pill);
        } else {
          const valWrap = barMax !== null ? h('span', { class: 'iui-table-cell-val' }) : td;
          renderMathText(valWrap, cellText);
          if (valWrap !== td) td.appendChild(valWrap);
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

    currentEntries = sorted;
    renderRows(sorted);
    if (viewMode === 'chart') renderChartView(sorted);
    if (viewMode === 'cards') {
      renderCardsView(sorted);
    }

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

  if (colSummary.some(Boolean)) {
    const tfoot = h('tfoot', { class: 'iui-table-tfoot' });
    const sumTr = h('tr', { class: 'iui-table-summary-tr' });
    const labelColIdx = Math.max(0, isNumericCol.findIndex((n) => !n));
    for (let c = 0; c < columns.length; c++) {
      const summary = colSummary[c];
      if (summary) {
        const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
        sumTr.appendChild(
          h(
            'td',
            { class: 'iui-table-summary-td is-numeric' },
            h('span', { class: 'iui-table-summary-sum' }, `Σ ${fmt(summary.sum)}`),
            h('span', { class: 'iui-table-summary-avg' }, `Avg ${fmt(summary.avg)}`),
          ),
        );
      } else if (c === labelColIdx) {
        sumTr.appendChild(h('td', { class: 'iui-table-summary-td is-label' }, 'Summary'));
      } else {
        sumTr.appendChild(h('td', { class: 'iui-table-summary-td' }));
      }
    }
    tfoot.appendChild(sumTr);
    table.appendChild(tfoot);
  }

  innerScroll.appendChild(table);
  scrollWrap.appendChild(innerScroll);
  card.appendChild(scrollWrap);

  if (canSwitchView) {
    chartViewHost = h('div', { class: 'iui-table-chart-view', hidden: true });
    cardsViewHost = h('div', { class: 'iui-table-cards-view', hidden: true });
    card.appendChild(chartViewHost);
    card.appendChild(cardsViewHost);
  }

  updateDisplay();

  return card;
}
