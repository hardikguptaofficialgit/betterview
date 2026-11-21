import { ThemeMode } from '../core/theme';
import { UISpec, UIType } from '../core/types';
import { renderTable } from './table';
import { renderCompare } from './compare';
import { renderStepper } from './stepper';
import { renderQuiz } from './quiz';
import { renderFlow } from './flow';
import { renderChart } from './chart';
import { renderMermaid } from './mermaid';
import { renderCallout } from './callout';
import { renderStats } from './stats';
import { renderTabs } from './tabs';
import { renderTimeline } from './timeline';
import { renderFollowups } from './followups';
import { renderMath } from './math';
import { renderCode } from './code';
import { renderGeneric } from './generic';
import { renderChecklist } from './checklist';
import { renderForm } from './form';

export interface RenderContext {
  theme: ThemeMode;
  host?: 'gemini' | 'grok';
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
  callout: renderCallout,
  stats: renderStats,
  tabs: renderTabs,
  timeline: renderTimeline,
  followups: renderFollowups,
  math: renderMath,
  code: renderCode,
  checklist: renderChecklist,
  form: renderForm,
  generic: renderGeneric,
};
