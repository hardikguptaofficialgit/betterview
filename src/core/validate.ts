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
  ChartPoint,
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
  MathSpec,
  MathStep,
  CodeSpec,
  ChecklistSpec,
  ChecklistItem,
  FormSpec,
  FormFieldSpec,
  ImageSpec,
  DashboardSpec,
  DashboardPanel,
  GenericSpec,
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
  let rawQuestions = Array.isArray(raw.questions)
    ? raw.questions
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.quiz)
        ? raw.quiz
        : [];
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
    const q = cleanString(rec.q ?? rec.question ?? rec.prompt ?? rec.title);
    if (!q) {
      return { ok: false, error: 'Quiz question text is required' };
    }
    const rawOpts = Array.isArray(rec.options)
      ? rec.options
      : Array.isArray(rec.choices)
        ? rec.choices
        : Array.isArray(rec.answers)
          ? rec.answers
          : [];
    const options = rawOpts
      .map((o) => {
        if (typeof o === 'string') return cleanString(o);
        if (o && typeof o === 'object') {
          const optRec = o as Record<string, unknown>;
          return cleanString(optRec.text ?? optRec.option ?? optRec.label ?? optRec.value);
        }
        return '';
      })
      .filter(Boolean);
    if (options.length < 2 || options.length > 8) {
      return { ok: false, error: 'Quiz question must have 2 to 8 options' };
    }

    let rawAns = rec.answer ?? rec.correctAnswer ?? rec.correct ?? rec.correctIndex ?? rec.solution;
    let ans: number | undefined;

    if (typeof rawAns === 'number' && Number.isInteger(rawAns)) {
      if (rawAns >= 0 && rawAns < options.length) {
        ans = rawAns;
      } else {
        // Check if the number was meant to match the option value (e.g. 4096 in ["1024", "2048", "4096"])
        const matchIdx = options.findIndex((opt) => opt.trim() === String(rawAns).trim());
        ans = matchIdx >= 0 ? matchIdx : rawAns;
      }
    } else if (typeof rawAns === 'string') {
      const trimmed = rawAns.trim();
      // 1. Exact match with one of the options (e.g. answer: "4096" or answer: "Base62-encode...")
      const exactIdx = options.findIndex((opt) => opt.trim().toLowerCase() === trimmed.toLowerCase());
      if (exactIdx >= 0) {
        ans = exactIdx;
      } else if (/^[a-hA-H]$/.test(trimmed)) {
        // 2. Letter choice 'A', 'B', 'C', etc.
        const letterIdx = trimmed.toUpperCase().charCodeAt(0) - 65;
        if (letterIdx >= 0 && letterIdx < options.length) {
          ans = letterIdx;
        }
      } else {
        // 3. Option letter prefix (e.g. "B) 4096" or "Option B")
        const letterMatch = trimmed.match(/^(?:option\s+|choice\s+)?([a-hA-H])(?:[\)\.\:\s]|$)/i);
        if (letterMatch) {
          const lIdx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
          if (lIdx >= 0 && lIdx < options.length) {
            ans = lIdx;
          }
        }

        if (ans === undefined) {
          // 4. Numeric index (e.g. "0", "1", "2")
          if (/^\d+$/.test(trimmed)) {
            const num = parseInt(trimmed, 10);
            if (num >= 0 && num < options.length) {
              ans = num;
            } else {
              ans = num;
            }
          } else {
            // 5. Substring / partial text match
            const subIdx = options.findIndex((opt) => {
              const o = opt.trim().toLowerCase();
              const t = trimmed.toLowerCase();
              return (o.length > 3 && t.length > 3) && (o.includes(t) || t.includes(o));
            });
            if (subIdx >= 0) {
              ans = subIdx;
            }
          }
        }
      }
    }

    if (ans === undefined || typeof ans !== 'number' || !Number.isInteger(ans) || ans < 0 || ans >= options.length) {
      return { ok: false, error: `Quiz answer must be an integer between 0 and ${options.length - 1}` };
    }
    const explain = cleanString(rec.explain ?? rec.explanation ?? rec.rationale ?? rec.reason);
    questions.push({ q, options, answer: ans, ...(explain ? { explain } : {}) });
  }

  return { ok: true, spec: { type: 'quiz', questions } };
}

