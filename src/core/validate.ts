import {
  Color,
  COLORS,
  UISpec,
  UIType,
  UI_TYPES,
  FlowNode,
  FlowEdge,
  FlowGroup,
  FlowSpec,
  StepperSpec,
  TableSpec,
  CompareSpec,
  QuizSpec,
  ChartSpec,
  MermaidSpec,
  CalloutSpec,
  StatsSpec,
  StatItem,
  TabsSpec,
  TabItem,
  TimelineSpec,
  TimelineEvent,
  FollowupsSpec,
} from './types';

export type ValidateResult =
  | { ok: true; spec: UISpec; warnings: string[] }
  | { ok: false; error: string };

export const FALLBACK_COLORS: Color[] = ['blue', 'green', 'orange', 'purple', 'amber', 'red'];

export function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function resolveColor(c: unknown, seed: string): Color {
  if (typeof c === 'string') {
    const lower = c.trim().toLowerCase();
    if (lower === 'yellow') return 'amber';
    if (lower === 'grey') return 'gray';
    if ((COLORS as readonly string[]).includes(lower)) {
      return lower as Color;
    }
  }
  const idx = stableHash(seed) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[idx];
}

function cleanString(val: unknown, maxLen = 300): string {
  if (typeof val === 'number') {
    val = String(val);
  }
  if (typeof val !== 'string') {
    return '';
  }
  return val.trim().slice(0, maxLen);
}

function validateFlow(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: FlowSpec } | { ok: false; error: string } {
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  if (rawNodes.length === 0) {
    return { ok: false, error: 'flow must have at least 1 node' };
  }

  const groupMap = new Map<string, FlowGroup>();
  if (Array.isArray(raw.groups)) {
    for (const g of raw.groups) {
      if (g && typeof g === 'object') {
        const id = cleanString((g as Record<string, unknown>).id);
        const label = cleanString((g as Record<string, unknown>).label);
        if (id && label) {
          const rawColor = (g as Record<string, unknown>).color;
          const color = rawColor !== undefined ? resolveColor(rawColor, id || label) : undefined;
          groupMap.set(id, { id, label, ...(color ? { color } : {}) });
        }
      }
    }
  }

  const nodeMap = new Map<string, FlowNode>();
  for (const n of rawNodes) {
    if (!n || typeof n !== 'object') continue;
    const rec = n as Record<string, unknown>;
    const id = cleanString(rec.id);
    const label = cleanString(rec.label ?? rec.title);
    if (!id || !label) {
      return { ok: false, error: 'Node must have non-empty id and label' };
    }
    if (nodeMap.has(id)) {
      warnings.push(`Duplicate node id "${id}" dropped`);
      continue;
    }
    if (nodeMap.size >= 60) {
      warnings.push('Nodes capped at 60');
      break;
    }

    const sub = cleanString(rec.sub ?? rec.subtitle ?? rec.description);
    const icon = cleanString(rec.icon);
    const rawColor = rec.color;
    const color = rawColor !== undefined ? resolveColor(rawColor, id || label) : undefined;
    let group = cleanString(rec.group);
    if (group && !groupMap.has(group)) {
      warnings.push(`Group "${group}" not found for node "${id}"`);
      group = '';
    }

    nodeMap.set(id, {
      id,
      label,
      ...(sub ? { sub } : {}),
      ...(icon ? { icon } : {}),
      ...(color ? { color } : {}),
      ...(group ? { group } : {}),
    });
  }

  if (nodeMap.size === 0) {
    return { ok: false, error: 'flow must have at least 1 valid node' };
  }

  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];
  const edges: FlowEdge[] = [];

  for (const e of rawEdges) {
    if (!e || typeof e !== 'object') continue;
    const rec = e as Record<string, unknown>;
    const from = cleanString(rec.from);
    const to = cleanString(rec.to);
    if (!from || !to) continue;

    if (from === to) {
      warnings.push(`Dropped self-loop edge on "${from}"`);
      continue;
    }

    if (!nodeMap.has(from)) {
      if (nodeMap.size < 60) {
        nodeMap.set(from, { id: from, label: from });
        warnings.push(`Created missing node "${from}" referenced in edge`);
      } else {
        warnings.push(`Could not create missing node "${from}": node limit reached`);
        continue;
      }
    }

    if (!nodeMap.has(to)) {
      if (nodeMap.size < 60) {
        nodeMap.set(to, { id: to, label: to });
        warnings.push(`Created missing node "${to}" referenced in edge`);
      } else {
        warnings.push(`Could not create missing node "${to}": node limit reached`);
        continue;
      }
    }

    const label = cleanString(rec.label);
    edges.push({ from, to, ...(label ? { label } : {}) });

    if (edges.length >= 120) {
      warnings.push('Edges capped at 120');
      break;
    }
  }

  const nodes = Array.from(nodeMap.values());
  const groups = Array.from(groupMap.values());
  const spec: FlowSpec = {
    type: 'flow',
    nodes,
    edges,
    ...(groups.length > 0 ? { groups } : {}),
  };
  return { ok: true, spec };
}

