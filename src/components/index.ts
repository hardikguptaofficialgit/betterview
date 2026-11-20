import { ThemeMode } from '../core/theme';
import { UISpec, UIType } from '../core/types';
import { h } from '../core/dom';
import { renderTable } from './table';
import { renderCompare } from './compare';
import { renderStepper } from './stepper';
import { renderQuiz } from './quiz';

export interface RenderContext {
  theme: ThemeMode;
  onCleanup(fn: () => void): void;
}

export type RenderFn<T extends UISpec> = (spec: T, ctx: RenderContext) => HTMLElement;

function renderDebug(spec: UISpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }
  const pre = h('pre', { class: 'iui-fallback-pre' }, JSON.stringify(spec, null, 2));
  card.appendChild(pre);
  return card;
}

export const RENDERERS: { [K in UIType]: RenderFn<Extract<UISpec, { type: K }>> } = {
  flow: renderDebug as RenderFn<Extract<UISpec, { type: 'flow' }>>,
  stepper: renderStepper,
  table: renderTable,
  compare: renderCompare,
  quiz: renderQuiz,
  chart: renderDebug as RenderFn<Extract<UISpec, { type: 'chart' }>>,
  mermaid: renderDebug as RenderFn<Extract<UISpec, { type: 'mermaid' }>>,
};
