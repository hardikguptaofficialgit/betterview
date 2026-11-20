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
    whenToUse: 'Process flows or architectures',
    schemaSnippet: '{"type":"flow","title":"...","nodes":[{"id":"a","label":"User","icon":"user","color":"blue"}],"edges":[{"from":"a","to":"b","label":"Yes"}]}',
  },
  {
    type: 'stepper',
    required: ['type', 'steps'],
    whenToUse: 'Sequential steps or tutorials',
    schemaSnippet: '{"type":"stepper","title":"...","steps":[{"title":"...","detail":"..."}]}',
  },
  {
    type: 'table',
    required: ['type', 'columns', 'rows'],
    whenToUse: 'Structured tabular data or metrics',
    schemaSnippet: '{"type":"table","title":"...","columns":["Metric","Value"],"rows":[["A","100"]]}',
  },
  {
    type: 'compare',
    required: ['type', 'items'],
    whenToUse: 'Side-by-side pros vs cons or trade-offs',
    schemaSnippet: '{"type":"compare","title":"...","items":[{"label":"SQL","tone":"good","points":["..."]}]}',
  },
  {
    type: 'quiz',
    required: ['type', 'questions'],
    whenToUse: 'Interactive multiple-choice checks',
    schemaSnippet: '{"type":"quiz","title":"...","questions":[{"q":"...","options":["A","B"],"answer":0,"explain":"..."}]}',
  },
  {
    type: 'chart',
    required: ['type', 'chartType', 'labels', 'datasets'],
    whenToUse: 'Data trends or comparisons',
    schemaSnippet: '{"type":"chart","title":"...","chartType":"bar","labels":["Mon","Tue"],"datasets":[{"label":"Req","data":[10,20]}],"unit":"M"}',
  },
  {
    type: 'mermaid',
    required: ['type', 'code'],
    whenToUse: 'Sequence, state, or ER diagrams',
    schemaSnippet: '{"type":"mermaid","title":"...","code":"sequenceDiagram\\n  A->>B: ping"}',
  },
  {
    type: 'callout',
    required: ['type', 'tone', 'text'],
    whenToUse: 'Notices, warnings, tips, or success notes',
    schemaSnippet: '{"type":"callout","title":"...","tone":"info|success|warning|tip","text":"...","icon":"rocket"}',
  },
  {
    type: 'stats',
    required: ['type', 'items'],
    whenToUse: '2-4 headline KPI metric cards',
    schemaSnippet: '{"type":"stats","title":"...","items":[{"label":"Uptime","value":"99.9%","delta":"+0.2%","hint":"30d","icon":"lightning"}]}',
  },
  {
    type: 'tabs',
    required: ['type', 'tabs'],
    whenToUse: 'Categorized alternate views or lists',
    schemaSnippet: '{"type":"tabs","title":"...","tabs":[{"label":"Overview","content":"..."},{"label":"Details","content":["..."]}]}',
  },
  {
    type: 'timeline',
    required: ['type', 'events'],
    whenToUse: 'Chronological events or roadmaps',
    schemaSnippet: '{"type":"timeline","title":"...","events":[{"title":"Launch","time":"Q1","text":"...","icon":"rocket"}]}',
  },
  {
    type: 'followups',
    required: ['type', 'suggestions'],
    whenToUse: '2-4 suggested next prompt chips',
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

export const CURRENT_INSTRUCTION_VERSION = 2;

export const SYSTEM_INSTRUCTION = `[BetterView v2] You can show rich visual components in your answers. When a visual makes the answer clearer (a process, architecture, steps, a comparison, data, callouts, stats, tabs, a timeline, or a quiz), output it as a fenced code block whose language is exactly ui, containing ONE valid JSON object (double quotes, no comments, no trailing commas).

Rules:
1. Always put "type" first, then "title", then content fields.
2. Prefer several small, focused blocks over one giant block.
3. Use UI only when it clearly helps; use normal plain text otherwise.
4. End answers with one followups block when natural.
5. Write one short sentence before each block.
6. Never invent numbers for charts or stats.
7. Optional icon: stats, timeline, callouts, and flow nodes can include an optional "icon" (e.g. globe, lock, server, database, lightning, rocket, clock, users, code, cloud, shield-check, chart-line, cpu, wifi-high). Unknown names use default.

Type catalog:
${generateCatalogSection()}`;

export const SYSTEM_INSTRUCTION_SHORT = `[BetterView v2] Show visuals as fenced code blocks with language ui holding ONE valid JSON object. Rules: put "type" first, then "title", then content; prefer several small blocks over one giant block; use UI only when helpful; end with one followups block when natural; never invent numbers.
Types: ${generateCompactCatalog()}`;

export function getCompactInstruction(): string {
  return SYSTEM_INSTRUCTION;
}