function validateStepper(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: StepperSpec } | { ok: false; error: string } {
  let rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (rawSteps.length === 0) {
    return { ok: false, error: 'stepper must have at least 1 step' };
  }
  if (rawSteps.length > 20) {
    warnings.push('Steps capped at 20');
    rawSteps = rawSteps.slice(0, 20);
  }

  const steps: { title: string; detail?: string }[] = [];
  for (const s of rawSteps) {
    if (!s || typeof s !== 'object') {
      return { ok: false, error: 'Step must be an object' };
    }
    const rec = s as Record<string, unknown>;
    const title = cleanString(rec.title);
    if (!title) {
      return { ok: false, error: 'Step title is required' };
    }
    const detail = cleanString(rec.detail ?? rec.description);
    steps.push({ title, ...(detail ? { detail } : {}) });
  }

  return { ok: true, spec: { type: 'stepper', steps } };
}

function validateTable(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: TableSpec } | { ok: false; error: string } {
  const rawCols = Array.isArray(raw.columns) ? raw.columns : [];
  if (rawCols.length === 0) {
    return { ok: false, error: 'table must have at least 1 column' };
  }

  let columns = rawCols.map((c, i) => cleanString(c) || `Column ${i + 1}`);
  if (columns.length > 12) {
    warnings.push('Columns capped at 12');
    columns = columns.slice(0, 12);
  }
  const colCount = columns.length;

  let rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  if (rawRows.length > 50) {
    warnings.push('Rows capped at 50');
    rawRows = rawRows.slice(0, 50);
  }

  const rows: string[][] = [];
  for (const r of rawRows) {
    const arr = Array.isArray(r) ? r : [];
    const row = arr.slice(0, colCount).map((cell) => cleanString(cell));
    while (row.length < colCount) {
      row.push('');
    }
    rows.push(row);
  }

  return { ok: true, spec: { type: 'table', columns, rows } };
}

function validateCompare(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: CompareSpec } | { ok: false; error: string } {
  let rawItems = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.panels) ? raw.panels : [];
  if (rawItems.length === 0) {
    return { ok: false, error: 'compare must have 1-4 items' };
  }
  if (rawItems.length > 4) {
    warnings.push('Compare items capped at 4');
    rawItems = rawItems.slice(0, 4);
  }

  const items: { label: string; tone: 'good' | 'bad' | 'neutral'; points: string[] }[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Compare item must be an object' };
    }
    const rec = item as Record<string, unknown>;
    const label = cleanString(rec.label ?? rec.title);
    if (!label) {
      return { ok: false, error: 'Compare item must have a label' };
    }
    let toneStr = cleanString(rec.tone).toLowerCase();
    if (toneStr !== 'good' && toneStr !== 'bad' && toneStr !== 'neutral') {
      toneStr = 'neutral';
    }

    let rawPoints = Array.isArray(rec.points) ? rec.points : [];
    if (rawPoints.length > 12) {
      warnings.push('Compare points capped at 12');
      rawPoints = rawPoints.slice(0, 12);
    }
    const points = rawPoints.map((p) => cleanString(p)).filter(Boolean);
    items.push({ label, tone: toneStr as 'good' | 'bad' | 'neutral', points });
  }

  return { ok: true, spec: { type: 'compare', items } };
}

function validateQuiz(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: QuizSpec } | { ok: false; error: string } {
  let rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  if (rawQuestions.length === 0) {
    return { ok: false, error: 'quiz must have 1-20 questions' };
  }
  if (rawQuestions.length > 20) {
    warnings.push('Quiz questions capped at 20');
    rawQuestions = rawQuestions.slice(0, 20);
  }

  const questions: { q: string; options: string[]; answer: number; explain?: string }[] = [];
  for (const qObj of rawQuestions) {
    if (!qObj || typeof qObj !== 'object') {
      return { ok: false, error: 'Quiz question must be an object' };
    }
    const rec = qObj as Record<string, unknown>;
    const q = cleanString(rec.q ?? rec.question);
    if (!q) {
      return { ok: false, error: 'Quiz question text is required' };
    }
    const rawOpts = Array.isArray(rec.options) ? rec.options : [];
    const options = rawOpts.map((o) => cleanString(o)).filter(Boolean);
    if (options.length < 2 || options.length > 8) {
      return { ok: false, error: 'Quiz question must have 2 to 8 options' };
    }
    const ans = typeof rec.answer === 'string' ? parseInt(rec.answer, 10) : rec.answer;
    if (typeof ans !== 'number' || !Number.isInteger(ans) || ans < 0 || ans >= options.length) {
      return { ok: false, error: `Quiz answer must be an integer between 0 and ${options.length - 1}` };
    }
    const explain = cleanString(rec.explain);
    questions.push({ q, options, answer: ans, ...(explain ? { explain } : {}) });
  }

  return { ok: true, spec: { type: 'quiz', questions } };
}

