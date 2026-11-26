import { StepperSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';
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
  const totalSteps = steps.length;

  let completedCount = 0;
  const completedSet = new Set<number>();

  // Progress bar
  const progressWrap = h('div', { class: 'iui-stepper-progress-wrap', 'aria-hidden': 'true' });
  const progressFill = h('div', { class: 'iui-stepper-progress-fill' });
  progressFill.style.width = '0%';
  progressWrap.appendChild(progressFill);
  card.appendChild(progressWrap);

  function updateProgress(): void {
    const pct = totalSteps > 0 ? Math.round((completedSet.size / totalSteps) * 100) : 0;
    progressFill.style.width = `${pct}%`;
  }

  const list = h('div', { class: 'iui-stepper-list' });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isLast = i === steps.length - 1;

    const stepEl = h('div', { class: 'iui-stepper-step' });
    stepEl.style.setProperty('--step-idx', String(i));

    // Left track: 20px circle in sky pastel + 1px rail
    const track = h('div', { class: 'iui-stepper-track' });
    const circle = h(
      'button',
      {
        type: 'button',
        class: 'iui-stepper-circle c-sky',
        'aria-label': `Mark step ${i + 1} complete`,
        'aria-pressed': 'false',
        onClick: () => {
          const isCompleted = completedSet.has(i);
          if (isCompleted) {
            completedSet.delete(i);
            circle.setAttribute('aria-pressed', 'false');
            circle.classList.remove('is-done');
            circle.textContent = '';
            circle.appendChild(h('span', {}, String(i + 1)));
            stepEl.classList.remove('is-completed');
          } else {
            completedSet.add(i);
            circle.setAttribute('aria-pressed', 'true');
            circle.classList.add('is-done');
            circle.textContent = '';
            circle.appendChild(iconEl('check', 11));
            stepEl.classList.add('is-completed');
          }
          updateProgress();
        },
      },
      String(i + 1),
    ) as HTMLButtonElement;

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
