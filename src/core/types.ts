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
  | 'followups';

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
] as const;

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
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
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

export interface ChartSpec {
  type: 'chart';
  title?: string;
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar';
  labels: string[];
  datasets: { label: string; data: number[] }[];
  unit?: string;
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
  | FollowupsSpec;