function validateChart(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: ChartSpec } | { ok: false; error: string } {
  let chartType = cleanString(raw.chartType).toLowerCase();
  const validChartTypes = ['bar', 'line', 'pie', 'doughnut', 'radar'];
  if (!validChartTypes.includes(chartType)) {
    warnings.push(`Invalid chartType "${raw.chartType}", defaulting to bar`);
    chartType = 'bar';
  }

  const rawLabels = Array.isArray(raw.labels) ? raw.labels : [];
  const labels = rawLabels.map((l) => cleanString(l));
  if (labels.length === 0) {
    return { ok: false, error: 'chart must have at least 1 label' };
  }

  let rawDatasets = Array.isArray(raw.datasets) ? raw.datasets : [];
  if (rawDatasets.length === 0) {
    return { ok: false, error: 'chart must have at least 1 dataset' };
  }
  if (rawDatasets.length > 12) {
    warnings.push('Datasets capped at 12');
    rawDatasets = rawDatasets.slice(0, 12);
  }

  const datasets: { label: string; data: number[] }[] = [];
  for (const ds of rawDatasets) {
    if (!ds || typeof ds !== 'object') {
      return { ok: false, error: 'Chart dataset must be an object' };
    }
    const rec = ds as Record<string, unknown>;
    const label = cleanString(rec.label) || 'Dataset';
    if (!Array.isArray(rec.data)) {
      return { ok: false, error: 'Chart dataset must have a data array' };
    }
    const data: number[] = [];
    for (const item of rec.data) {
      if (typeof item === 'string' && item.trim() === '') {
        return { ok: false, error: 'Invalid chart data: NaN encountered' };
      }
      const num = Number(item);
      if (Number.isNaN(num)) {
        return { ok: false, error: 'Invalid chart data: NaN encountered' };
      }
      data.push(num);
    }
    if (data.length > labels.length) {
      data.splice(labels.length);
    } else {
      while (data.length < labels.length) {
        data.push(0);
      }
    }
    datasets.push({ label, data });
  }

  const unit = cleanString(raw.unit);
  return {
    ok: true,
    spec: {
      type: 'chart',
      chartType: chartType as ChartSpec['chartType'],
      labels,
      datasets,
      ...(unit ? { unit } : {}),
    },
  };
}

function validateMermaid(raw: Record<string, unknown>): { ok: true; spec: MermaidSpec } | { ok: false; error: string } {
  const code = cleanString(raw.code, 8000);
  if (!code) {
    return { ok: false, error: 'mermaid must have non-empty code' };
  }
  return { ok: true, spec: { type: 'mermaid', code } };
}

function validateCallout(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: CalloutSpec } | { ok: false; error: string } {
  const text = cleanString(raw.text ?? raw.body ?? raw.message, 1200);
  if (!text) {
    return { ok: false, error: 'callout must have non-empty text' };
  }

  let toneStr = cleanString(raw.tone).toLowerCase();
  const validTones = ['info', 'success', 'warning', 'tip'];
  if (!validTones.includes(toneStr)) {
    warnings.push(`Invalid callout tone "${raw.tone}", defaulting to info`);
    toneStr = 'info';
  }

  const icon = cleanString(raw.icon);

  return {
    ok: true,
    spec: {
      type: 'callout',
      tone: toneStr as CalloutSpec['tone'],
      text,
      ...(icon ? { icon } : {}),
    },
  };
}

function validateStats(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: StatsSpec } | { ok: false; error: string } {
  let rawItems = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.stats) ? raw.stats : [];
  if (rawItems.length < 2) {
    return { ok: false, error: 'stats must have 2-4 metric cards' };
  }
  if (rawItems.length > 4) {
    warnings.push('Stats items capped at 4');
    rawItems = rawItems.slice(0, 4);
  }

  const items: StatItem[] = [];
  for (const it of rawItems) {
    if (!it || typeof it !== 'object') {
      return { ok: false, error: 'Stat item must be an object' };
    }
    const rec = it as Record<string, unknown>;
    const label = cleanString(rec.label ?? rec.title);
    if (!label) {
      return { ok: false, error: 'Stat item must have a label' };
    }
    const valRaw = rec.value;
    const value = typeof valRaw === 'number' ? valRaw : cleanString(valRaw);
    if (value === '' && typeof valRaw !== 'number') {
      return { ok: false, error: 'Stat item must have a value' };
    }

    const delta = cleanString(rec.delta ?? rec.change);
    const hint = cleanString(rec.hint ?? rec.sub ?? rec.detail);
    const icon = cleanString(rec.icon);

    items.push({
      label,
      value,
      ...(delta ? { delta } : {}),
      ...(hint ? { hint } : {}),
      ...(icon ? { icon } : {}),
    });
  }

  return { ok: true, spec: { type: 'stats', items } };
}

