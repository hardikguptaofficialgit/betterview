import { UIType } from '../core/types';

export interface ComponentCatalogEntry {
  type: UIType;
  required: string[];
  whenToUse: string;
  schemaSnippet: string;
}

export const COMPONENT_CATALOG: ComponentCatalogEntry[] = [
  {
    type: 'flow',
    required: ['type', 'nodes', 'edges'],
    whenToUse: 'Process flows, decision trees, or system architectures',
    schemaSnippet: '{"type":"flow","title":"...","nodes":[{"id":"a","label":"User","icon":"user","color":"blue"}],"edges":[{"from":"a","to":"b","label":"Yes"}]}',
  },
  {
    type: 'stepper',
    required: ['type', 'steps'],
    whenToUse: 'Linear sequential steps, instructions, or tutorials',
    schemaSnippet: '{"type":"stepper","title":"...","steps":[{"title":"...","detail":"..."}]}',
  },
  {
    type: 'table',
    required: ['type', 'columns', 'rows'],
    whenToUse: 'Structured tabular data, metrics, or comparisons',
    schemaSnippet: '{"type":"table","title":"...","columns":["Metric","Value"],"rows":[["A","100"]]}',
  },
  {
    type: 'compare',
    required: ['type', 'items'],
    whenToUse: 'Side-by-side pros vs cons, option comparisons, or trade-offs',
    schemaSnippet: '{"type":"compare","title":"...","items":[{"label":"SQL","tone":"good","points":["..."]}]}',
  },
  {
    type: 'quiz',
    required: ['type', 'questions'],
    whenToUse: 'Interactive multiple-choice knowledge checks',
    schemaSnippet: '{"type":"quiz","title":"...","questions":[{"q":"...","options":["A","B"],"answer":0,"explain":"..."}]}',
  },
  {
    type: 'chart',
    required: ['type', 'chartType', 'labels', 'datasets'],
    whenToUse: 'Quantitative data trends, distributions, or categorical comparisons',
    schemaSnippet: '{"type":"chart","title":"...","chartType":"bar","labels":["Mon","Tue"],"datasets":[{"label":"Req","data":[10,20]}],"unit":"M"}',
  },
  {
    type: 'mermaid',
    required: ['type', 'code'],
    whenToUse: 'Sequence diagrams, state machines, or ER diagrams when flow cannot express them',
    schemaSnippet: '{"type":"mermaid","title":"...","code":"sequenceDiagram\\n  A->>B: ping"}',
  },
  {
    type: 'callout',
    required: ['type', 'tone', 'text'],
    whenToUse: 'Key notices, warnings, tips, or success announcements',
    schemaSnippet: '{"type":"callout","title":"...","tone":"info|success|warning|tip","text":"..."}',
  },
  {
    type: 'stats',
    required: ['type', 'items'],
    whenToUse: '2-4 headline KPI metric cards with optional change delta and hint',
    schemaSnippet: '{"type":"stats","title":"...","items":[{"label":"Uptime","value":"99.9%","delta":"+0.2%","hint":"Last 30d"}]}',
  },
  {
    type: 'tabs',
    required: ['type', 'tabs'],
    whenToUse: 'Categorized alternate views or tabbed text/bullet lists',
    schemaSnippet: '{"type":"tabs","title":"...","tabs":[{"label":"Overview","content":"..."},{"label":"Details","content":["..."]}]}',
  },
  {
    type: 'timeline',
    required: ['type', 'events'],
    whenToUse: 'Chronological events, history, milestones, or roadmaps',
    schemaSnippet: '{"type":"timeline","title":"...","events":[{"title":"Launch","time":"Q1","text":"..."}]}',
  },
  {
    type: 'followups',
    required: ['type', 'suggestions'],
    whenToUse: '2-4 suggested next user prompts or follow-up question chips',
    schemaSnippet: '{"type":"followups","title":"Suggested follow-ups","suggestions":["Tell me more","How to optimize?"]}',
  },
];

function generateCatalogSection(): string {
  return COMPONENT_CATALOG.map(
    (c) => `${c.type} (${c.whenToUse}):\n${c.schemaSnippet}`
  ).join('\n\n');
}

function generateCompactCatalog(): string {
  return COMPONENT_CATALOG.map(
    (c) => `${c.type}: ${c.schemaSnippet}`
  ).join(' · ');
}

export const SYSTEM_INSTRUCTION = `You can show rich visual components in your answers. When a visual makes the answer clearer (a process, architecture, steps, a comparison, data, callouts, stats, tabs, a timeline, or a quiz), output it as a fenced code block whose language is exactly ui, containing ONE valid JSON object (double quotes, no comments, no trailing commas).

Rules:
1. Always put "type" first, then "title", then the content arrays/fields.
2. Prefer several small, focused blocks over one giant block.
3. Use UI only when it clearly helps the reader, and use normal plain text otherwise.
4. End answers with one followups block when natural to offer next prompt ideas.
5. Write one short sentence of normal text before each block.
6. Never invent numbers for charts or stats.

Type catalog:
${generateCatalogSection()}`;

export const SYSTEM_INSTRUCTION_SHORT = `Show visuals as fenced code blocks with language ui holding ONE valid JSON object. Rules: put "type" first, then "title", then content; prefer several small blocks over one giant block; use UI only when helpful; end with one followups block when natural; never invent numbers.
Types: ${generateCompactCatalog()}`;

export function getCompactInstruction(): string {
  return `[BetterView] ${SYSTEM_INSTRUCTION}`;
}
