import { MathSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { renderLatexInto, renderMathText } from '../core/mathParser';

export function renderMath(spec: MathSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-math-card' });

  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  // Primary formula display
  const mainFormula = h('div', {
    class: 'iui-math-main',
    role: 'region',
    'aria-label': spec.title || 'Mathematical formula',
  });
  mainFormula.textContent = spec.latex; // placeholder
  renderLatexInto(mainFormula, spec.latex, true);
  card.appendChild(mainFormula);

  // Optional derivation steps
  if (spec.steps && spec.steps.length > 0) {
    const stepsWrap = h('div', { class: 'iui-math-steps' });
    const stepsTitle = h('div', { class: 'iui-math-steps-title' }, 'Derivation Steps');
    stepsWrap.appendChild(stepsTitle);

    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i];
      const stepRow = h('div', { class: 'iui-math-step' });

      const stepNum = h('div', { class: 'iui-math-step-num' }, String(i + 1));
      stepRow.appendChild(stepNum);

      const stepBody = h('div', { class: 'iui-math-step-body' });
      const formulaEl = h('div', { class: 'iui-math-step-formula' });
      formulaEl.textContent = step.latex;
      renderLatexInto(formulaEl, step.latex, true);
      stepBody.appendChild(formulaEl);

      if (step.note) {
        const noteEl = h('div', { class: 'iui-math-step-note' });
        renderMathText(noteEl, step.note);
        stepBody.appendChild(noteEl);
      }

      stepRow.appendChild(stepBody);
      stepsWrap.appendChild(stepRow);
    }

    card.appendChild(stepsWrap);
  }

  return card;
}
