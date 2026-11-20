# BetterView AI

BetterView AI is a Chrome extension that transforms raw JSON fenced code blocks emitted by LLMs into rich, interactive, native visual components directly inside Gemini (`gemini.google.com`) and Grok (`grok.com`). When an AI model generates an architecture diagram, workflow steps, comparison, data table, interactive quiz, KPI metric, or timeline, BetterView AI renders it cleanly in a private Shadow DOM with zero styling leaks into the host page.

BetterView AI includes 12 interactive component types:
1. **Flow** (`flow`): Interactive node-and-edge process and architecture diagrams with orthogonal routing around nodes, Phosphor icons, decision branching, and group layers.
2. **Stepper** (`stepper`): Clean, sequential step-by-step progress cards with collapsible details.
3. **Table** (`table`): Formatted data tables with smart type detection and column sorting (alphanumeric, currency, percentages, SI units).
4. **Compare** (`compare`): Side-by-side comparison cards with semantic positive/negative tone styling (e.g. SQL vs NoSQL, Pros vs Cons).
5. **Quiz** (`quiz`): Interactive multiple-choice assessment cards with real-time feedback and explanations.
6. **Chart** (`chart`): Clean Chart.js visualizations (bar, line, pie, doughnut, radar) with no animations, custom tooltips, and pastel palettes.
7. **Mermaid** (`mermaid`): Standard Mermaid diagram rendering (sequence diagrams, state diagrams, class diagrams, ER diagrams) parsed safely via DOMParser.
8. **Callout** (`callout`): Attention cards for key takeaways, warnings, tips, success announcements, and info notes with optional Phosphor icons.
9. **Stats** (`stats`): Metric and KPI highlight grids with values, trend indicators, and optional Phosphor icons.
10. **Tabs** (`tabs`): Multi-panel tabbed switchers for organized subtopics and alternative viewpoints.
11. **Timeline** (`timeline`): Chronological milestone tracks, roadmaps, and event progressions with optional Phosphor icons.
12. **Follow-ups** (`followups`): Clickable suggestion chips to seamlessly steer the next turn of the conversation.

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

To have Gemini or Grok emit the visual blocks, you provide a system instruction telling the model how to format the visuals:

### Method A: One-Click Auto-Setup (Recommended)
1. Click the BetterView AI extension icon in your Chrome toolbar.
2. In the popup, click **Set up** next to Google Gemini or Grok.
3. A tab will open to the host's settings, automatically append the BetterView instruction without modifying existing settings, and confirm setup.

### Method B: Manual Copy & Paste
1. Click the BetterView AI extension icon in your Chrome toolbar.
2. In the "Manual setup" section, click the **Copy** button to copy the full system instruction to your clipboard.
3. **Gemini**: Paste into custom instructions in **Settings › Instructions for Gemini** (or in a Gem's instructions).
4. **Grok**: Paste into **Settings › Customize › Custom Instructions** (or a Project's instructions).

---

## Try-It Prompt

Test your setup by pasting the following prompt into a new chat on Gemini or Grok:

> "Design a URL shortener like bit.ly. Show the architecture, the request flow, the steps to build it, SQL vs NoSQL for it, a capacity table, and a 3-question quiz."

Watch the model generate the response: BetterView AI streams skeleton loaders and instantly renders the visual components as the JSON blocks complete!

---

## Offline Fixture

To view and test all visual components and host simulations locally without accessing Gemini or Grok:

```bash
npm run fixture
```

Open `fixture-dist/fixture.html` directly in your browser. The fixture showcases all 12 component types and simulated Gemini and Grok DOMs to test block detection, streaming chunks, and graceful fallback handling.

---

## Permissions

BetterView AI requests the minimal set of permissions required to function:

- **`storage`**: Used exclusively to store local user preferences (such as theme mode: auto, light, or dark) and onboarding status (e.g. whether the welcome tour was shown). No personal data or chat content is ever stored.
- **Host Permissions (`https://gemini.google.com/*`, `https://grok.com/*`)**: Required solely to inject the content script that detects visual component code blocks and mounts UI cards into the chat DOM on these two supported sites.

---

## Privacy & Security

- **Zero Data Collection**: BetterView AI does not collect, track, or transmit any user data, conversations, browsing history, or telemetry.
- **No External Network Requests**: BetterView AI makes zero network calls. All parsing, validation, and rendering occur 100% locally within your browser.
- **Pure Client-Side Code**: No remote scripts, no CDNs, and no `eval`. All scripts, SVGs (Phosphor Icons), and dependencies are bundled locally.
- **Shadow DOM Isolation**: Rendered components reside inside isolated Shadow Roots with adopted stylesheets, completely isolating components from host scripts and styles.
- **Strict Untrusted Input Sanitation**: Model outputs are treated as untrusted data: strings are rendered via `textContent` / safe DOM creation helpers; SVGs are parsed through `DOMParser` with strict syntax checks; no `innerHTML` is ever used.

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
*Supported `chartType`: `bar`, `line`, `pie`, `doughnut`, `radar`.*

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

---

## License

MIT © Hardik Gupta
