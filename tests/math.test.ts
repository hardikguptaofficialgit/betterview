// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  parseMathDelimiters,
  hasMathDelimiters,
  renderMathText,
} from '../src/core/mathParser';
import { renderMath } from '../src/components/math';
import { MathSpec } from '../src/core/types';

describe('Math delimiter parser: parseMathDelimiters', () => {
  it('parses inline math delimited by $...$', () => {
    const text = 'Einstein gave us $E = mc^2$ in physics.';
    const tokens = parseMathDelimiters(text);

    expect(tokens).toEqual([
      { type: 'text', text: 'Einstein gave us ' },
      { type: 'inline-math', latex: 'E = mc^2', raw: '$E = mc^2$' },
      { type: 'text', text: ' in physics.' },
    ]);
  });

  it('parses display math delimited by $$...$$', () => {
    const text = 'Euler identity is: $$\\mathrm{e}^{i\\pi} + 1 = 0$$ beautiful!';
    const tokens = parseMathDelimiters(text);

    expect(tokens).toEqual([
      { type: 'text', text: 'Euler identity is: ' },
      { type: 'display-math', latex: '\\mathrm{e}^{i\\pi} + 1 = 0', raw: '$$\\mathrm{e}^{i\\pi} + 1 = 0$$' },
      { type: 'text', text: ' beautiful!' },
    ]);
  });

  it('parses multiple mixed inline and display math tokens', () => {
    const text = 'Given $a$ and $b$, we have $$a^2 + b^2 = c^2$$ which implies $c = \\sqrt{a^2 + b^2}$.';
    const tokens = parseMathDelimiters(text);

    expect(tokens).toHaveLength(9);
    expect(tokens[1]).toEqual({ type: 'inline-math', latex: 'a', raw: '$a$' });
    expect(tokens[3]).toEqual({ type: 'inline-math', latex: 'b', raw: '$b$' });
    expect(tokens[5]).toEqual({ type: 'display-math', latex: 'a^2 + b^2 = c^2', raw: '$$a^2 + b^2 = c^2$$' });
    expect(tokens[7]).toEqual({ type: 'inline-math', latex: 'c = \\sqrt{a^2 + b^2}', raw: '$c = \\sqrt{a^2 + b^2}$' });
  });

  it('handles escaped dollars \\$ as literal text', () => {
    const text = 'The fee is \\$50 per unit.';
    const tokens = parseMathDelimiters(text);

    expect(tokens).toEqual([
      { type: 'text', text: 'The fee is $50 per unit.' },
    ]);
  });

  it('does not parse single lone currency dollars like $500 as math', () => {
    const text = 'The total cost is $500 today.';
    const tokens = parseMathDelimiters(text);

    expect(tokens).toEqual([
      { type: 'text', text: 'The total cost is $500 today.' },
    ]);
  });

  it('rejects space-padded dollars like "$ x $" from inline math', () => {
    const text = 'This is $ not math $ because of spaces.';
    const tokens = parseMathDelimiters(text);

    expect(tokens).toEqual([
      { type: 'text', text: 'This is $ not math $ because of spaces.' },
    ]);
  });

  it('hasMathDelimiters detects math presence accurately', () => {
    expect(hasMathDelimiters('No math here')).toBe(false);
    expect(hasMathDelimiters('Price is $100')).toBe(false);
    expect(hasMathDelimiters('Formula $x^2$')).toBe(true);
    expect(hasMathDelimiters('Equation $$\\alpha + \\beta$$')).toBe(true);
  });
});

describe('Math Component: renderMath', () => {
  it('renders primary formula in display box', () => {
    const spec: MathSpec = {
      type: 'math',
      title: 'Quadratic Formula',
      latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    };

    const card = renderMath(spec, { theme: 'light', onCleanup: () => {} });
    expect(card.classList.contains('iui-card')).toBe(true);
    expect(card.classList.contains('iui-math-card')).toBe(true);

    const mainFormula = card.querySelector('.iui-math-main');
    expect(mainFormula).not.toBeNull();
    expect(mainFormula?.textContent).toContain('x =');
  });

  it('renders derivation steps with numbered badges, formula, and notes', () => {
    const spec: MathSpec = {
      type: 'math',
      title: 'Derivation',
      latex: 'a^2 + b^2 = c^2',
      steps: [
        {
          latex: 'a^2 + b^2',
          note: 'Sum of squares',
        },
        {
          latex: 'c^2',
          note: 'Hypotenuse squared',
        },
      ],
    };

    const card = renderMath(spec, { theme: 'light', onCleanup: () => {} });
    const stepsWrap = card.querySelector('.iui-math-steps');
    expect(stepsWrap).not.toBeNull();

    const stepRows = card.querySelectorAll('.iui-math-step');
    expect(stepRows).toHaveLength(2);

    expect(stepRows[0].querySelector('.iui-math-step-num')?.textContent).toBe('1');
    expect(stepRows[0].querySelector('.iui-math-step-note')?.textContent).toContain('Sum of squares');

    expect(stepRows[1].querySelector('.iui-math-step-num')?.textContent).toBe('2');
    expect(stepRows[1].querySelector('.iui-math-step-note')?.textContent).toContain('Hypotenuse squared');
  });
});
