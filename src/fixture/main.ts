import { mountBlock, BlockHandle } from '../core/mount';
import { ThemeMode } from '../core/theme';
import { startScanner } from '../content/scanner';
import { GEMINI_ADAPTER, GROK_ADAPTER } from '../content/sites';

function createSideBySidePane(label: string, theme: ThemeMode): { pane: HTMLElement; target: HTMLElement } {
  const pane = document.createElement('div');
  pane.className = `fixture-pane fixture-pane-${theme}`;
  pane.setAttribute('data-theme', theme);

  const labelEl = document.createElement('div');
  labelEl.className = 'fixture-pane-label';
  labelEl.textContent = label;

  const target = document.createElement('div');
  target.className = 'fixture-mount-target';

  pane.appendChild(labelEl);
  pane.appendChild(target);
  return { pane, target };
}

function initFixture(): void {
  const handles: BlockHandle[] = [];
  const scanners: ReturnType<typeof startScanner>[] = [];
  let currentTheme: ThemeMode = (document.body.getAttribute('data-theme') as ThemeMode) || 'light';

  const mounts = document.querySelectorAll<HTMLElement>('.fixture-mount');
  mounts.forEach((mount) => {
    const specId = mount.getAttribute('data-spec-id');
    if (!specId) return;
    const scriptEl = document.getElementById(specId);
    if (!scriptEl || !scriptEl.textContent) return;

    const sbs = document.createElement('div');
    sbs.className = 'fixture-side-by-side';

    const light = createSideBySidePane('Light Mode', 'light');
    const dark = createSideBySidePane('Dark Mode', 'dark');

    sbs.appendChild(light.pane);
    sbs.appendChild(dark.pane);
    mount.appendChild(sbs);

    const lightHandle = mountBlock(light.target, { theme: 'light', insert: 'inside' });
    lightHandle.update(scriptEl.textContent.trim());
    handles.push(lightHandle);

    const darkHandle = mountBlock(dark.target, { theme: 'dark', insert: 'inside' });
    darkHandle.update(scriptEl.textContent.trim());
    handles.push(darkHandle);
  });

  // Streaming demo: sample 1 (skeleton -> flow)
  const streamingMount = document.getElementById('streaming-mount');
  if (streamingMount) {
    const sample1El = document.getElementById('flow-spec-grouped');
    const sample1Json = sample1El?.textContent?.trim() || '';

    const sbs = document.createElement('div');
    sbs.className = 'fixture-side-by-side';

    const light = createSideBySidePane('Light Mode', 'light');
    const dark = createSideBySidePane('Dark Mode', 'dark');

    sbs.appendChild(light.pane);
    sbs.appendChild(dark.pane);
    streamingMount.appendChild(sbs);

    const streamHandleLight = mountBlock(light.target, { theme: 'light', insert: 'inside' });
    const streamHandleDark = mountBlock(dark.target, { theme: 'dark', insert: 'inside' });
    handles.push(streamHandleLight, streamHandleDark);

    // Initial partial input produces skeleton
    streamHandleLight.update('{"type":"flow","title":"URL shortener architecture"');
    streamHandleDark.update('{"type":"flow","title":"URL shortener architecture"');

    // After 500ms, stream completes and transitions skeleton -> flow
    window.setTimeout(() => {
      streamHandleLight.update(sample1Json);
      streamHandleLight.finalize();
      streamHandleDark.update(sample1Json);
      streamHandleDark.finalize();
    }, 500);
  }

  // Multi-type streaming simulation in 15-char chunks
  const simulateStreamingBtn = document.getElementById('btn-simulate-streaming');
  const streamingAllMount = document.getElementById('streaming-all-mount');
  const streamingStatus = document.getElementById('streaming-status');

  const STREAM_SPEC_IDS = [
    'flow-spec-grouped',
    'stepper-spec',
    'table-capacity-spec',
    'compare-spec',
    'quiz-spec',
    'chart-bar-spec',
    'mermaid-sequence-spec',
    'callout-spec',
    'stats-spec',
    'tabs-spec',
    'timeline-spec',
    'followups-spec',
  ];

  if (simulateStreamingBtn && streamingAllMount) {
    let activeIntervals: number[] = [];

    simulateStreamingBtn.addEventListener('click', () => {
      // Clear any running intervals
      activeIntervals.forEach((id) => window.clearInterval(id));
      activeIntervals = [];

      streamingAllMount.innerHTML = '';
      if (streamingStatus) {
        streamingStatus.textContent = 'Streaming all 12 types in 15-char chunks (light & dark)...';
      }

      let completedCount = 0;

      STREAM_SPEC_IDS.forEach((specId, specIndex) => {
        const scriptEl = document.getElementById(specId);
        const fullJson = scriptEl?.textContent?.trim() || '';
        if (!fullJson) return;

        const sbs = document.createElement('div');
        sbs.className = 'fixture-side-by-side';

        const light = createSideBySidePane('Light Mode', 'light');
        const dark = createSideBySidePane('Dark Mode', 'dark');

        sbs.appendChild(light.pane);
        sbs.appendChild(dark.pane);
        streamingAllMount.appendChild(sbs);

        const lightHandle = mountBlock(light.target, { theme: 'light', insert: 'inside' });
        const darkHandle = mountBlock(dark.target, { theme: 'dark', insert: 'inside' });
        handles.push(lightHandle, darkHandle);

        let offset = 0;
        // Stagger the start of each component by 60ms
        const startDelay = specIndex * 60;

        window.setTimeout(() => {
          const intervalId = window.setInterval(() => {
            offset += 15;
            if (offset >= fullJson.length) {
              lightHandle.update(fullJson);
              lightHandle.finalize();
              darkHandle.update(fullJson);
              darkHandle.finalize();
              window.clearInterval(intervalId);
              completedCount++;
              if (completedCount === STREAM_SPEC_IDS.length && streamingStatus) {
                streamingStatus.textContent = 'Completed streaming all 12 types in 15-char chunks (light & dark)!';
              }
            } else {
              const partial = fullJson.slice(0, offset);
              lightHandle.update(partial);
              darkHandle.update(partial);
            }
          }, 30);

          activeIntervals.push(intervalId);
        }, startDelay);
      });
    });
  }

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.body.setAttribute('data-theme', currentTheme);
      toggleBtn.textContent = currentTheme === 'light' ? 'Switch Page to Dark' : 'Switch Page to Light';
      scanners.forEach((s) => s.setTheme(currentTheme));
    });
  }

  const runSimBtn = document.getElementById('btn-run-simulation');
  if (runSimBtn) {
    runSimBtn.addEventListener('click', () => {
      const simGemini = document.getElementById('sim-gemini');
      const simGrok = document.getElementById('sim-grok');
      const simStreaming = document.getElementById('sim-streaming');
      const simInvalid = document.getElementById('sim-invalid');

      if (simGemini) {
        scanners.push(startScanner(GEMINI_ADAPTER, () => currentTheme, simGemini));
      }
      if (simGrok) {
        scanners.push(startScanner(GROK_ADAPTER, () => currentTheme, simGrok));
      }
      if (simStreaming) {
        scanners.push(startScanner(GEMINI_ADAPTER, () => currentTheme, simStreaming));
      }
      if (simInvalid) {
        scanners.push(startScanner(GROK_ADAPTER, () => currentTheme, simInvalid));
      }

      // Stream text in 20-char chunks
      const streamCode = document.getElementById('sim-stream-code');
      if (streamCode) {
        const fullText = JSON.stringify({
          type: 'stepper',
          title: 'Streaming Simulation',
          steps: [
            { title: 'Step 1', detail: 'Connecting to service...' },
            { title: 'Step 2', detail: 'Received stream chunks.' },
          ],
        });
        streamCode.textContent = '';
        let offset = 0;
        const intervalId = window.setInterval(() => {
          if (offset < fullText.length) {
            const nextChunk = fullText.slice(offset, offset + 20);
            offset += 20;
            streamCode.textContent += nextChunk;
          } else {
            window.clearInterval(intervalId);
          }
        }, 50);
      }
    });
  }

  console.log(`[Fixture] mounted ${handles.length} blocks in side-by-side light and dark themes`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFixture);
} else {
  initFixture();
}
