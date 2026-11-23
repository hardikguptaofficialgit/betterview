// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import {
  parseNumericValue,
  parseDateValue,
  detectColumnType,
  compareCellValues,
  renderTable,
  serializeTableValues,
} from '../src/components/table';
import { TableSpec } from '../src/core/types';

describe('Table: detectColumnType and value parsing', () => {
  it('serializes source values as plain tab-separated rows with headers', () => {
    expect(serializeTableValues(
      ['Service', 'Revenue', 'Growth'],
      [['A', '$500k', '99.9%'], ['B', '100', '']],
    )).toBe('Service\tRevenue\tGrowth\nA\t$500k\t99.9%\nB\t100\t');
  });

  it('keeps embedded whitespace from breaking spreadsheet columns and rows', () => {
    expect(serializeTableValues(['Name', 'Notes'], [[' A\tB ', 'line one\nline two']]))
      .toBe('Name\tNotes\nA B\tline one line two');
  });

  it('parses numeric, currency, and percentage values', () => {
    expect(parseNumericValue('42')).toBe(42);
    expect(parseNumericValue('$100')).toBe(100);
    expect(parseNumericValue('€75.50')).toBe(75.5);
    expect(parseNumericValue('₹3.5k')).toBe(3500);
    expect(parseNumericValue('99.9%')).toBe(99.9);
    expect(parseNumericValue('-15%')).toBe(-15);
  });

  it('parses date values in various common formats', () => {
    expect(parseDateValue('2024-03-01')).toBe(Date.parse('2024-03-01'));
    expect(parseDateValue('2023-12-15')).toBe(Date.parse('2023-12-15'));
    expect(parseDateValue('Jan 15, 2024')).toBe(Date.parse('Jan 15, 2024'));
    expect(parseDateValue('2024/05/20')).toBe(Date.parse('2024/05/20'));
    expect(parseDateValue('2024-01-15T10:00:00Z')).toBe(Date.parse('2024-01-15T10:00:00Z'));
  });

  it('rejects plain numbers, currencies, and non-date strings as dates', () => {
    expect(parseDateValue('100')).toBeNull();
    expect(parseDateValue('$500')).toBeNull();
    expect(parseDateValue('45%')).toBeNull();
    expect(parseDateValue('Pending')).toBeNull();
    expect(parseDateValue('')).toBeNull();
  });

  it('detects column type based on rows', () => {
    const rows = [
      ['Alice', '$100', '2024-01-15', '95%'],
      ['Bob', '$250', '2024-02-20', '80%'],
      ['Charlie', '$50', '2023-11-10', '99%'],
    ];

    expect(detectColumnType(rows, 0)).toBe('string');
    expect(detectColumnType(rows, 1)).toBe('numeric');
    expect(detectColumnType(rows, 2)).toBe('date');
    expect(detectColumnType(rows, 3)).toBe('numeric');
  });
});

describe('Table: spreadsheet data copying', () => {
  it('copies every original cell as tab-separated plain text, including headers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const card = renderTable({
      type: 'table',
      columns: ['Product', 'Price'],
      rows: [['Alpha', '$12'], ['Beta', '$18']],
    }, { theme: 'light', onCleanup: () => {} });

    const copyButton = card.querySelector<HTMLButtonElement>('.iui-table-copy-btn');
    expect(copyButton?.textContent).toContain('Copy data');
    copyButton?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('Product\tPrice\nAlpha\t$12\nBeta\t$18');
    expect(card.querySelector('[role="status"]')?.textContent).toContain('Paste into Sheets or Excel');
  });
});

