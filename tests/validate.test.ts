import { describe, it, expect } from 'vitest';
import { validateSpec, resolveColor, FALLBACK_COLORS } from '../src/core/validate';

describe('validateSpec', () => {
  it('returns unknown type error for invalid or missing type', () => {
    const resultUnknown = validateSpec({ type: 'not_a_ui_type' });
    expect(resultUnknown.ok).toBe(false);
    if (!resultUnknown.ok) {
      expect(resultUnknown.error).toBe('unknown type');
    }

    const resultNull = validateSpec(null);
    expect(resultNull.ok).toBe(false);
    if (!resultNull.ok) {
      expect(resultNull.error).toBe('unknown type');
    }

    const resultEmpty = validateSpec({});
    expect(resultEmpty.ok).toBe(false);
    if (!resultEmpty.ok) {
      expect(resultEmpty.error).toBe('unknown type');
    }
  });

  it('flow alias title->label converts title to label', () => {
    const input = {
      type: 'flow',
      nodes: [
        { id: '1', title: 'Node Title' },
      ],
      edges: [],
    };
    const result = validateSpec(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.type).toBe('flow');
      if (result.spec.type === 'flow') {
        expect(result.spec.nodes[0].label).toBe('Node Title');
      }
    }
  });

  it('missing edge node auto-created in flow', () => {
    const input = {
      type: 'flow',
      nodes: [
        { id: 'a', label: 'Node A' },
      ],
      edges: [
        { from: 'a', to: 'b' },
      ],
    };
    const result = validateSpec(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      if (result.spec.type === 'flow') {
        const nodeB = result.spec.nodes.find((n) => n.id === 'b');
        expect(nodeB).toBeDefined();
        expect(nodeB?.label).toBe('b');
      }
      expect(result.warnings).toContain('Created missing node "b" referenced in edge');
    }
  });

  it('quiz answer out of range error', () => {
    const inputOutOfRange = {
      type: 'quiz',
      questions: [
        {
          q: 'What is 2 + 2?',
          options: ['3', '4'],
          answer: 2,
        },
      ],
    };
    const result = validateSpec(inputOutOfRange);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Quiz answer must be an integer between 0 and 1');
    }

    const inputNegative = {
      type: 'quiz',
      questions: [
        {
          q: 'What is 2 + 2?',
          options: ['3', '4'],
          answer: -1,
        },
      ],
    };
    const resultNeg = validateSpec(inputNegative);
    expect(resultNeg.ok).toBe(false);
    if (!resultNeg.ok) {
      expect(resultNeg.error).toBe('Quiz answer must be an integer between 0 and 1');
    }
  });

  it('table rows padded when row length is less than columns length', () => {
    const input = {
      type: 'table',
      columns: ['Col 1', 'Col 2', 'Col 3'],
      rows: [
        ['A'],
        ['B', 'C'],
        [],
      ],
    };
    const result = validateSpec(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      if (result.spec.type === 'table') {
        expect(result.spec.rows[0]).toEqual(['A', '', '']);
        expect(result.spec.rows[1]).toEqual(['B', 'C', '']);
        expect(result.spec.rows[2]).toEqual(['', '', '']);
      }
    }
  });

  it('chart NaN error on non-numeric or NaN data', () => {
    const inputNaN = {
      type: 'chart',
      chartType: 'bar',
      labels: ['Jan', 'Feb'],
      datasets: [
        {
          label: 'Revenue',
          data: [100, NaN],
        },
      ],
    };
    const resultNaN = validateSpec(inputNaN);
    expect(resultNaN.ok).toBe(false);
    if (!resultNaN.ok) {
      expect(resultNaN.error).toBe('Invalid chart data: NaN encountered');
    }

    const inputInvalidString = {
      type: 'chart',
      chartType: 'bar',
      labels: ['Jan', 'Feb'],
      datasets: [
        {
          label: 'Revenue',
          data: [100, 'not-a-number'],
        },
      ],
    };
    const resultStr = validateSpec(inputInvalidString);
    expect(resultStr.ok).toBe(false);
    if (!resultStr.ok) {
      expect(resultStr.error).toBe('Invalid chart data: NaN encountered');
    }
  });

  it('compare panels alias uses panels as items', () => {
    const input = {
      type: 'compare',
      panels: [
        { label: 'Option A', tone: 'good', points: ['Fast', 'Reliable'] },
        { title: 'Option B', tone: 'bad', points: ['Slow'] },
      ],
    };
    const result = validateSpec(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.type).toBe('compare');
      if (result.spec.type === 'compare') {
        expect(result.spec.items).toHaveLength(2);
        expect(result.spec.items[0]).toEqual({
          label: 'Option A',
          tone: 'good',
          points: ['Fast', 'Reliable'],
        });
        expect(result.spec.items[1]).toEqual({
          label: 'Option B',
          tone: 'bad',
          points: ['Slow'],
        });
      }
    }
  });

  it('stable colour fallback deterministically maps invalid colors or seeds', () => {
    const color1 = resolveColor('invalid_color_name', 'node_alpha');
    const color2 = resolveColor('invalid_color_name', 'node_alpha');
    const color3 = resolveColor(undefined, 'node_alpha');

    expect(FALLBACK_COLORS).toContain(color1);
    expect(color1).toBe(color2);
    expect(color1).toBe(color3);

    const input = {
      type: 'flow',
      nodes: [
        { id: 'node_alpha', label: 'Alpha', color: 'invalid_color_name' },
      ],
      edges: [],
    };
    const result = validateSpec(input);
    expect(result.ok).toBe(true);
    if (result.ok && result.spec.type === 'flow') {
      expect(FALLBACK_COLORS).toContain(result.spec.nodes[0].color);
      expect(result.spec.nodes[0].color).toBe(color1);
    }
  });
});
