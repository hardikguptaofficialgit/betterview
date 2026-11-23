export type UIType =
  | 'flow'
  | 'stepper'
  | 'table'
  | 'compare'
  | 'quiz'
  | 'chart'
  | 'mermaid'
  | 'callout'
  | 'stats'
  | 'tabs'
  | 'timeline'
  | 'followups'
  | 'math'
  | 'code'
  | 'checklist'
  | 'form'
  | 'image'
  | 'dashboard'
  | 'generic';

export const UI_TYPES: readonly UIType[] = [
  'flow',
  'stepper',
  'table',
  'compare',
  'quiz',
  'chart',
  'mermaid',
  'callout',
  'stats',
  'tabs',
  'timeline',
  'followups',
  'math',
  'code',
  'checklist',
  'form',
  'image',
  'dashboard',
  'generic',
] as const;

export type UIHost = 'gemini' | 'grok' | 'chatgpt' | 'claude';

export type Color =
  | 'blue'
  | 'green'
  | 'amber'
  | 'orange'
  | 'red'
  | 'purple'
  | 'teal'
  | 'pink'
  | 'gray'
  | 'sky'
  | 'mint'
  | 'butter'
  | 'peach'
  | 'rose'
  | 'lavender'
  | 'stone';

export const COLORS: readonly Color[] = [
  'blue',
  'green',
  'amber',
  'orange',
  'red',
  'purple',
  'teal',
  'pink',
  'gray',
  'sky',
  'mint',
  'butter',
  'peach',
  'rose',
  'lavender',
  'stone',
] as const;

export interface FlowNode {
  id: string;
  label: string;
  sub?: string;
  icon?: string;
  color?: Color;
  group?: string;
  decision?: boolean;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface FlowGroup {
  id: string;
  label: string;
  color?: Color;
}

export interface FlowSpec {
  type: 'flow';
  title?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  groups?: FlowGroup[];
}

export interface StepperSpec {
  type: 'stepper';
  title?: string;
  steps: { title: string; detail?: string }[];
}

export interface TableSpec {
  type: 'table';
  title?: string;
  columns: string[];
  rows: string[][];
  highlight?: 'min' | 'max' | 'best' | boolean;
}

export interface CompareSpec {
  type: 'compare';
  title?: string;
  items: { label: string; tone: 'good' | 'bad' | 'neutral'; points: string[] }[];
}

export interface QuizSpec {
  type: 'quiz';
  title?: string;
  questions: { q: string; options: string[]; answer: number; explain?: string }[];
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'bubble' | 'heatmap' | 'geo';

export interface ChartPoint {
  x: number;
  y: number;
  r?: number;
  label?: string;
  value?: number;
}

export interface ChartSpec {
  type: 'chart';
  title?: string;
  chartType: ChartType;
  labels: string[];
  datasets: { label: string; data: (number | ChartPoint)[] }[];
  unit?: string;
  xLabel?: string;
  yLabel?: string;
}

export interface MermaidSpec {
  type: 'mermaid';
  title?: string;
  code: string;
}

export interface CalloutSpec {
  type: 'callout';
  title?: string;
  tone: 'info' | 'success' | 'warning' | 'tip';
  text: string;
  icon?: string;
}

export interface StatItem {
  label: string;
  value: string | number;
  delta?: string;
  hint?: string;
  icon?: string;
}

export interface StatsSpec {
  type: 'stats';
  title?: string;
  items: StatItem[];
}

export interface TabItem {
  label: string;
  content: string | string[];
}

export interface TabsSpec {
  type: 'tabs';
  title?: string;
  tabs: TabItem[];
}

export interface TimelineEvent {
  title: string;
  time?: string;
  text: string;
  icon?: string;
}

export interface TimelineSpec {
  type: 'timeline';
  title?: string;
  events: TimelineEvent[];
}

export interface FollowupsSpec {
  type: 'followups';
  title?: string;
  suggestions: string[];
}

export interface MathStep {
  latex: string;
  note?: string;
}

export interface MathSpec {
  type: 'math';
  title?: string;
  latex: string;
  steps?: MathStep[];
}

export interface CodeSpec {
  type: 'code';
  title?: string;
  language: string;
  code: string;
  filename?: string;
}

export interface ChecklistItem {
  text: string;
  detail?: string;
  checked?: boolean;
}

export interface ChecklistSpec {
  type: 'checklist';
  title?: string;
  items: ChecklistItem[];
}

export type FormFieldType = 'text' | 'email' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'range';

export interface FormFieldSpec {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  value?: string | number | boolean;
}

export interface FormSpec {
  type: 'form';
  title?: string;
  description?: string;
  submitLabel?: string;
  fields: FormFieldSpec[];
}

export interface ImageSpec {
  type: 'image';
  title?: string;
  src: string;
  alt: string;
  caption?: string;
  aspect?: 'auto' | 'wide' | 'square' | 'portrait';
  fit?: 'contain' | 'cover';
}

export type DashboardVisualSpec =
  | FlowSpec | StepperSpec | TableSpec | CompareSpec | QuizSpec | ChartSpec
  | MermaidSpec | CalloutSpec | StatsSpec | TabsSpec | TimelineSpec
  | FollowupsSpec | MathSpec | CodeSpec | ChecklistSpec | FormSpec | ImageSpec;

export interface DashboardPanel {
  title?: string;
  visual: DashboardVisualSpec;
}

export interface DashboardSpec {
  type: 'dashboard';
  title?: string;
  items: DashboardPanel[];
}

export interface GenericSpec {
  type: 'generic';
  title?: string;
  originalType?: string;
  data: Record<string, unknown>;
}

export type UISpec =
  | FlowSpec
  | StepperSpec
  | TableSpec
  | CompareSpec
  | QuizSpec
  | ChartSpec
  | MermaidSpec
  | CalloutSpec
  | StatsSpec
  | TabsSpec
  | TimelineSpec
  | FollowupsSpec
  | MathSpec
  | CodeSpec
  | ChecklistSpec
  | FormSpec
  | ImageSpec
  | DashboardSpec
  | GenericSpec;
