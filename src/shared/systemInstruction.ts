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
    whenToUse: 'Process flows or architecture',
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
    whenToUse: 'Tabular data or metrics',
    schemaSnippet: '{"type":"table","title":"...","columns":["Metric","Value"],"rows":[["A","100"]]}',
  },
  {
    type: 'compare',
    required: ['type', 'items'],
    whenToUse: 'Side-by-side trade-offs',
    schemaSnippet: '{"type":"compare","title":"...","items":[{"label":"SQL","tone":"good","points":["..."]}]}',
  },
  {
    type: 'quiz',
    required: ['type', 'questions'],
    whenToUse: 'Multiple-choice checks',
    schemaSnippet: '{"type":"quiz","title":"...","questions":[{"q":"...","options":["A","B"],"answer":0,"explain":"..."}]}',
  },
  {
    type: 'chart',
    required: ['type', 'chartType', 'labels', 'datasets'],
    whenToUse: 'Data trends or charts',
    schemaSnippet: '{"type":"chart","title":"...","chartType":"bar","labels":["Mon","Tue"],"datasets":[{"label":"Req","data":[10,20]}],"unit":"M"}',
  },
  {
    type: 'mermaid',
    required: ['type', 'code'],
    whenToUse: 'Sequence, state, or ER diagram',
    schemaSnippet: '{"type":"mermaid","title":"...","code":"sequenceDiagram\\n  A->>B: ping"}',
  },
  {
    type: 'callout',
    required: ['type', 'tone', 'text'],
    whenToUse: 'Notices, tips, or warnings',
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
    whenToUse: 'Categorized views or lists',
    schemaSnippet: '{"type":"tabs","title":"...","tabs":[{"label":"Overview","content":"..."},{"label":"Details","content":["..."]}]}',
  },
  {
    type: 'timeline',
    required: ['type', 'events'],
    whenToUse: 'Chronological roadmaps',
    schemaSnippet: '{"type":"timeline","title":"...","events":[{"title":"Launch","time":"Q1","text":"...","icon":"rocket"}]}',
  },
  {
    type: 'followups',
    required: ['type', 'suggestions'],
    whenToUse: '2-4 suggested next prompt chips',
    schemaSnippet: '{"type":"followups","title":"Suggested follow-ups","suggestions":["Tell me more","How to optimize?"]}',
  },
  {
    type: 'math',
    required: ['type', 'latex'],
    whenToUse: 'Formulas or derivations',
    schemaSnippet: '{"type":"math","title":"...","latex":"E = mc^2","steps":[{"latex":"...","note":"..."}]}',
  },
  {
    type: 'code',
    required: ['type', 'language', 'code'],
    whenToUse: 'Syntax-highlighted code',
    schemaSnippet: '{"type":"code","title":"...","language":"typescript","code":"const x = 1;","filename":"main.ts"}',
  },
  {
    type: 'checklist',
    required: ['type', 'items'],
    whenToUse: 'Interactive task lists, plans and completion tracking',
    schemaSnippet: '{"type":"checklist","title":"Launch checklist","items":[{"text":"Configure domain","detail":"Add DNS records","checked":false},{"text":"Run smoke tests","checked":true}]}',
  },
  {
    type: 'form',
    required: ['type', 'fields'],
    whenToUse: 'Interactive input forms, preferences and structured responses',
    schemaSnippet: '{"type":"form","title":"Project preferences","fields":[{"id":"name","label":"Name","type":"text","required":true},{"id":"plan","label":"Plan","type":"radio","options":["Starter","Pro"]},{"id":"updates","label":"Email updates","type":"checkbox"}]}',
  },
];

function generateCatalogSection(): string {
  return COMPONENT_CATALOG.map(
    (c) => `${c.type}: ${c.schemaSnippet}`
  ).join('\n\n');
}

function generateCompactCatalog(): string {
  return COMPONENT_CATALOG.map(
    (c) => `${c.type}: ${c.schemaSnippet.replace(/^\{"type":"[^"]+",?/, '{')}`
  ).join(' · ');
}

export const CURRENT_INSTRUCTION_VERSION = 6;

export const SETUP_INSTRUCTION = `[BetterView v6] Answer normally in text and markdown; the text answer is the main answer and must stand on its own. When the user asks for something visual, a diagram or a chart, answer in text with \`\`\`ui blocks and NEVER generate or create images unless the user explicitly says "image" or "picture". Only where a visual genuinely helps, add a \`\`\`ui block with ONE valid JSON object at the relevant spot (Never more than 3 per answer, none for short or casual answers, never the whole answer in ui, never invent numbers). Each block is {"type":"<one of the types>","title":"...", ...fields}; use double quotes, no comments, no trailing commas. Followups optional at the end of long answers.
Types: flow{nodes[id,label,icon?],edges[from,to,label?]} stepper{steps[title,detail]} table{columns,rows} compare{items[label,tone,points]} chart{chartType,labels,datasets[label,data]} stats{items[label,value,delta?]} timeline{events[title,time,text]} callout{tone,text} tabs{tabs[label,content]} quiz{questions[q,options,answer,explain]} checklist{items[text,detail?,checked?]} form{fields[id,label,type,options?,required?]} mermaid{code} math{latex,steps?} code{language,code} followups{suggestions}`;

export const SYSTEM_INSTRUCTION = `[BetterView v6] Answer normally in plain text and markdown. The text answer is the main answer and must stand on its own. When asked for something visual, a diagram or a chart, answer in text with \`\`\`ui blocks; NEVER generate or create images unless the user explicitly says "image" or "picture". Only where a visual genuinely adds clarity (process, steps, trade-offs, table, metrics, timeline, formula), ALSO add a fenced code block with language ui containing ONE valid JSON object (double quotes, no comments, no trailing commas, "type" first, then "title"). Place it at the relevant spot inside your normal answer; keep text around it. Short answers and casual chat get no ui. Never more than 3 ui blocks per answer. Never put the whole answer inside ui blocks. Never invent numbers. Followups optional at the end of long answers.

Type catalog:
${generateCatalogSection()}`;

export const SYSTEM_INSTRUCTION_SHORT = `[BetterView v6] In markdown. For visuals/diagrams, answer in text with \`\`\`ui; NEVER generate or create images unless asked for "image" or "picture". Add ui block when helpful. Casual chat gets no ui. Never more than 3 ui blocks per answer. Never invent numbers.
Types: ${generateCompactCatalog()}`;

export function getCompactInstruction(): string {
  return SETUP_INSTRUCTION;
}
