// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { diffChildren, diffAndAppendChildren } from '../src/core/incremental';

describe('diffChildren', () => {
  it('identifies new items when existing set is empty', () => {
    const existing = new Set<string | number>();
    const items = ['apple', 'banana', 'cherry'];
    const diff = diffChildren(existing, items, (it) => it);

    expect(diff.added).toHaveLength(3);
    expect(diff.added.map((a) => a.item)).toEqual(['apple', 'banana', 'cherry']);
    expect(existing.size).toBe(3);
  });

  it('returns only appended new items when some keys already exist', () => {
    const existing = new Set<string | number>(['apple', 'banana']);
    const incoming = ['apple', 'banana', 'cherry', 'date'];
    const diff = diffChildren(existing, incoming, (it) => it);

    expect(diff.added).toHaveLength(2);
    expect(diff.added.map((a) => a.item)).toEqual(['cherry', 'date']);
    expect(existing.has('cherry')).toBe(true);
    expect(existing.has('date')).toBe(true);
  });

  it('returns empty added array when no new keys are present', () => {
    const existing = new Set<string | number>([0, 1, 2]);
    const incoming = ['A', 'B', 'C'];
    const diff = diffChildren(existing, incoming, (_it, i) => i);

    expect(diff.added).toHaveLength(0);
    expect(diff.existingCount).toBe(3);
  });

  it('supports diffing flow nodes by unique id', () => {
    const existing = new Set<string | number>(['node-1']);
    const nodes = [
      { id: 'node-1', label: 'Client' },
      { id: 'node-2', label: 'API' },
      { id: 'node-3', label: 'DB' },
    ];
    const diff = diffChildren(existing, nodes, (n) => n.id);

    expect(diff.added).toHaveLength(2);
    expect(diff.added[0].item.id).toBe('node-2');
    expect(diff.added[1].item.id).toBe('node-3');
  });
});

describe('diffAndAppendChildren', () => {
  it('appends only new elements into container without touching existing ones', () => {
    const container = document.createElement('tbody');
    const existingKeys = new Set<string | number>();

    // Initial batch of 2 rows
    const batch1 = [['A1', 'B1'], ['A2', 'B2']];
    const addedElements1 = diffAndAppendChildren(
      container,
      existingKeys,
      batch1,
      (_row, idx) => idx,
      (row) => {
        const tr = document.createElement('tr');
        tr.textContent = row.join(' | ');
        return tr;
      },
    );

    expect(container.children).toHaveLength(2);
    expect(addedElements1).toHaveLength(2);
    const firstRowEl = container.children[0];

    // Second batch with 3 rows (first 2 identical, 1 new)
    const batch2 = [['A1', 'B1'], ['A2', 'B2'], ['A3', 'B3']];
    const addedElements2 = diffAndAppendChildren(
      container,
      existingKeys,
      batch2,
      (_row, idx) => idx,
      (row) => {
        const tr = document.createElement('tr');
        tr.textContent = row.join(' | ');
        return tr;
      },
    );

    // Total children is 3
    expect(container.children).toHaveLength(3);
    // Only 1 newly appended element
    expect(addedElements2).toHaveLength(1);
    // Crucial: The first DOM node was NOT re-created or replaced!
    expect(container.children[0]).toBe(firstRowEl);
    expect(container.children[2].textContent).toBe('A3 | B3');
  });
});
