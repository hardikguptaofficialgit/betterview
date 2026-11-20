import { mountBlock, BlockHandle } from '../core/mount';
import { ThemeMode } from '../core/theme';
import { startScanner } from '../content/scanner';
import { GEMINI_ADAPTER, GROK_ADAPTER } from '../content/sites';

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

    const handle = mountBlock(mount, { theme: currentTheme, insert: 'inside' });
    handle.update(scriptEl.textContent.trim());
    handles.push(handle);
  });

  // Streaming demo: sample 1 (skeleton -> flow)
  const streamingMount = document.getElementById('streaming-mount');
  if (streamingMount) {
    const sample1El = document.getElementById('flow-spec-grouped');
    const sample1Json = sample1El?.textContent?.trim() || '';

    const streamHandle = mountBlock(streamingMount, { theme: currentTheme, insert: 'inside' });
    handles.push(streamHandle);

    // Initial partial input produces skeleton
    streamHandle.update('{"type":"flow","title":"URL shortener architecture"');

    // After 500ms, stream completes and transitions skeleton -> flow
    window.setTimeout(() => {
      streamHandle.update(sample1Json);
      streamHandle.finalize();
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
        streamingStatus.textContent = 'Streaming all 12 types in 15-char chunks...';
      }

      let completedCount = 0;

      STREAM_SPEC_IDS.forEach((specId, specIndex) => {
        const scriptEl = document.getElementById(specId);
        const fullJson = scriptEl?.textContent?.trim() || '';
        if (!fullJson) return;

        const cardMount = document.createElement('div');
        cardMount.className = 'streaming-card-mount';
        streamingAllMount.appendChild(cardMount);

        const handle = mountBlock(cardMount, { theme: currentTheme, insert: 'inside' });
        handles.push(handle);

        let offset = 0;
        // Stagger the start of each component by 60ms
        const startDelay = specIndex * 60;

        window.setTimeout(() => {
          const intervalId = window.setInterval(() => {
            offset += 15;
            if (offset >= fullJson.length) {
              handle.update(fullJson);
              handle.finalize();
              window.clearInterval(intervalId);
              completedCount++;
              if (completedCount === STREAM_SPEC_IDS.length && streamingStatus) {
                streamingStatus.textContent = 'Completed streaming all 12 types in 15-char chunks!';
              }
            } else {
              const partial = fullJson.slice(0, offset);
              handle.update(partial);
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
      toggleBtn.textContent = currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
      handles.forEach((h) => h.setTheme(currentTheme));
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

  console.log(`[Fixture] mounted ${handles.length} blocks in ${currentTheme} theme`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFixture);
} else {
  initFixture();
}
