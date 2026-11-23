import { StepperSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { renderMathText } from '../core/mathParser';

export function stripStepTitleNumber(title: string): string {
  return (title || '').replace(/^\s*(step\s*)?\d+\s*[.):-]\s*/i, '').trim();
}

export function renderStepper(spec: StepperSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-stepper-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const steps = spec.steps || [];
  const list = h('div', { class: 'iui-stepper-list' });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isLast = i === steps.length - 1;

    const stepEl = h('div', { class: 'iui-stepper-step' });
    stepEl.style.setProperty('--step-idx', String(i));

    // Left track: 20px circle in sky pastel + 1px rail
    const track = h('div', { class: 'iui-stepper-track' });
    const circle = h('div', { class: 'iui-stepper-circle c-sky' }, String(i + 1));
    track.appendChild(circle);

    if (!isLast) {
      const line = h('div', { class: 'iui-stepper-line' });
      track.appendChild(line);
    }
    stepEl.appendChild(track);

    // Right content: clean title + always visible detail
    const content = h('div', { class: `iui-stepper-content${isLast ? ' is-last' : ''}` });

    const cleanTitle = stripStepTitleNumber(step.title);
    const titleEl = h('div', { class: 'iui-stepper-title' });
    renderMathText(titleEl, cleanTitle);
    content.appendChild(titleEl);

    if (step.detail !== undefined && step.detail !== '') {
      const detailEl = h('div', { class: 'iui-stepper-detail' });
      renderMathText(detailEl, step.detail);
      content.appendChild(detailEl);
    }

    stepEl.appendChild(content);
    list.appendChild(stepEl);
  }

  card.appendChild(list);
  return card;
}
