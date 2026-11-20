import { TabsSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';

export function renderTabs(spec: TabsSpec, ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-tabs-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const tabs = spec.tabs || [];
  let activeIndex = 0;

  const navContainer = h('div', { class: 'iui-tabs-nav', role: 'tablist' });
  const indicator = h('div', { class: 'iui-tabs-indicator' });
  navContainer.appendChild(indicator);

  const contentPanel = h('div', {
    class: 'iui-tabs-panel',
    role: 'tabpanel',
    tabindex: '0',
  });

  const tabButtons: HTMLButtonElement[] = [];

  function updateIndicator(btn: HTMLElement): void {
    const navRect = navContainer.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    if (navRect.width === 0) {
      // In tests or offscreen before layout
      indicator.style.left = `${btn.offsetLeft}px`;
      indicator.style.width = `${btn.offsetWidth || 80}px`;
      return;
    }
    const left = btnRect.left - navRect.left + navContainer.scrollLeft;
    const width = btnRect.width;
    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.width = `${width}px`;
  }

  function renderActiveContent(): void {
    clear(contentPanel);
    const tab = tabs[activeIndex];
    if (!tab) return;

    if (Array.isArray(tab.content)) {
      const ul = h('ul', { class: 'iui-tabs-list' });
      for (const item of tab.content) {
        ul.appendChild(h('li', { class: 'iui-tabs-list-item' }, item));
      }
      contentPanel.appendChild(ul);
    } else {
      const p = h('div', { class: 'iui-tabs-text' }, String(tab.content || ''));
      contentPanel.appendChild(p);
    }
  }

  function setActiveTab(idx: number): void {
    if (idx < 0 || idx >= tabs.length) return;
    activeIndex = idx;

    tabButtons.forEach((btn, i) => {
      const isActive = i === activeIndex;
      btn.setAttribute('aria-selected', String(isActive));
      btn.classList.toggle('is-active', isActive);
      if (isActive) {
        btn.setAttribute('tabindex', '0');
        updateIndicator(btn);
      } else {
        btn.setAttribute('tabindex', '-1');
      }
    });

    renderActiveContent();
  }

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const isInitial = i === 0;

    const btn = h(
      'button',
      {
        type: 'button',
        class: `iui-tabs-btn${isInitial ? ' is-active' : ''}`,
        role: 'tab',
        'aria-selected': String(isInitial),
        tabindex: isInitial ? '0' : '-1',
        onClick: () => {
          setActiveTab(i);
        },
        onKeydown: (event: Event) => {
          const e = event as KeyboardEvent;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = (activeIndex + 1) % tabs.length;
            setActiveTab(next);
            tabButtons[next]?.focus();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = (activeIndex - 1 + tabs.length) % tabs.length;
            setActiveTab(prev);
            tabButtons[prev]?.focus();
          }
        },
      },
      tab.label,
    ) as HTMLButtonElement;

    tabButtons.push(btn);
    navContainer.appendChild(btn);
  }

  card.appendChild(navContainer);
  card.appendChild(contentPanel);

  renderActiveContent();

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      if (tabButtons[0]) {
        updateIndicator(tabButtons[0]);
      }
    });
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      if (tabButtons[activeIndex]) {
        updateIndicator(tabButtons[activeIndex]);
      }
    });
    ro.observe(navContainer);
    ctx.onCleanup(() => ro.disconnect());
  }

  return card;
}
