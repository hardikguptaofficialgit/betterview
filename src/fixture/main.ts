import { mountBlock, BlockHandle } from '../core/mount';
import { ThemeMode } from '../core/theme';

function initFixture(): void {
  const handles: BlockHandle[] = [];
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
    });
  }

  console.log(`[Fixture] mounted ${handles.length} blocks in ${currentTheme} theme`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFixture);
} else {
  initFixture();
}
