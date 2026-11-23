# BetterView AI

BetterView AI is a Chrome extension that renders JSON visual blocks inside Gemini (`gemini.google.com`), Grok (`grok.com`), ChatGPT (`chatgpt.com`), and Claude (`claude.ai`). Components are isolated in a Shadow DOM so their styling does not leak into the host chat.

BetterView AI supports 18 visual types:
1. **Flow** (`flow`): Interactive process and architecture diagrams with movable nodes, attached orthogonal connectors, groups, and decision branches. Drag a node and its edges follow; pan the canvas or use zoom and fit controls for larger flows.
2. **Stepper** (`stepper`): Sequential steps and tutorials.
3. **Table** (`table`): Sortable data tables with numeric and unit-aware sorting.
4. **Compare** (`compare`): Side-by-side trade-offs.
5. **Quiz** (`quiz`): Interactive multiple-choice questions with feedback.
6. **Chart** (`chart`): Bar, line, area, pie, doughnut, radar, scatter, and bubble charts, plus compact heatmaps and geographic point maps.
7. **Mermaid** (`mermaid`): Sequence, state, class, and ER diagrams, parsed safely.
8. **Callout** (`callout`): Tips, notices, warnings, and takeaways.
9. **Stats** (`stats`): Compact KPI metric cards.
10. **Tabs** (`tabs`): Categorized views and lists.
11. **Timeline** (`timeline`): Milestones and chronological roadmaps.
12. **Follow-ups** (`followups`): Clickable suggested prompts.
13. **Math** (`math`): Formulas and step-by-step derivations.
14. **Code** (`code`): Syntax-highlighted code snippets.
15. **Checklist** (`checklist`): Interactive tasks with completion progress.
16. **Form** (`form`): Structured text, choice, and range inputs.
17. **Image** (`image`): An illustration or infographic from a real HTTPS URL, with required descriptive alt text.
18. **Dashboard** (`dashboard`): A compact grid of 2–8 supported visual panels; nested dashboards are not allowed.

---

## Requirements

- **Browser**: Google Chrome or Chromium-based browser supporting Manifest V3 (MV3, Chrome 116+)
- **Node.js**: 18+ (Node 20+ recommended, for building from source)

---

## Installation

### Option 1: Install from Release ZIP (Recommended)

