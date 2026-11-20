# BetterView

BetterView is a Chrome extension that transforms raw JSON fenced code blocks emitted by LLMs into rich, interactive, native visual components directly inside Gemini (gemini.google.com) and Grok (grok.com). When an AI model generates an architecture diagram, workflow steps, comparison, data table, interactive quiz, or metrics chart, BetterView renders it cleanly in a private Shadow DOM with zero styling leaks into the host page.

BetterView includes 7 interactive component types:
1. **Flow**: Interactive node-and-edge process and architecture diagrams with Lucide icons, decision branching, and group layers.
2. **Stepper**: Clean, sequential step-by-step progress cards.
3. **Table**: Formatted data tables with smart type detection and column sorting (alphanumeric, currency, percentages, SI units).
4. **Compare**: Side-by-side comparison cards with semantic positive/negative tone styling (e.g. SQL vs NoSQL, Pros vs Cons).
5. **Quiz**: Interactive multiple-choice assessment cards with real-time feedback and explanations.
6. **Chart**: Clean Chart.js visualizations (bar, line, pie, doughnut, radar) with no animations, custom tooltips, and pastel palettes.
7. **Mermaid**: Standard Mermaid diagram rendering (sequence diagrams, state diagrams, class diagrams) parsed safely via DOMParser.

---

## Requirements

- **Node.js**: 18+ (Node 20+ recommended)
- **Browser**: Google Chrome or Chromium-based browser supporting Manifest V3 (MV3)

---

## Build

Install dependencies and build the extension:

```bash
npm install
npm run build
```

This compiles:
- `dist/popup.html`, `dist/assets/*` (extension popup)
- `dist/content.js` (single IIFE content script for Gemini & Grok)
- `dist/background.js` (single IIFE service worker)
- `dist/manifest.json` and static icons

To build the offline test fixture harness:

```bash
npm run fixture
```

---

## Install

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** toggle in the top right corner.
3. Click **Load unpacked**.
4. Select the `dist/` folder inside this repository (`intelligent-ui-ext/dist`).
5. BetterView is now installed and active on `https://gemini.google.com/*` and `https://grok.com/*`.

---

## Set Up System Instruction

To have Gemini or Grok emit the visual blocks, you provide a system instruction telling the model how to format the visuals:

### Method A: One-Click Auto-Setup (Recommended)
1. Click the BetterView extension icon in your Chrome toolbar.
2. In the popup, click **Set up Gemini** or **Set up Grok**.
3. A tab will open to the host's settings, automatically append the BetterView instruction without modifying existing settings, and confirm setup.

### Method B: Manual Copy & Paste
1. Click the BetterView extension icon in your Chrome toolbar.
2. Click the **Copy** button in the popup to copy the full system instruction to your clipboard.
3. **Gemini**: Paste into custom instructions in **Settings › Instructions for Gemini** (or in a Gem's instructions).
4. **Grok**: Paste into **Settings › Customize › Custom Instructions** (or a Project's instructions).

---

## Try-It Prompt

Test your setup by pasting the following prompt into a new chat on Gemini or Grok:

> "Design a URL shortener like bit.ly. Show the architecture, the request flow, the steps to build it, SQL vs NoSQL for it, a capacity table, and a 3-question quiz."

Watch the model generate the response: BetterView will stream skeleton loaders and instantly render the visual components as the JSON blocks complete!

---

## Offline Fixture

To view and test all 7 visual components and host simulations locally without accessing Gemini or Grok:

```bash
npm run fixture
```

Open `fixture-dist/fixture.html` directly in your browser. The fixture showcases:
- Steppers, capacity tables, sorting tests (12 rows of mixed numbers), side-by-side comparisons, quizzes, architecture flows, line/bar/doughnut/radar charts, sequence diagrams, and streaming transitions.
- A **Host simulation** section with simulated Gemini and Grok DOMs to test block detection, streaming chunks, and graceful fallback handling.

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
    { "id": "svc", "label": "Shorten API", "sub": "POST /shorten", "icon": "server", "color": "purple", "group": "api" }
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

---

## Troubleshooting

- **Blocks are not rendering on the host page**: Host selectors may have changed due to site updates. Inspect the code block element in Developer Tools on Gemini or Grok, and adjust the selectors in [src/content/sites.ts](file:///C:/Users/hardi/intelligent-ui-ext/src/content/sites.ts).
- **JSON is displayed as raw text**: If the model emitted malformed or truncated JSON that could not be repaired, BetterView safely un-hides the raw code block and presents a subtle notice above it. Ask the model to regenerate the block.
- **Theme mismatch**: BetterView automatically tracks host theme changes. If the theme doesn't match your preference, click the BetterView popup icon and select **Light** or **Dark** under the Theme dropdown.

---

## Privacy & Security

- **Zero Network Calls**: BetterView makes absolutely no external network requests and collects no telemetry. No data ever leaves your browser.
- **No Remote Code**: No CDN, no remote fonts, no `eval`, and no `new Function`. All scripts and dependencies are bundled locally into `dist/`.
- **Shadow DOM Isolation**: All rendered components reside inside closed/isolated Shadow Roots with adopted stylesheets, completely isolating components from host scripts and styles.
- **Untrusted Input Sanitation**: Model outputs are treated as untrusted data: strings are rendered via `textContent` / DOM creation helpers; SVGs are parsed through `DOMParser` with strict syntax checks; no `innerHTML` is ever used.

---

## Known Limits

- **Auto-Insert is Experimental**: The auto-insert feature modifies the message composer on initial submission. While non-destructive, host updates may affect event capture.
- **Host DOM Changes**: Both Gemini and Grok frequently update their web clients. If DOM selectors change, update `src/content/sites.ts`.
- **Component State Across Reloads**: Interactive state (such as answered quiz questions) is kept in-memory within the Shadow DOM and resets on full page reload.
