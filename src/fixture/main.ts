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
