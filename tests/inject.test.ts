// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { startAutoInject } from '../src/content/inject';
import { SiteAdapter } from '../src/content/sites';

describe('startAutoInject', () => {
  it('inserts instruction into textarea on Enter keydown in new chat', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const adapter: SiteAdapter = {
      id: 'gemini',
      matches: () => true,
      chatRoot: () => document.body,
      findCodeBlocks: () => [],
      languageOf: () => null,
      wrapperOf: (p) => p,
      composer: () => textarea,
      sendButton: () => null,
      isNewChat: () => true,
    };

    const instruction = 'Show visuals as fenced code blocks with language ui...';
    const stop = startAutoInject(adapter, instruction);

    textarea.value = 'My prompt';
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    textarea.dispatchEvent(event);

    expect(textarea.value).toBe(instruction + '\n\nMy prompt');

    // Second Enter does not duplicate on the same URL
    textarea.dispatchEvent(event);
    expect(textarea.value).toBe(instruction + '\n\nMy prompt');

    stop();
    textarea.remove();
  });

  it('does nothing if not a new chat', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const adapter: SiteAdapter = {
      id: 'grok',
      matches: () => true,
      chatRoot: () => document.body,
      findCodeBlocks: () => [],
      languageOf: () => null,
      wrapperOf: (p) => p,
      composer: () => textarea,
      sendButton: () => null,
      isNewChat: () => false,
    };

    const instruction = 'Show visuals as fenced code blocks with language ui...';
    const stop = startAutoInject(adapter, instruction);

    textarea.value = 'Hello';
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    textarea.dispatchEvent(event);

    expect(textarea.value).toBe('Hello');

    stop();
    textarea.remove();
  });

  it('inserts on send button click', () => {
    const textarea = document.createElement('textarea');
    const sendBtn = document.createElement('button');
    document.body.appendChild(textarea);
    document.body.appendChild(sendBtn);

    const adapter: SiteAdapter = {
      id: 'gemini',
      matches: () => true,
      chatRoot: () => document.body,
      findCodeBlocks: () => [],
      languageOf: () => null,
      wrapperOf: (p) => p,
      composer: () => textarea,
      sendButton: () => sendBtn,
      isNewChat: () => true,
    };

    const instruction = 'Show visuals as fenced code blocks with language ui...';
    const stop = startAutoInject(adapter, instruction);

    textarea.value = 'User query';
    const clickEvent = new MouseEvent('click', { bubbles: true });
    sendBtn.dispatchEvent(clickEvent);

    expect(textarea.value).toBe(instruction + '\n\nUser query');

    stop();
    textarea.remove();
    sendBtn.remove();
  });
});
