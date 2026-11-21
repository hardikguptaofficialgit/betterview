import { describe, it, expect } from 'vitest';
import { validateSpec, resolveColor, FALLBACK_COLORS } from '../src/core/validate';

describe('validateSpec', () => {
  it('returns unknown type error for invalid or missing type', () => {
    // Unknown string type now falls back to generic card (ok: true)
    const resultUnknown = validateSpec({ type: 'not_a_ui_type' });
    expect(resultUnknown.ok).toBe(true);
    if (resultUnknown.ok) {
      expect(resultUnknown.spec.type).toBe('generic');
    }

    // null/non-object: still fails
    const resultNull = validateSpec(null);
    expect(resultNull.ok).toBe(false);
    if (!resultNull.ok) {
      expect(resultNull.error).toBe('unknown type');
    }

    // empty object (no type field): still fails
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

  describe('new component types validation', () => {
    it('validates callout with valid tones and defaults invalid tone to info', () => {
      const validCallout = validateSpec({
        type: 'callout',
        title: 'Heads Up',
        tone: 'warning',
        text: 'This is an important advisory.',
      });
      expect(validCallout.ok).toBe(true);
      if (validCallout.ok) {
        expect(validCallout.spec.type).toBe('callout');
        if (validCallout.spec.type === 'callout') {
          expect(validCallout.spec.tone).toBe('warning');
          expect(validCallout.spec.text).toBe('This is an important advisory.');
        }
      }

      const invalidTone = validateSpec({
        type: 'callout',
        tone: 'unknown_tone',
        text: 'Fallback to info',
      });
      expect(invalidTone.ok).toBe(true);
      if (invalidTone.ok && invalidTone.spec.type === 'callout') {
        expect(invalidTone.spec.tone).toBe('info');
        expect(invalidTone.warnings).toContain('Invalid callout tone "unknown_tone", defaulting to info');
      }

      const missingText = validateSpec({
        type: 'callout',
        tone: 'tip',
      });
      expect(missingText.ok).toBe(false);
      if (!missingText.ok) {
        expect(missingText.error).toBe('callout must have non-empty text');
      }
    });

    it('validates stats with 2-4 metric cards and caps at 4', () => {
      const validStats = validateSpec({
        type: 'stats',
        title: 'KPI Scorecard',
        items: [
          { label: 'Uptime', value: '99.9%', delta: '+0.1%', hint: 'Last 30d' },
          { label: 'Latency', value: 18, hint: 'p99 ms' },
        ],
      });
      expect(validStats.ok).toBe(true);
      if (validStats.ok && validStats.spec.type === 'stats') {
        expect(validStats.spec.items).toHaveLength(2);
        expect(validStats.spec.items[0].label).toBe('Uptime');
        expect(validStats.spec.items[1].value).toBe(18);
      }

      const tooFewStats = validateSpec({
        type: 'stats',
        items: [{ label: 'Only One', value: 100 }],
      });
      expect(tooFewStats.ok).toBe(false);
      if (!tooFewStats.ok) {
        expect(tooFewStats.error).toBe('stats must have 2-4 metric cards');
      }

      const fiveStats = validateSpec({
        type: 'stats',
        items: [
          { label: 'M1', value: 1 },
          { label: 'M2', value: 2 },
          { label: 'M3', value: 3 },
          { label: 'M4', value: 4 },
          { label: 'M5', value: 5 },
        ],
      });
      expect(fiveStats.ok).toBe(true);
      if (fiveStats.ok && fiveStats.spec.type === 'stats') {
        expect(fiveStats.spec.items).toHaveLength(4);
        expect(fiveStats.warnings).toContain('Stats items capped at 4');
      }
    });

    it('validates tabs with string or array content', () => {
      const validTabs = validateSpec({
        type: 'tabs',
        title: 'Architecture Options',
        tabs: [
          { label: 'REST API', content: 'Simple HTTP endpoint architecture.' },
          { label: 'gRPC', content: ['Binary protobuf', 'Multiplexed HTTP/2', 'Streaming support'] },
        ],
      });
      expect(validTabs.ok).toBe(true);
      if (validTabs.ok && validTabs.spec.type === 'tabs') {
        expect(validTabs.spec.tabs).toHaveLength(2);
        expect(Array.isArray(validTabs.spec.tabs[1].content)).toBe(true);
      }

      const emptyTabs = validateSpec({
        type: 'tabs',
        tabs: [],
      });
      expect(emptyTabs.ok).toBe(false);
      if (!emptyTabs.ok) {
        expect(emptyTabs.error).toBe('tabs must have at least 1 tab');
      }
    });

    it('validates timeline events and requires non-empty titles', () => {
      const validTimeline = validateSpec({
        type: 'timeline',
        title: 'Deployment Phases',
        events: [
          { title: 'Alpha Canary', time: 'Day 1', text: '1% traffic routed to v2' },
          { title: 'Full Rollout', time: 'Day 3', text: '100% traffic live' },
        ],
      });
      expect(validTimeline.ok).toBe(true);
      if (validTimeline.ok && validTimeline.spec.type === 'timeline') {
        expect(validTimeline.spec.events).toHaveLength(2);
        expect(validTimeline.spec.events[0].time).toBe('Day 1');
      }

      const emptyEvents = validateSpec({
        type: 'timeline',
        events: [],
      });
      expect(emptyEvents.ok).toBe(false);
      if (!emptyEvents.ok) {
        expect(emptyEvents.error).toBe('timeline must have at least 1 event');
      }
    });

    it('validates followups with 2-4 suggestion chips', () => {
      const validFollowups = validateSpec({
        type: 'followups',
        title: 'Next steps',
        suggestions: ['How to scale to 10M users?', 'Compare with Kafka', 'Show deployment YAML'],
      });
      expect(validFollowups.ok).toBe(true);
      if (validFollowups.ok && validFollowups.spec.type === 'followups') {
        expect(validFollowups.spec.suggestions).toHaveLength(3);
      }

      const singleFollowup = validateSpec({
        type: 'followups',
        suggestions: ['Just one'],
      });
      expect(singleFollowup.ok).toBe(false);
      if (!singleFollowup.ok) {
        expect(singleFollowup.error).toBe('followups must have 2-4 suggestion chips');
      }

      const fiveFollowups = validateSpec({
        type: 'followups',
        suggestions: ['S1', 'S2', 'S3', 'S4', 'S5'],
      });
      expect(fiveFollowups.ok).toBe(true);
      if (fiveFollowups.ok && fiveFollowups.spec.type === 'followups') {
        expect(fiveFollowups.spec.suggestions).toHaveLength(4);
        expect(fiveFollowups.warnings).toContain('Followup suggestions capped at 4');
      }
    });

    it('validates checklist items, aliases, details and completion state', () => {
      const valid = validateSpec({
        type: 'checklist',
        title: 'Release prep',
        items: [
          'Write release notes',
          { text: 'Run tests', detail: 'Unit and integration', checked: true },
          { label: 'Deploy', checked: false },
        ],
      });
      expect(valid.ok).toBe(true);
      if (valid.ok && valid.spec.type === 'checklist') {
        expect(valid.spec.items).toEqual([
          { text: 'Write release notes' },
          { text: 'Run tests', detail: 'Unit and integration', checked: true },
          { text: 'Deploy', checked: false },
        ]);
      }
      const empty = validateSpec({ type: 'checklist', items: [] });
      expect(empty.ok).toBe(false);
    });

    it('validates form field types, options, required state and safe ids', () => {
      const valid = validateSpec({
        type: 'form', title: 'Preferences', description: 'Choose a plan',
        fields: [
          { id: 'name', label: 'Name', type: 'text', required: true },
          { id: 'plan', label: 'Plan', type: 'select', options: ['Free', 'Pro'], value: 'Pro' },
          { id: 'range', label: 'Budget', type: 'range', min: 1, max: 10, step: 1 },
        ],
      });
      expect(valid.ok).toBe(true);
      if (valid.ok && valid.spec.type === 'form') {
        expect(valid.spec.fields).toHaveLength(3);
        expect(valid.spec.fields[0].required).toBe(true);
        expect(valid.spec.fields[1].options).toEqual(['Free', 'Pro']);
        expect(valid.spec.fields[2].max).toBe(10);
      }
      expect(validateSpec({ type: 'form', fields: [{ label: 'Plan', type: 'select', options: ['Only one'] }] }).ok).toBe(false);
      expect(validateSpec({ type: 'form', fields: [{ label: 'Bad', type: 'password' }] }).ok).toBe(false);
      expect(validateSpec({ type: 'form', fields: [{ label: 'Bad range', type: 'range', min: 9, max: 2 }] }).ok).toBe(false);
      expect(validateSpec({ type: 'form', fields: [{ label: 'Plan', type: 'radio', options: ['Free', 'Pro'], value: 'Ultra' }] }).ok).toBe(false);
    });
  });

  it('quiz tolerant parsing: letter answer (A/B), items alias, choices alias, explanation alias', () => {
    // Letter answer "A" -> index 0
    const letterA = validateSpec({
      type: 'quiz',
      questions: [{ q: 'Q?', options: ['Yes', 'No'], answer: 'A' }],
    });
    expect(letterA.ok).toBe(true);
    if (letterA.ok && letterA.spec.type === 'quiz') {
      expect(letterA.spec.questions[0].answer).toBe(0);
    }

    // Letter answer "B" -> index 1
    const letterB = validateSpec({
      type: 'quiz',
      questions: [{ q: 'Q?', options: ['Yes', 'No'], answer: 'B' }],
    });
    expect(letterB.ok).toBe(true);
    if (letterB.ok && letterB.spec.type === 'quiz') {
      expect(letterB.spec.questions[0].answer).toBe(1);
    }

    // correctAnswer alias
    const correctAnswer = validateSpec({
      type: 'quiz',
      questions: [{ q: 'Q?', options: ['Yes', 'No'], correctAnswer: 1 }],
    });
    expect(correctAnswer.ok).toBe(true);
    if (correctAnswer.ok && correctAnswer.spec.type === 'quiz') {
      expect(correctAnswer.spec.questions[0].answer).toBe(1);
    }

    // items alias for questions
    const itemsAlias = validateSpec({
      type: 'quiz',
      items: [{ q: 'Q?', options: ['Yes', 'No'], answer: 0 }],
    });
    expect(itemsAlias.ok).toBe(true);
    if (itemsAlias.ok && itemsAlias.spec.type === 'quiz') {
      expect(itemsAlias.spec.questions).toHaveLength(1);
    }

    // explanation alias for explain
    const explainAlias = validateSpec({
      type: 'quiz',
      questions: [{ q: 'Q?', options: ['Yes', 'No'], answer: 0, explanation: 'Because yes.' }],
    });
    expect(explainAlias.ok).toBe(true);
    if (explainAlias.ok && explainAlias.spec.type === 'quiz') {
      expect(explainAlias.spec.questions[0].explain).toBe('Because yes.');
    }

    // option objects with text field
    const optionObjects = validateSpec({
      type: 'quiz',
      questions: [{ q: 'Q?', options: [{ text: 'Alpha' }, { text: 'Beta' }], answer: 0 }],
    });
    expect(optionObjects.ok).toBe(true);
    if (optionObjects.ok && optionObjects.spec.type === 'quiz') {
      expect(optionObjects.spec.questions[0].options).toEqual(['Alpha', 'Beta']);
    }
  });

  it('unknown type falls back to generic card instead of failing', () => {
    const result = validateSpec({ type: 'quiz_game', title: 'Fun quiz', data: [1, 2, 3] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.type).toBe('generic');
      expect(result.spec.title).toBe('Fun quiz');
    }

    // No type field still fails
    const noType = validateSpec({ foo: 'bar' });
    expect(noType.ok).toBe(false);

    // null still fails
    const nullResult = validateSpec(null);
    expect(nullResult.ok).toBe(false);
  });

  it('validates user screenshot quiz with numeric-option text answer ("4096")', () => {
    const userQuiz = {
      type: 'quiz',
      title: 'URL Shortener & Distributed IDs Quiz',
      questions: [
        {
          q: 'In a URL shortener, which approach is generally preferred for generating short codes at high scale?',
          options: [
            'Hash the long URL and take the first few characters',
            'Base62-encode a distributed unique ID (e.g. Snowflake)',
            'Use a single central auto-increment sequence',
            'Generate a random UUID and truncate it',
          ],
          answer: 'Base62-encode a distributed unique ID (e.g. Snowflake)',
          explain:
            'ID + Base62 guarantees uniqueness with no collisions and produces compact, predictable codes.',
        },
        {
          q: 'In classic Twitter Snowflake, how many IDs can a single worker generate per millisecond?',
          options: ['1024', '2048', '4096', '8192'],
          answer: '4096',
          explain: '12 bits are allocated to the sequence number -> 2^12 = 4096 IDs per millisecond per worker.',
        },
        {
          q: 'What is the main reason redirects in a URL shortener are heavily cached?',
          options: [
            'To reduce storage costs',
            'Redirects are extremely read-heavy and latency-sensitive',
            'To enforce expiration',
            'To prevent duplicate short codes',
          ],
          answer: 'Redirects are extremely read-heavy and latency-sensitive',
          explain: 'Redirect QPS is usually orders of magnitude higher than creation QPS.',
        },
        {
          q: 'What is the biggest operational challenge with Snowflake-style generators?',
          options: ['Worker ID collisions', 'Clock skew / clock moving backward', '64-bit integer size'],
          answer: 'Clock skew / clock moving backward',
          explain: 'Because the timestamp is part of the ID, a backward clock jump can cause duplicate or out-of-order IDs.',
        },
        {
          q: 'For a 7-character Base62 short code, roughly how many unique values are possible?',
          options: ['~1 million', '~3.5 billion', '~3.5 trillion', '~62 billion'],
          answer: '~3.5 trillion',
          explain: '62^7 ≈ 3.5 × 10^12 (3.5 trillion). This is more than enough for most URL shorteners for many years.',
        },
      ],
    };

    const res = validateSpec(userQuiz);
    expect(res.ok).toBe(true);
    if (res.ok && res.spec.type === 'quiz') {
      expect(res.spec.questions).toHaveLength(5);
      expect(res.spec.questions[0].answer).toBe(1);
      expect(res.spec.questions[1].answer).toBe(2); // 4096 is at index 2!
      expect(res.spec.questions[2].answer).toBe(1);
      expect(res.spec.questions[3].answer).toBe(1);
      expect(res.spec.questions[4].answer).toBe(2);
    }
  });
});