1. Download the latest `betterview-ai-v<version>.zip` from [GitHub Releases](https://github.com/hardikguptaofficialgit/betterview/releases) or build it locally with `npm run package`.
2. Extract the downloaded `.zip` file into a directory on your machine.
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Enable the **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked** in the top-left corner.
6. Select the extracted folder containing `manifest.json`.
7. BetterView AI is now installed and active!

### Option 2: Build from Source

```bash
git clone https://github.com/hardikguptaofficialgit/betterview.git
cd betterview
npm install
npm run build
```

Then in Chrome (`chrome://extensions/` with Developer mode enabled), click **Load unpacked** and select the `dist/` folder.

To create a zipped store release package:
```bash
npm run package
```
This produces `release/betterview-ai-v<version>.zip`.

---

## Set Up System Instruction

To have a supported assistant emit visual blocks, provide the system instruction that describes the schemas:

### Method A: One-Click Auto-Setup (Recommended)
1. Click the BetterView AI extension icon in your Chrome toolbar.
2. In the popup, click **Set up** next to Google Gemini or Grok.
3. A tab will open to that host's settings and append the BetterView instruction without replacing existing text.

One-click setup is available for Gemini and Grok. ChatGPT and Claude are supported for rendering; add the prompt manually using the instructions below.

### Method B: Manual Copy & Paste
1. Click the BetterView AI extension icon in your Chrome toolbar.
2. In the "Manual setup" section, click the **Copy** button to copy the full system instruction to your clipboard.
3. **Gemini**: Paste into custom instructions in **Settings › Instructions for Gemini** (or in a Gem's instructions).
4. **Grok**: Paste into **Settings › Customize › Custom Instructions** (or a Project's instructions).
5. **ChatGPT** and **Claude**: Paste into the assistant's custom or project instructions. Their settings labels can change; this extension does not automate setup on these sites.

---

## Try-It Prompt

Test your setup by pasting the following prompt into a new chat on any supported assistant:

> "Design a URL shortener like bit.ly. Show the architecture, the request flow, the steps to build it, SQL vs NoSQL for it, a capacity table, and a 3-question quiz."

Watch the model generate the response: BetterView AI streams skeleton loaders and instantly renders the visual components as the JSON blocks complete!

---

## Offline Fixture

To view the local light/dark rendering examples and Gemini/Grok host simulations without opening a live assistant:

```bash
npm run fixture
```

Open `fixture-dist/fixture.html` directly in your browser. The fixture demonstrates the visual examples, including a URL-shortener write-path graph for moving nodes and checking attached edges, plus simulated Gemini/Grok DOMs for block detection and streaming. Automated tests cover the newer chart modes, image/dashboard components, and ChatGPT/Claude adapters. The offline fixture does not fetch external images; image visuals require an HTTPS source and may be blocked by the host page's policy.

---

## Permissions

BetterView AI requests the minimal set of permissions required to function:

- **`storage`**: Used exclusively to store local user preferences (such as theme mode: auto, light, or dark) and onboarding status (e.g. whether the welcome tour was shown). No personal data or chat content is ever stored.
- **Host Permissions** (`https://gemini.google.com/*`, `https://grok.com/*`, `https://chatgpt.com/*`, `https://claude.ai/*`): Required to inject the content script that detects visual blocks and mounts components on the four supported sites.

---

## Privacy & Security

- **Zero Data Collection**: BetterView AI does not collect, track, or transmit user data, conversations, browsing history, or telemetry.
- **No Extension Backend or Telemetry Requests**: Parsing, validation, and rendering run locally. If a model emits an image visual, the browser loads only its explicit HTTPS image URL; the image host receives that request, the referrer is omitted, and the chat site's content policy may block it.
- **Pure Client-Side Code**: No remote scripts, no CDNs, and no `eval`. All scripts, SVGs (Phosphor Icons), and dependencies are bundled locally.
- **Shadow DOM Isolation**: Rendered components reside inside isolated Shadow Roots with adopted stylesheets, completely isolating components from host scripts and styles.
- **Strict Untrusted Input Sanitation**: Model outputs are treated as untrusted data: strings use safe DOM creation; SVGs are parsed through `DOMParser` with syntax checks; image URLs must be credential-free HTTPS URLs and need descriptive alt text.

---

## Schema Reference

All visual components are emitted as fenced code blocks with language `ui` containing a single valid JSON object.

### 1. Flow (`flow`)
```json
{
  "type": "flow",
  "title": "URL shortener architecture",
  "groups": [
    { "id": "client", "label": "Client layer", "color": "blue" },
    { "id": "api", "label": "API layer", "color": "purple" }
  ],
  "nodes": [
    { "id": "u", "label": "User", "sub": "Pastes long URL", "icon": "globe", "color": "blue", "group": "client" },
    { "id": "svc", "label": "Shorten API", "sub": "POST /shorten", "icon": "hard-drives", "color": "purple", "group": "api" }
  ],
  "edges": [
    { "from": "u", "to": "svc", "label": "Request" }
  ]
}
```

### 2. Stepper (`stepper`)
```json
{
  "type": "stepper",
  "title": "Build the URL shortener",
  "steps": [
    { "title": "Design the API", "detail": "Define REST endpoints for URL creation and redirection." },
    { "title": "Generate short codes", "detail": "Compute unique 6 to 7 character alphanumeric Base62 hashes." },
    { "title": "Store mappings", "detail": "Persist mapping between short codes and original destination URLs." }
  ]
}
```

### 3. Table (`table`)
```json
{
  "type": "table",
  "title": "Capacity estimates",
  "columns": ["Metric", "Value", "Notes"],
  "rows": [
    ["New URLs/day", "1M", "Write volume"],
    ["Redirects/day", "100M", "Read volume"],
    ["Read:write ratio", "100:1", "Read-heavy workload"]
  ]
}
```

### 4. Compare (`compare`)
```json
{
  "type": "compare",
  "title": "SQL vs NoSQL for URL Store",
  "items": [
    {
      "label": "SQL",
      "tone": "good",
      "points": [
        "ACID transactions guarantee unique short codes.",
        "Immediate consistency for resolves."
      ]
    },
    {
      "label": "NoSQL",
      "tone": "bad",
      "points": [
        "Eventual consistency can cause transient 404s.",
        "Requires distributed locks for uniqueness."
      ]
    }
  ]
}
```

### 5. Quiz (`quiz`)
```json
{
  "type": "quiz",
  "title": "Check your understanding",
  "questions": [
    {
      "q": "Why is Base62 commonly used for short URLs?",
      "options": [
        "It is encrypted so users cannot guess destination URLs",
        "It uses alphanumeric characters safe for URLs without escaping",
        "It compresses binary data better than Base64"
      ],
      "answer": 1,
      "explain": "Base62 uses alphanumeric characters [0-9, a-z, A-Z] which are URL-safe."
    }
  ]
}
```

### 6. Chart (`chart`)
```json
{
  "type": "chart",
  "title": "Redirects per day (millions)",
  "chartType": "bar",
  "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "datasets": [
    { "label": "Redirects", "data": [12, 19, 15, 17, 24, 28, 22] }
  ],
  "unit": "M"
}
```
*Supported `chartType`: `bar`, `line`, `area`, `pie`, `doughnut`, `radar`, `scatter`, `bubble`, `heatmap`, `geo`.*

Area charts use line-style numeric datasets. Scatter points use `{"x": 2, "y": 12}`; bubble points also require a positive `r`. Heatmaps use numeric arrays per dataset (one dataset per row, with column `labels`). Geographic points use `{"lon": -73.9, "lat": 40.7, "label": "New York"}`; `longitude`/`latitude` are accepted too.

### 7. Mermaid (`mermaid`)
```json
{
  "type": "mermaid",
  "title": "Redirect sequence",
  "code": "sequenceDiagram\n  Client->>API: GET /:shortCode\n  API->>Cache: Lookup shortCode\n  Cache-->>API: destination URL\n  API-->>Client: 301 Redirect"
}
```

### 8. Callout (`callout`)
```json
{
  "type": "callout",
  "title": "Hash Collision Handling",
  "tone": "warning",
  "icon": "shield-warning",
  "message": "Always verify uniqueness in the database before storing the generated short code."
}
```
*Supported `tone`: `info`, `tip`, `warning`, `success`.*

### 9. Stats (`stats`)
```json
{
  "type": "stats",
  "title": "System Performance",
  "items": [
    { "label": "Average Latency", "value": "12ms", "change": "-3ms", "trend": "up", "icon": "lightning" },
    { "label": "Cache Hit Rate", "value": "99.4%", "trend": "up", "icon": "database" },
    { "label": "Active Users", "value": "1.2M", "change": "+8%", "trend": "up", "icon": "users" }
  ]
}
```

### 10. Tabs (`tabs`)
```json
{
  "type": "tabs",
  "title": "Database Sharding Strategies",
  "tabs": [
    { "id": "range", "label": "Range Based", "content": "Partition keys grouped by range (e.g. A-M, N-Z)." },
    { "id": "hash", "label": "Hash Based", "content": "Consistent hashing across database nodes." }
  ]
}
```

### 11. Timeline (`timeline`)
```json
{
  "type": "timeline",
  "title": "Migration Roadmap",
  "events": [
    { "date": "Q1", "title": "Dual-write", "detail": "Write new records to both legacy and shortener stores.", "icon": "clock" },
    { "date": "Q2", "title": "Backfill", "detail": "Migrate historical records asynchronously.", "icon": "hard-drives" },
    { "date": "Q3", "title": "Cutover", "detail": "Switch all read traffic to the new shortener cluster.", "icon": "rocket" }
  ]
}
```

### 12. Follow-ups (`followups`)
```json
{
  "type": "followups",
  "title": "Suggested Next Steps",
  "suggestions": [
    "How do we handle cache invalidation during updates?",
    "Explain Bloom filter integration for short code lookups",
    "Show a benchmark test script with k6"
  ]
}
```

### 13. Checklist (`checklist`)
```json
{
  "type": "checklist",
  "title": "Release prep",
  "items": [
    { "text": "Run tests", "detail": "Unit and integration", "checked": true },
    { "text": "Publish release notes", "checked": false }
  ]
}
```

### 14. Form (`form`)
```json
{
  "type": "form",
  "title": "Project preferences",
  "fields": [
    { "id": "name", "label": "Project name", "type": "text", "required": true },
    { "id": "plan", "label": "Plan", "type": "select", "options": ["Starter", "Pro"] }
  ]
}
```
*Supported field types: `text`, `email`, `number`, `textarea`, `select`, `radio`, `checkbox`, `date`, `range`.*

### 15. Code (`code`)
```json
{
  "type": "code",
  "title": "Example",
  "language": "typescript",
  "filename": "example.ts",
  "code": "const answer = 42;"
}
```

### 16. Math (`math`)
```json
{
  "type": "math",
  "title": "Compound growth",
  "latex": "A = P(1 + r)^t",
  "steps": [{ "latex": "P = 100, r = 0.05, t = 2", "note": "Substitute the values." }]
}
```

### 17. Image (`image`)
```json
{
  "type": "image",
  "title": "Request path illustration",
  "src": "https://images.example.com/replace-with-a-real-image.png",
  "alt": "A browser sends a request through an API to a cache and database",
  "caption": "Replace the example URL with an existing HTTPS image URL.",
  "aspect": "wide",
  "fit": "contain"
}
```
Only credential-free HTTPS URLs are accepted, and descriptive `alt` text is required. The browser loads the URL directly; an unavailable image or the site's content policy can prevent it from displaying.

### 18. Dashboard (`dashboard`)
```json
{
  "type": "dashboard",
  "title": "Service snapshot",
  "items": [
    {
      "title": "Availability",
      "visual": { "type": "stats", "items": [{ "label": "Uptime", "value": "99.9%" }, { "label": "Errors", "value": "0.1%" }] }
    },
    {
      "title": "Traffic",
      "visual": { "type": "chart", "chartType": "area", "labels": ["Mon", "Tue"], "datasets": [{ "label": "Visits", "data": [12, 19] }] }
    }
  ]
}
```
Dashboards support 2–8 panels. Each panel has a `visual` using another supported visual type; nested dashboards and generic fallback panels are not allowed.

---

## License

MIT © Hardik Gupta