describe('Table: sorting by type (numeric, currency, percent, date, string)', () => {
  it('correctly compares numeric, currency, percent, and date values', () => {
    // Numeric
    expect(compareCellValues('10', '2', 'numeric')).toBeGreaterThan(0);
    expect(compareCellValues('2', '10', 'numeric')).toBeLessThan(0);

    // Currency
    expect(compareCellValues('$50', '$100', 'numeric')).toBeLessThan(0);
    expect(compareCellValues('€20', '€5', 'numeric')).toBeGreaterThan(0);

    // Percent
    expect(compareCellValues('45%', '5%', 'numeric')).toBeGreaterThan(0);
    expect(compareCellValues('5%', '90%', 'numeric')).toBeLessThan(0);

    // Date
    expect(compareCellValues('2023-12-15', '2024-01-20', 'date')).toBeLessThan(0);
    expect(compareCellValues('2024-03-01', '2024-01-20', 'date')).toBeGreaterThan(0);

    // String
    expect(compareCellValues('Apple', 'Banana', 'string')).toBeLessThan(0);
  });

  it('sorts numeric, currency, and date columns on click and cycles asc -> desc -> original', () => {
    const spec: TableSpec = {
      type: 'table',
      title: 'Metrics',
      columns: ['Name', 'Revenue', 'Launch Date'],
      rows: [
        ['Service A', '$500k', '2024-05-01'],
        ['Service B', '$100k', '2023-10-15'],
        ['Service C', '$250k', '2024-01-10'],
      ],
    };

    const ctx = { theme: 'light' as const, onCleanup: () => {} };
    const card = renderTable(spec, ctx);

    const thButtons = card.querySelectorAll<HTMLButtonElement>('.iui-table-th-btn');
    expect(thButtons).toHaveLength(3);

    const getRowValues = (colIdx: number) => {
      const trs = card.querySelectorAll('.iui-table-tbody tr');
      return Array.from(trs).map((tr) => tr.children[colIdx]?.textContent?.trim());
    };

    // Initial order
    expect(getRowValues(0)).toEqual(['Service A', 'Service B', 'Service C']);

    // 1. Click Revenue column header -> ASC sort ($100k, $250k, $500k)
    thButtons[1].click();
    expect(getRowValues(1)).toEqual(['$100k', '$250k', '$500k']);
    expect(thButtons[1].getAttribute('aria-sort')).toBe('ascending');
    expect(thButtons[1].querySelector('.iui-table-sort-arrow svg')).not.toBeNull();

    // 2. Click Revenue again -> DESC sort ($500k, $250k, $100k)
    thButtons[1].click();
    expect(getRowValues(1)).toEqual(['$500k', '$250k', '$100k']);
    expect(thButtons[1].getAttribute('aria-sort')).toBe('descending');

    // 3. Click Revenue again -> NONE (original order)
    thButtons[1].click();
    expect(getRowValues(0)).toEqual(['Service A', 'Service B', 'Service C']);
    expect(thButtons[1].getAttribute('aria-sort')).toBe('none');

    // 4. Click Launch Date header -> ASC date sort (2023-10-15, 2024-01-10, 2024-05-01)
    thButtons[2].click();
    expect(getRowValues(2)).toEqual(['2023-10-15', '2024-01-10', '2024-05-01']);
    expect(thButtons[2].getAttribute('aria-sort')).toBe('ascending');
  });

  it('supports keyboard navigation on header buttons with Enter and Space', () => {
    const spec: TableSpec = {
      type: 'table',
      columns: ['Item', 'Score'],
      rows: [
        ['Alpha', '90'],
        ['Beta', '40'],
      ],
    };

    const card = renderTable(spec, { theme: 'light', onCleanup: () => {} });
    const scoreBtn = card.querySelectorAll<HTMLButtonElement>('.iui-table-th-btn')[1];

    // Trigger Enter keydown
    scoreBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(scoreBtn.getAttribute('aria-sort')).toBe('ascending');

    // Trigger Space keydown
    scoreBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(scoreBtn.getAttribute('aria-sort')).toBe('descending');
  });
});

describe('Table: live filtering for > 6 rows', () => {
  it('does NOT render filter input when rows count <= 6', () => {
    const spec: TableSpec = {
      type: 'table',
      columns: ['Col 1', 'Col 2'],
      rows: [
        ['1', 'A'],
        ['2', 'B'],
        ['3', 'C'],
        ['4', 'D'],
        ['5', 'E'],
        ['6', 'F'],
      ],
    };

    const card = renderTable(spec, { theme: 'light', onCleanup: () => {} });
    expect(card.querySelector('.iui-table-filter-bar')).toBeNull();
    expect(card.querySelector('.iui-table-filter-input')).toBeNull();
  });

  it('renders filter input with search icon when rows count > 6 and filters rows live', () => {
    const spec: TableSpec = {
      type: 'table',
      columns: ['Name', 'Role', 'Status'],
      rows: [
        ['Alice', 'Frontend', 'Active'],
        ['Bob', 'Backend', 'Offline'],
        ['Charlie', 'DevOps', 'Active'],
        ['Diana', 'QA', 'Active'],
        ['Evan', 'Security', 'Inactive'],
        ['Fiona', 'Design', 'Active'],
        ['George', 'Product', 'Active'],
        ['Hannah', 'Backend', 'Active'],
      ],
    };

    const card = renderTable(spec, { theme: 'light', onCleanup: () => {} });
    const filterBar = card.querySelector('.iui-table-filter-bar');
    expect(filterBar).not.toBeNull();

    const filterInput = card.querySelector<HTMLInputElement>('.iui-table-filter-input');
    const filterCount = card.querySelector<HTMLElement>('.iui-table-filter-count');
    expect(filterInput).not.toBeNull();
    expect(filterCount?.textContent).toBe('8 of 8 rows');

    // Search for "Backend"
    filterInput!.value = 'Backend';
    filterInput!.dispatchEvent(new Event('input', { bubbles: true }));

    const trsBackend = card.querySelectorAll('.iui-table-tbody tr');
    expect(trsBackend).toHaveLength(2);
    expect(filterCount?.textContent).toBe('2 of 8 rows');
    expect(trsBackend[0].textContent).toContain('Bob');
    expect(trsBackend[1].textContent).toContain('Hannah');

    // Search for nonexistent term -> shows empty state
    filterInput!.value = 'Nonexistent';
    filterInput!.dispatchEvent(new Event('input', { bubbles: true }));

    const trsNone = card.querySelectorAll('.iui-table-tbody tr');
    expect(trsNone).toHaveLength(1);
    expect(card.querySelector('.iui-table-empty-td')?.textContent).toBe('No matching rows');
    expect(filterCount?.textContent).toBe('0 of 8 rows');

    // Clear filter
    filterInput!.value = '';
    filterInput!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(card.querySelectorAll('.iui-table-tbody tr')).toHaveLength(8);
    expect(filterCount?.textContent).toBe('8 of 8 rows');
  });
});
