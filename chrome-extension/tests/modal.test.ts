import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define chrome on global before importing the content script
const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: vi.fn((keys, callback) => callback?.({})),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.chrome = chromeMock as any;

import { openModal, hideModal } from '../src/content/modal.svelte';

describe('Modal Content Script', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="test">Hello World</div>';
    vi.spyOn(console, 'log');
  });

  it('should open modal when openModal is called', () => {
    openModal('test');
    const host = document.getElementById('mem-it-modal-host');
    expect(host).toBeInTheDocument();
    expect(host?.style.display).toBe('block');
  });

  it('should hide modal when hideModal is called', () => {
    openModal('test');
    hideModal();
    const host = document.getElementById('mem-it-modal-host');
    expect(host?.style.display).toBe('none');
  });

  it('should show error if text exceeds 20 words', () => {
    const longText = 'word '.repeat(21).trim();
    openModal(longText);
    const host = document.getElementById('mem-it-modal-host');
    expect(host).toBeInTheDocument();

    // Since we use Shadow DOM, we must look inside the shadow root
    const shadow = host?.shadowRoot;
    expect(shadow).toBeTruthy();
    if (shadow) {
      const hint = shadow.querySelector('.hint-message');
      expect(hint).toBeInTheDocument();
      expect(hint?.textContent).toMatch(/at most 20 words/i);
    }
  });
});
