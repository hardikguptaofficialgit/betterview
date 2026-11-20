import { StepperSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';
import { iconEl } from '../core/icons';

export function renderStepper(spec: StepperSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-stepper-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const steps = spec.steps || [];
  const list = h('div', { class: 'iui-stepper-list' });
  const startsExpanded = steps.length <= 4;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isLast = i === steps.length - 1;

    const stepEl = h('div', { class: 'iui-stepper-step' });

    // Left track: circle in sky pastel + connecting line
    const track = h('div', { class: 'iui-stepper-track' });
    const circle = h('div', { class: 'iui-stepper-circle c-sky' }, String(i + 1));
    track.appendChild(circle);

    if (!isLast) {
      const line = h('div', { class: 'iui-stepper-line' });
      track.appendChild(line);
    }
    stepEl.appendChild(track);

    // Right content
    const content = h('div', { class: `iui-stepper-content${isLast ? ' is-last' : ''}` });

    if (step.detail !== undefined && step.detail !== '') {
      let isExpanded = startsExpanded;
      const chevronSpan = h(
        'span',
        { class: 'iui-stepper-chevron' },
        iconEl(isExpanded ? 'chevron-up' : 'chevron-down', 16),
      );
      const titleSpan = h('span', { class: 'iui-stepper-title' }, step.title);

      const detailEl = h(
        'div',
        { class: `iui-stepper-detail${isExpanded ? '' : ' is-collapsed'}` },
        step.detail,
      );

      const btn = h(
        'button',
        {
          type: 'button',
          class: 'iui-stepper-btn',
          'aria-expanded': String(isExpanded),
          onClick: () => {
            isExpanded = !isExpanded;
            btn.setAttribute('aria-expanded', String(isExpanded));
            clear(chevronSpan);
            chevronSpan.appendChild(iconEl(isExpanded ? 'chevron-up' : 'chevron-down', 16));
            if (isExpanded) {
              detailEl.classList.remove('is-collapsed');
            } else {
              detailEl.classList.add('is-collapsed');
            }
          },
        },
        titleSpan,
        chevronSpan,
      );

      content.appendChild(btn);
      content.appendChild(detailEl);
    } else {
      const headerStatic = h(
        'div',
        { class: 'iui-stepper-header-static' },
        h('span', { class: 'iui-stepper-title' }, step.title),
      );
      content.appendChild(headerStatic);
    }

    stepEl.appendChild(content);
    list.appendChild(stepEl);
  }

  card.appendChild(list);
  return card;
}
