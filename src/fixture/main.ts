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