function validateTabs(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: TabsSpec } | { ok: false; error: string } {
  let rawTabs = Array.isArray(raw.tabs) ? raw.tabs : [];
  if (rawTabs.length === 0) {
    return { ok: false, error: 'tabs must have at least 1 tab' };
  }
  if (rawTabs.length > 8) {
    warnings.push('Tabs capped at 8');
    rawTabs = rawTabs.slice(0, 8);
  }

  const tabs: TabItem[] = [];
  for (const t of rawTabs) {
    if (!t || typeof t !== 'object') {
      return { ok: false, error: 'Tab must be an object' };
    }
    const rec = t as Record<string, unknown>;
    const label = cleanString(rec.label ?? rec.title);
    if (!label) {
      return { ok: false, error: 'Tab must have a label' };
    }

    let content: string | string[] = '';
    if (Array.isArray(rec.content)) {
      content = rec.content.map((c) => cleanString(c)).filter(Boolean);
    } else {
      content = cleanString(rec.content ?? rec.text ?? rec.body, 3000);
    }

    tabs.push({ label, content });
  }

  return { ok: true, spec: { type: 'tabs', tabs } };
}

function validateTimeline(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: TimelineSpec } | { ok: false; error: string } {
  let rawEvents = Array.isArray(raw.events) ? raw.events : Array.isArray(raw.steps) ? raw.steps : [];
  if (rawEvents.length === 0) {
    return { ok: false, error: 'timeline must have at least 1 event' };
  }
  if (rawEvents.length > 20) {
    warnings.push('Timeline events capped at 20');
    rawEvents = rawEvents.slice(0, 20);
  }

  const events: TimelineEvent[] = [];
  for (const e of rawEvents) {
    if (!e || typeof e !== 'object') {
      return { ok: false, error: 'Timeline event must be an object' };
    }
    const rec = e as Record<string, unknown>;
    const title = cleanString(rec.title ?? rec.label);
    if (!title) {
      return { ok: false, error: 'Timeline event must have a title' };
    }
    const text = cleanString(rec.text ?? rec.detail ?? rec.description);
    const time = cleanString(rec.time ?? rec.date ?? rec.timestamp);
    const icon = cleanString(rec.icon);

    events.push({
      title,
      text,
      ...(time ? { time } : {}),
      ...(icon ? { icon } : {}),
    });
  }

  return { ok: true, spec: { type: 'timeline', events } };
}

function validateFollowups(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: FollowupsSpec } | { ok: false; error: string } {
  let rawSuggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.chips)
        ? raw.chips
        : [];

  const suggestions = rawSuggestions.map((s) => cleanString(s)).filter(Boolean);
  if (suggestions.length < 2) {
    return { ok: false, error: 'followups must have 2-4 suggestion chips' };
  }
  if (suggestions.length > 4) {
    warnings.push('Followup suggestions capped at 4');
    suggestions.splice(4);
  }

  return { ok: true, spec: { type: 'followups', suggestions } };
}

export function validateSpec(input: unknown): ValidateResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'unknown type' };
  }

  const raw = input as Record<string, unknown>;
  if (typeof raw.type !== 'string' || !(UI_TYPES as readonly string[]).includes(raw.type)) {
    return { ok: false, error: 'unknown type' };
  }

  const warnings: string[] = [];
  let result: { ok: true; spec: UISpec } | { ok: false; error: string };

  switch (raw.type as UIType) {
    case 'flow':
      result = validateFlow(raw, warnings);
      break;
    case 'stepper':
      result = validateStepper(raw, warnings);
      break;
    case 'table':
      result = validateTable(raw, warnings);
      break;
    case 'compare':
      result = validateCompare(raw, warnings);
      break;
    case 'quiz':
      result = validateQuiz(raw, warnings);
      break;
    case 'chart':
      result = validateChart(raw, warnings);
      break;
    case 'mermaid':
      result = validateMermaid(raw);
      break;
    case 'callout':
      result = validateCallout(raw, warnings);
      break;
    case 'stats':
      result = validateStats(raw, warnings);
      break;
    case 'tabs':
      result = validateTabs(raw, warnings);
      break;
    case 'timeline':
      result = validateTimeline(raw, warnings);
      break;
    case 'followups':
      result = validateFollowups(raw, warnings);
      break;
    default:
      return { ok: false, error: 'unknown type' };
  }

  if (!result.ok) {
    return result;
  }

  const title = cleanString(raw.title);
  if (title) {
    result.spec.title = title;
  }

  return { ok: true, spec: result.spec, warnings };
}
