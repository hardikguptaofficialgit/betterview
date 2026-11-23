import { ThemeMode } from '../core/theme';
import { DashboardVisualSpec, UISpec, UIType, UIHost } from '../core/types';
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
import { renderImage } from './image';
import { renderDashboard } from './dashboard';

export interface RenderContext {
  theme: ThemeMode;
  host?: UIHost;
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
  image: renderImage,
  dashboard: (spec, ctx) => renderDashboard(spec, ctx, (visual: DashboardVisualSpec, innerCtx) => {
    const renderer = RENDERERS[visual.type] as RenderFn<UISpec>;
    return renderer(visual, innerCtx);
  }),
  generic: renderGeneric,
};
