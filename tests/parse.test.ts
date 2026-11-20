import { describe, it, expect } from 'vitest';
import { tryParse, looksLikeUiBlock } from '../src/core/parse';

describe('tryParse', () => {
  it('handles trailing commas in objects and arrays', () => {
    const input = `{
      "type": "table",
      "columns": ["Col A", "Col B",],
      "rows": [
        ["1", "2",],
      ],
    }`;
    const result = tryParse(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'table',
        columns: ['Col A', 'Col B'],
        rows: [['1', '2']],
      });
    }
  });

  it('handles a leading json line', () => {
    const input = `json
    {
      "type": "stepper",
      "steps": [{"title": "Step 1"}]
    }`;
    const result = tryParse(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'stepper',
        steps: [{ title: 'Step 1' }],
      });
    }
  });

  it('handles curly quotes', () => {
    const input = `{
      “type”: “quiz”,
      “questions”: [
        {
          “q”: “What is it?”,
          “options”: [“Yes”, “No”],
          “answer”: 0
        }
      ]
    }`;
    const result = tryParse(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'quiz',
        questions: [
          {
            q: 'What is it?',
            options: ['Yes', 'No'],
            answer: 0,
          },
        ],
      });
    }
  });

  it('partial string gives ok:false with typeHint', () => {
    const input = '{"type": "table", "columns": ["Col 1", "Col 2"';
    const result = tryParse(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.typeHint).toBe('table');
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe('looksLikeUiBlock', () => {
  it('returns true for text that looks like a UI block', () => {
    expect(looksLikeUiBlock('{"type": "flow", "nodes": []}')).toBe(true);
    expect(looksLikeUiBlock('  { "type": "table", "columns": [] } ')).toBe(true);
    expect(looksLikeUiBlock('{\n  “type”: “stepper”\n}')).toBe(true);
  });

  it('returns false for text that does not look like a UI block', () => {
    expect(looksLikeUiBlock('{"type": "unknown_type"}')).toBe(false);
    expect(looksLikeUiBlock('{"name": "test"}')).toBe(false);
    expect(looksLikeUiBlock('Hello world')).toBe(false);
    expect(looksLikeUiBlock('[{"type": "flow"}]')).toBe(false);
    expect(looksLikeUiBlock('')).toBe(false);
  });
});
