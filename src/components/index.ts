import { ThemeMode } from '../core/theme';
import { UISpec, UIType } from '../core/types';
import { renderTable } from './table';
import { renderCompare } from './compare';
import { renderStepper } from './stepper';
import { renderQuiz } from './quiz';
import { renderFlow } from './flow';
import { renderChart } from './chart';
import { renderMermaid } from './mermaid';

export interface RenderContext {
  theme: ThemeMode;
  onCleanup(fn: () => void): void;
}

export type RenderFn<T extends UISpec> = (spec: T, ctx: RenderContext) => HTMLElement;

export const RENDERERS: { [K in UIType]: RenderFn<Extract<UISpec, { type: K }>> } = {
  flow: renderFlow,
  stepper: renderStepper,
  table: renderTable,
  compare: renderCompare,
  quiz: renderQuiz,
  chart: renderChart,
  mermaid: renderMermaid,
};