function validateChart(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: ChartSpec } | { ok: false; error: string } {
  let chartType = cleanString(raw.chartType).toLowerCase();
  const validChartTypes = ['bar', 'line', 'area', 'pie', 'doughnut', 'radar', 'scatter', 'bubble', 'heatmap', 'geo'];
  if (!validChartTypes.includes(chartType)) {
    warnings.push(`Invalid chartType "${raw.chartType}", defaulting to bar`);
    chartType = 'bar';
  }

  const isPointChart = chartType === 'scatter' || chartType === 'bubble' || chartType === 'geo';
  const rawLabels = Array.isArray(raw.labels) ? raw.labels : [];
  const labelLimit = chartType === 'heatmap' ? 18 : 12;
  const labels = rawLabels.slice(0, labelLimit).map((label, index) => cleanString(label) || `Item ${index + 1}`);
  if (rawLabels.length > labelLimit) warnings.push(`Chart labels capped at ${labelLimit}`);
  if (!isPointChart && labels.length === 0) return { ok: false, error: 'chart must have at least 1 label' };

  let rawDatasets = Array.isArray(raw.datasets) ? raw.datasets : [];
  if (rawDatasets.length === 0) return { ok: false, error: 'chart must have at least 1 dataset' };
  const datasetLimit = chartType === 'heatmap' ? 20 : 12;
  if (rawDatasets.length > datasetLimit) {
    warnings.push(`Datasets capped at ${datasetLimit}`);
    rawDatasets = rawDatasets.slice(0, datasetLimit);
  }

  const datasets: { label: string; data: (number | ChartPoint)[] }[] = [];
  let totalPoints = 0;
  const numberValue = (value: unknown): number | null => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  for (const ds of rawDatasets) {
    if (!ds || typeof ds !== 'object' || Array.isArray(ds)) return { ok: false, error: 'Chart dataset must be an object' };
    const rec = ds as Record<string, unknown>;
    const label = cleanString(rec.label) || 'Dataset';
    if (!Array.isArray(rec.data)) return { ok: false, error: 'Chart dataset must have a data array' };
    const data: (number | ChartPoint)[] = [];

    if (chartType === 'scatter' || chartType === 'bubble') {
      for (const item of rec.data.slice(0, 100)) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: 'Scatter and bubble data must use {x,y} points' };
        const point = item as Record<string, unknown>;
        const x = numberValue(point.x);
        const y = numberValue(point.y);
        const radius = point.r === undefined ? null : numberValue(point.r);
        if (x === null || y === null || (point.r !== undefined && (radius === null || radius <= 0))) {
          return { ok: false, error: 'Scatter and bubble points require finite x and y values (and a positive r when supplied)' };
        }
        if (chartType === 'bubble' && radius === null) return { ok: false, error: 'Bubble points require a positive r value' };
        data.push({ x, y, ...(radius !== null ? { r: radius } : {}), ...(cleanString(point.label) ? { label: cleanString(point.label) } : {}) });
      }
    } else if (chartType === 'geo') {
      for (const item of rec.data.slice(0, 60)) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: 'Geographic chart points must be objects with latitude and longitude' };
        const point = item as Record<string, unknown>;
        const lon = numberValue(point.lon ?? point.longitude ?? point.x);
        const lat = numberValue(point.lat ?? point.latitude ?? point.y);
        const value = point.value === undefined ? null : numberValue(point.value);
        if (lon === null || lat === null || lon < -180 || lon > 180 || lat < -90 || lat > 90 || (point.value !== undefined && value === null)) {
          return { ok: false, error: 'Geographic points need longitude in [-180,180], latitude in [-90,90], and a finite optional value' };
        }
        data.push({ x: lon, y: lat, ...(value !== null ? { value } : {}), ...(cleanString(point.label ?? point.name ?? point.location) ? { label: cleanString(point.label ?? point.name ?? point.location) } : {}) });
      }
    } else {
      for (const item of rec.data) {
        const number = numberValue(item);
        if (number === null) return { ok: false, error: 'Invalid chart data: NaN encountered' };
        data.push(number);
      }
      if (data.length > labels.length) data.splice(labels.length);
      else while (data.length < labels.length) data.push(0);
    }

    if (data.length === 0) return { ok: false, error: 'Chart dataset must contain at least one data point' };
    totalPoints += data.length;
    if (chartType === 'geo' && totalPoints > 120) return { ok: false, error: 'Geographic charts are capped at 120 locations' };
    datasets.push({ label, data });
  }

  const unit = cleanString(raw.unit);
  const xLabel = cleanString(raw.xLabel);
  const yLabel = cleanString(raw.yLabel);
  return {
    ok: true,
    spec: {
      type: 'chart', chartType: chartType as ChartSpec['chartType'], labels, datasets,
      ...(unit ? { unit } : {}), ...(xLabel ? { xLabel } : {}), ...(yLabel ? { yLabel } : {}),
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

function validateMath(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: MathSpec } | { ok: false; error: string } {
  const latex = cleanString(raw.latex, 8000);
  if (!latex) {
    return { ok: false, error: 'math must have non-empty latex' };
  }
  let steps: MathStep[] | undefined = undefined;
  if (Array.isArray(raw.steps)) {
    steps = [];
    for (const s of raw.steps) {
      if (s && typeof s === 'object') {
        const stepLatex = cleanString((s as Record<string, unknown>).latex, 4000);
        if (stepLatex) {
          const stepNote = cleanString((s as Record<string, unknown>).note, 500);
          steps.push({ latex: stepLatex, ...(stepNote ? { note: stepNote } : {}) });
        }
      }
    }
    if (steps.length > 30) {
      warnings.push('Math steps capped at 30');
      steps = steps.slice(0, 30);
    }
  }
  return {
    ok: true,
    spec: {
      type: 'math',
      latex,
      ...(steps && steps.length > 0 ? { steps } : {}),
    },
  };
}

function validateCode(raw: Record<string, unknown>, _warnings: string[]): { ok: true; spec: CodeSpec } | { ok: false; error: string } {
  const codeRaw = raw.code;
  const code = typeof codeRaw === 'string' ? codeRaw : '';
  if (!code.trim()) {
    return { ok: false, error: 'code must have non-empty code' };
  }
  const language = cleanString(raw.language ?? raw.lang) || 'text';
  const filename = cleanString(raw.filename ?? raw.file);
  return {
    ok: true,
    spec: {
      type: 'code',
      language,
      code,
      ...(filename ? { filename } : {}),
    },
  };
}

function validateChecklist(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: ChecklistSpec } | { ok: false; error: string } {
  let rawItems = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.tasks) ? raw.tasks : [];
  if (rawItems.length === 0) return { ok: false, error: 'checklist must have at least 1 item' };
  if (rawItems.length > 40) {
    warnings.push('Checklist items capped at 40');
    rawItems = rawItems.slice(0, 40);
  }

  const items: ChecklistItem[] = [];
  for (const item of rawItems) {
    if (typeof item === 'string') {
      const text = cleanString(item, 500);
      if (text) items.push({ text });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const text = cleanString(rec.text ?? rec.title ?? rec.label, 500);
    if (!text) continue;
    const detail = cleanString(rec.detail ?? rec.description, 800);
    items.push({ text, ...(detail ? { detail } : {}), ...(typeof rec.checked === 'boolean' ? { checked: rec.checked } : {}) });
  }
  if (items.length === 0) return { ok: false, error: 'checklist must have at least 1 valid item' };
  return { ok: true, spec: { type: 'checklist', items } };
}

function validateForm(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: FormSpec } | { ok: false; error: string } {
  let rawFields = Array.isArray(raw.fields) ? raw.fields : [];
  if (rawFields.length === 0) return { ok: false, error: 'form must have at least 1 field' };
  if (rawFields.length > 20) {
    warnings.push('Form fields capped at 20');
    rawFields = rawFields.slice(0, 20);
  }
  const allowed = ['text', 'email', 'number', 'textarea', 'select', 'radio', 'checkbox', 'date', 'range'];
  const ids = new Set<string>();
  const fields: FormFieldSpec[] = [];
  for (let index = 0; index < rawFields.length; index++) {
    const value = rawFields[index];
    if (!value || typeof value !== 'object') return { ok: false, error: 'Form field must be an object' };
    const rec = value as Record<string, unknown>;
    const label = cleanString(rec.label ?? rec.title, 160);
    if (!label) return { ok: false, error: 'Form field label is required' };
    const type = cleanString(rec.type).toLowerCase();
    if (!allowed.includes(type)) return { ok: false, error: `Unsupported form field type "${type}"` };
    let id = cleanString(rec.id, 80).replace(/[^a-zA-Z0-9_-]/g, '-');
    if (!id || ids.has(id)) id = `field-${index + 1}`;
    while (ids.has(id)) id = `${id}-${index + 1}`;
    ids.add(id);
    const options = Array.isArray(rec.options) ? rec.options.map((option) => cleanString(option, 160)).filter(Boolean).slice(0, 30) : [];
    if ((type === 'select' || type === 'radio') && options.length < 2) {
      return { ok: false, error: `${type} field "${label}" must have at least 2 options` };
    }
    const min = typeof rec.min === 'number' && Number.isFinite(rec.min) ? rec.min : undefined;
    const max = typeof rec.max === 'number' && Number.isFinite(rec.max) ? rec.max : undefined;
    if (min !== undefined && max !== undefined && min > max) return { ok: false, error: `Form field "${label}" has min greater than max` };
    const step = typeof rec.step === 'number' && Number.isFinite(rec.step) && rec.step > 0 ? rec.step : undefined;
    if (rec.value !== undefined) {
      if (type === 'select' || type === 'radio') {
        if (typeof rec.value !== 'string' || !options.includes(rec.value)) return { ok: false, error: `Default value for "${label}" must match one of its options` };
      } else if (type === 'checkbox') {
        if (typeof rec.value !== 'boolean') return { ok: false, error: `Default value for "${label}" must be true or false` };
      } else if (type === 'number' || type === 'range') {
        if (typeof rec.value !== 'number' || !Number.isFinite(rec.value) || (min !== undefined && rec.value < min) || (max !== undefined && rec.value > max)) {
          return { ok: false, error: `Default value for "${label}" must be a number within its bounds` };
        }
      } else if (typeof rec.value !== 'string') {
        return { ok: false, error: `Default value for "${label}" must be text` };
      }
    }
    const field: FormFieldSpec = {
      id, label, type: type as FormFieldSpec['type'],
      ...(rec.required === true ? { required: true } : {}),
      ...(cleanString(rec.placeholder, 180) ? { placeholder: cleanString(rec.placeholder, 180) } : {}),
      ...(cleanString(rec.help ?? rec.description, 300) ? { help: cleanString(rec.help ?? rec.description, 300) } : {}),
      ...(options.length ? { options } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      ...(step !== undefined ? { step } : {}),
    };
    if (typeof rec.value === 'string' || typeof rec.value === 'number' || typeof rec.value === 'boolean') field.value = rec.value;
    fields.push(field);
  }
  return { ok: true, spec: {
    type: 'form', fields,
    ...(cleanString(raw.description, 500) ? { description: cleanString(raw.description, 500) } : {}),
    ...(cleanString(raw.submitLabel, 60) ? { submitLabel: cleanString(raw.submitLabel, 60) } : {}),
  } };
}

function validateImage(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: ImageSpec } | { ok: false; error: string } {
  const src = cleanString(raw.src, 2048);
  const alt = cleanString(raw.alt, 500);
  if (!src) return { ok: false, error: 'image must have a source URL' };
  if (!alt) return { ok: false, error: 'image must have descriptive alt text' };
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.username || url.password) return { ok: false, error: 'image source must be a credential-free HTTPS URL' };
  } catch {
    return { ok: false, error: 'image source must be a valid HTTPS URL' };
  }
  let aspect = cleanString(raw.aspect).toLowerCase();
  if (!['auto', 'wide', 'square', 'portrait'].includes(aspect)) {
    if (raw.aspect !== undefined) warnings.push('Invalid image aspect, defaulting to auto');
    aspect = 'auto';
  }
  let fit = cleanString(raw.fit).toLowerCase();
  if (!['contain', 'cover'].includes(fit)) {
    if (raw.fit !== undefined) warnings.push('Invalid image fit, defaulting to contain');
    fit = 'contain';
  }
  const caption = cleanString(raw.caption, 500);
  return { ok: true, spec: {
    type: 'image', src, alt, aspect: aspect as ImageSpec['aspect'], fit: fit as ImageSpec['fit'],
    ...(caption ? { caption } : {}),
  } };
}

function validateDashboard(raw: Record<string, unknown>, warnings: string[]): { ok: true; spec: DashboardSpec } | { ok: false; error: string } {
  let rawItems = Array.isArray(raw.items) ? raw.items : [];
  if (rawItems.length < 2) return { ok: false, error: 'dashboard must have at least 2 visual items' };
  if (rawItems.length > 8) {
    warnings.push('Dashboard items capped at 8');
    rawItems = rawItems.slice(0, 8);
  }
  const items: DashboardPanel[] = [];
  for (let index = 0; index < rawItems.length; index++) {
    const item = rawItems[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: `Dashboard item ${index + 1} must be an object` };
    const rec = item as Record<string, unknown>;
    const visualRaw = rec.visual ?? rec.spec;
    if (!visualRaw || typeof visualRaw !== 'object' || Array.isArray(visualRaw)) return { ok: false, error: `Dashboard item ${index + 1} must contain a visual object` };
    const visualType = (visualRaw as Record<string, unknown>).type;
    if (visualType === 'dashboard' || visualType === 'generic') return { ok: false, error: 'Dashboard panels cannot contain another dashboard or generic fallback' };
    const validated = validateSpec(visualRaw);
    if (!validated.ok) return { ok: false, error: `Dashboard item ${index + 1}: ${validated.error}` };
    if (validated.spec.type === 'dashboard' || validated.spec.type === 'generic') return { ok: false, error: 'Dashboard panels must use supported visual types' };
    warnings.push(...validated.warnings);
    const title = cleanString(rec.title, 120);
    items.push({ visual: validated.spec as DashboardPanel['visual'], ...(title ? { title } : {}) });
  }
  return { ok: true, spec: { type: 'dashboard', items } };
}

function validateGeneric(raw: Record<string, unknown>, _warnings: string[]): { ok: true; spec: GenericSpec } | { ok: false; error: string } {
  const title = cleanString(raw.title);
  const originalType = cleanString(raw.originalType);
  return {
    ok: true,
    spec: {
      type: 'generic',
      ...(title ? { title } : {}),
      ...(originalType ? { originalType } : {}),
      data: raw,
    },
  };
}

export function validateSpec(input: unknown): ValidateResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'unknown type' };
  }

  const raw = input as Record<string, unknown>;
  const warnings: string[] = [];

  // If type is unknown (not in our list), fall back to generic card
  const knownTypes = UI_TYPES.filter((t) => t !== 'generic');
  if (typeof raw.type !== 'string' || !(knownTypes as readonly string[]).includes(raw.type)) {
    if (typeof raw.type === 'string' && raw.type.length > 0) {
      // Unknown type with a string type field -> render as generic
      const rawWithType = { ...raw, originalType: raw.type };
      const result = validateGeneric(rawWithType, warnings);
      if (result.ok) {
        const title = cleanString(raw.title);
        if (title) result.spec.title = title;
        return { ok: true, spec: result.spec, warnings };
      }
    }
    return { ok: false, error: 'unknown type' };
  }

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
    case 'math':
      result = validateMath(raw, warnings);
      break;
    case 'code':
      result = validateCode(raw, warnings);
      break;
    case 'checklist':
      result = validateChecklist(raw, warnings);
      break;
    case 'form':
      result = validateForm(raw, warnings);
      break;
    case 'image':
      result = validateImage(raw, warnings);
      break;
    case 'dashboard':
      result = validateDashboard(raw, warnings);
      break;
    case 'generic':
      result = validateGeneric(raw, warnings);
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
