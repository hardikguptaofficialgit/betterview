export type UIType = 'flow'|'stepper'|'table'|'compare'|'quiz'|'chart'|'mermaid';
export const UI_TYPES: UIType[] = ['flow','stepper','table','compare','quiz','chart','mermaid'];
export type Color = 'blue'|'green'|'amber'|'orange'|'red'|'purple'|'teal'|'pink'|'gray';
export const COLORS: Color[] = ['blue','green','amber','orange','red','purple','teal','pink','gray'];
export interface FlowNode { id: string; label: string; sub?: string; icon?: string; color?: Color; group?: string }
export interface FlowEdge { from: string; to: string; label?: string }
export interface FlowGroup { id: string; label: string; color?: Color }
export interface FlowSpec { type:'flow'; title?: string; nodes: FlowNode[]; edges: FlowEdge[]; groups?: FlowGroup[] }
export interface StepperSpec { type:'stepper'; title?: string; steps: { title: string; detail?: string }[] }
export interface TableSpec { type:'table'; title?: string; columns: string[]; rows: string[][] }
export interface CompareSpec { type:'compare'; title?: string; items: { label: string; tone: 'good'|'bad'|'neutral'; points: string[] }[] }
export interface QuizSpec { type:'quiz'; title?: string; questions: { q: string; options: string[]; answer: number; explain?: string }[] }
export interface ChartSpec { type:'chart'; title?: string; chartType: 'bar'|'line'|'pie'|'doughnut'|'radar'; labels: string[]; datasets: { label: string; data: number[] }[]; unit?: string }
export interface MermaidSpec { type:'mermaid'; title?: string; code: string }
export type UISpec = FlowSpec|StepperSpec|TableSpec|CompareSpec|QuizSpec|ChartSpec|MermaidSpec;
