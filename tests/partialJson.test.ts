import { describe, it, expect } from 'vitest';
import { parsePartialJson, cleanJsonPrefix } from '../src/core/partialJson';

describe('cleanJsonPrefix', () => {
  it('strips ```ui and ``` fences', () => {
    expect(cleanJsonPrefix('```ui\n{"type":"table"}\n```')).toBe('{"type":"table"}');
    expect(cleanJsonPrefix('```json\n{"type":"table"}\n```')).toBe('{"type":"table"}');
    expect(cleanJsonPrefix('ui\n{"type":"table"}')).toBe('{"type":"table"}');
  });

  it('handles empty or whitespace string', () => {
    expect(cleanJsonPrefix('')).toBe('');
    expect(cleanJsonPrefix('   ')).toBe('');
  });
});

describe('parsePartialJson', () => {
  it('parses complete valid JSON directly', () => {
    const raw = '{"type":"table","title":"Test","columns":["A"],"rows":[["1"]]}';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value).toEqual({
      type: 'table',
      title: 'Test',
      columns: ['A'],
      rows: [['1']],
    });
  });

  it('auto-closes open string at the end of key', () => {
    const raw = '{"type":"tab';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value).toEqual({ type: 'tab' });
  });

  it('auto-closes open string at the end of value', () => {
    const raw = '{"type":"table","title":"Capacity est';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value.type).toBe('table');
    expect(res.value.title).toBe('Capacity est');
  });

  it('handles truncation right after a colon', () => {
    const raw = '{"type":"table","title":';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value.type).toBe('table');
    expect(res.value.title).toBe('');
  });

  it('handles truncation right after a comma', () => {
    const raw = '{"type":"table","title":"Capacities",';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value).toEqual({ type: 'table', title: 'Capacities' });
  });

  it('handles unclosed arrays in columns', () => {
    const raw = '{"type":"table","columns":["Metric","Value';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value.type).toBe('table');
    expect(res.value.columns).toEqual(['Metric', 'Value']);
  });

  it('handles nested unclosed arrays in table rows', () => {
    const raw = '{"type":"table","columns":["Metric","Value"],"rows":[["Uptime","99.9%"],["Reads","100M';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value.type).toBe('table');
    expect(res.value.rows).toEqual([['Uptime', '99.9%'], ['Reads', '100M']]);
  });

  it('handles unclosed objects inside array (stepper steps)', () => {
    const raw = '{"type":"stepper","steps":[{"title":"Step 1","detail":"First"},{"title":"Step 2';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value.type).toBe('stepper');
    expect(res.value.steps[0].title).toBe('Step 1');
    expect(res.value.steps[1].title).toBe('Step 2');
  });

  it('handles flow nodes and edges cut off midway', () => {
    const raw = '{"type":"flow","nodes":[{"id":"a","label":"Node A"},{"id":"b","label":"Node B"}],"edges":[{"from":"a","to":"b';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value.type).toBe('flow');
    expect(res.value.nodes).toHaveLength(2);
    expect(res.value.edges).toHaveLength(1);
    expect(res.value.edges[0]).toEqual({ from: 'a', to: 'b' });
  });

  it('handles trailing escape characters safely', () => {
    const raw = '{"type":"callout","text":"Line break \\';
    const res = parsePartialJson(raw);
    expect(res.ok).toBe(true);
    expect(res.value.type).toBe('callout');
    expect(res.value.text).toBe('Line break ');
  });

  it('handles cut off inside new component types: stats, tabs, timeline, followups', () => {
    const statsRaw = '{"type":"stats","items":[{"label":"Metric 1","value":100},{"label":"Metric 2","val';
    const statsRes = parsePartialJson(statsRaw);
    expect(statsRes.ok).toBe(true);
    expect(statsRes.value.type).toBe('stats');
    expect(statsRes.value.items[0]).toEqual({ label: 'Metric 1', value: 100 });

    const tabsRaw = '{"type":"tabs","tabs":[{"label":"T1","content":"C1"},{"label":"T2","content":["Item 1","Item 2';
    const tabsRes = parsePartialJson(tabsRaw);
    expect(tabsRes.ok).toBe(true);
    expect(tabsRes.value.type).toBe('tabs');
    expect(tabsRes.value.tabs[1].content).toEqual(['Item 1', 'Item 2']);

    const timelineRaw = '{"type":"timeline","events":[{"title":"Alpha","text":"Start"},{"title":"Beta';
    const timeRes = parsePartialJson(timelineRaw);
    expect(timeRes.ok).toBe(true);
    expect(timeRes.value.events[0].title).toBe('Alpha');
    expect(timeRes.value.events[1].title).toBe('Beta');

    const followRaw = '{"type":"followups","suggestions":["Ask more","Clarify code';
    const followRes = parsePartialJson(followRaw);
    expect(followRes.ok).toBe(true);
    expect(followRes.value.suggestions).toEqual(['Ask more', 'Clarify code']);
  });

  it('survives streaming slicing in 10-char increments across a full sample without throwing', () => {
    const fullSample = JSON.stringify({
      type: 'table',
      title: 'Performance Benchmarks',
      columns: ['Framework', 'Speed', 'Memory'],
      rows: [
        ['BetterView', '1.2ms', '12MB'],
        ['ChatGPT UI', '45ms', '80MB'],
        ['Gemini Web', '30ms', '65MB'],
      ],
    });

    for (let i = 15; i <= fullSample.length; i += 10) {
      const slice = fullSample.slice(0, i);
      const res = parsePartialJson(slice);
      if (res.ok) {
        expect(res.value).toBeDefined();
        expect(typeof res.value).toBe('object');
        expect(res.value.type).toBe('table');
      }
    }
  });
});
