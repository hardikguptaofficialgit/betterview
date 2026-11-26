import { UIType } from '../core/types';

export interface ComponentCatalogEntry {
  type: UIType;
  required: string[];
  whenToUse: string;
  schemaSnippet: string;
}

export const COMPONENT_CATALOG: ComponentCatalogEntry[] = [
  {
    type: 'tree',
    required: ['type', 'root'],
    whenToUse: 'Hierarchies, mind maps, org charts',
    schemaSnippet: '{"type":"tree","layout":"vertical","root":{"id":"r","label":"Root","children":[{"id":"a","label":"Branch"}]}}',
  },
  {
    type: 'flow',
    required: ['type', 'nodes', 'edges'],
    whenToUse: 'Process flows or architecture',
    schemaSnippet: '{"type":"flow","title":"...","nodes":[{"id":"a","label":"User"},{"id":"b","label":"API server"}],"edges":[{"from":"a","to":"b","label":"Request"}]}',
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
  {
    type: 'image',
    required: ['type', 'src', 'alt'],
    whenToUse: 'A requested illustration or infographic with a real HTTPS image URL',
    schemaSnippet: '{"type":"image","title":"...","src":"https://...","alt":"Describe the image","caption":"...","aspect":"wide"}',
  },
  {
    type: 'dashboard',
    required: ['type', 'items'],
    whenToUse: 'A compact dashboard with 2-8 different visual panels',
    schemaSnippet: '{"type":"dashboard","title":"...","items":[{"title":"KPI","visual":{"type":"stats","items":[{"label":"Up","value":"99%"}]}}]}',
  },
];

function generateCatalogSection(): string {
  return COMPONENT_CATALOG.map(
    (c) => `${c.type}: ${c.schemaSnippet.replace(/^\{"type":"[^"]+",?/, '{').replace(/,"title":"\.\.\."/g, '')}`
  ).join(' · ');
}

function generateCompactCatalog(): string {
  return COMPONENT_CATALOG.map(
    (c) => c.type === 'dashboard'
      ? `${c.type}{items:2-8 panels}`
      : `${c.type}{${c.required.filter((field) => field !== 'type').join(',')}}`
  ).join(' · ');
}

export const CURRENT_INSTRUCTION_VERSION = 12;

export const SETUP_INSTRUCTION = `[BetterView v12] Keep the normal text answer. Add at most 1-2 \`\`\`ui blocks where they genuinely help. Short/casual replies get none. Never invent facts. Never generate or insert images for diagrams, charts, flows, tables or quizzes. Always use a \`\`\`ui block instead. Use double-quoted JSON.

STYLE: Minimal, compact; no outer container or background panel; Never nest cards. Readable labels. Keep flows to 12 nodes or fewer, use short node labels (6 words or fewer); large/branching flows may use pan/zoom. Trees: labeled root, children; vertical/horizontal/outline; max 6 levels/80 nodes. Use 3-5 quiz questions. Keep charts to 8 categories or fewer. Never invent image URLs.
Types: flow{nodes[id,label],edges[from,to,label?]} tree{root{id,label,children?},layout?:vertical|horizontal|outline} stepper{steps[title,detail?]} table{columns,rows} compare{items[label,tone,points]} quiz{questions[q,options,answer]} chart{chartType:bar|line|area|pie|doughnut|radar|scatter|bubble|heatmap|geo,labels,datasets} scatter/bubble data[{x,y,r?}]; geo data[{lon,lat,label?}]; heatmap numeric rows. mermaid{code} callout{tone,text} stats{items[label,value]} tabs{tabs[label,content]} timeline{events[title,text]} followups{suggestions} math{latex} code{language,code} checklist{items[text,checked?]} form{fields[id,label,type]} image{src,alt,caption?} dashboard{items:[{title?,visual:{...}}]}.`;

export const SYSTEM_INSTRUCTION = `[BetterView v12] Keep normal text answer. Add at most 1-2 \`\`\`ui blocks when helpful; short/casual replies get none. Never invent facts. Never invent image URLs. Never generate images for diagrams, charts, flows, tables or quizzes; use a \`\`\`ui block. Images only when requested, with HTTPS src and descriptive alt.

VISUAL STYLE: Minimal, compact; no outer container. Never nest cards; concise labels. Flows to 12 nodes (<=6 words/label); large or branching graphs use the readable pan/zoom canvas. Trees: labeled root/children; vertical/horizontal/outline; max 6 levels/80 nodes. 3-5 quiz questions. Charts to 8 categories.

Type catalog:
${generateCatalogSection()}

Chart modes: bar|line|area|pie|doughnut|radar|scatter|bubble|heatmap|geo. Scatter/bubble points use {"x":number,"y":number,"r"?:number} (bubble needs r); heatmap rows are numeric. Geo datasets use {"lon":number,"lat":number,"label"?:string}. Dashboards contain 2-8 panels; do not nest dashboards.`;

export const SYSTEM_INSTRUCTION_SHORT = `[BetterView v12] Keep the normal text answer. Add at most 1-2 \`\`\`ui blocks where they genuinely help; casual/short: no ui; max 2 blocks; never invent facts or image URLs. Never generate or insert images for diagrams, charts, flows, tables or quizzes. Always use a \`\`\`ui block instead. Images only when requested, with real HTTPS src and descriptive alt. STYLE: compact; no outer container. No nested cards; host colors, concise readable labels. Keep flows to 12 nodes or fewer (6 words or fewer labels); large flows pan/zoom or use titled sections. 3-5 quiz questions. Charts to 8 categories or fewer.
Types: ${generateCompactCatalog()}
Charts: bar|line|area|pie|doughnut|radar|scatter|bubble|heatmap|geo; scatter/bubble points {x,y,r?}, geo points {lon,lat,label?}, heatmap rows numeric. Dashboards: 2-8 panels; no nesting. Trees: root{id,label,children?} max depth 6 / 80 nodes; layout horizontal|vertical|outline.`;

export function getCompactInstruction(): string {
  return SETUP_INSTRUCTION;
}
