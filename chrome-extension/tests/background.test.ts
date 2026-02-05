import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the chrome object
const chromeMock = {
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    onInstalled: {
      addListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
    },
  },
  sidePanel: {
    open: vi.fn(),
    setPanelOptions: vi.fn(),
  },
  storage: {
    local: {
      set: vi.fn((data, callback) => callback?.()),
      get: vi.fn(),
    },
    sync: {
      set: vi.fn((data, callback) => callback?.()),
      get: vi.fn((keys, callback) => callback?.({})),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
};

(global as unknown as { chrome: unknown }).chrome = chromeMock;

describe('Background Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should create context menu item on install', async () => {
    await import('../src/background');
    const installListener = chromeMock.runtime.onInstalled.addListener.mock.calls[0][0];
    installListener();

    expect(chromeMock.contextMenus.create).toHaveBeenCalledWith({
      id: 'mem-it',
      title: 'Mem it',
      contexts: ['selection'],
    });
  });

  it('should send OPEN_MODAL message when context menu is clicked', async () => {
    await import('../src/background');
    const clickListener = chromeMock.contextMenus.onClicked.addListener.mock.calls[0][0];

    const info = { menuItemId: 'mem-it', selectionText: 'hello world' };
    const tab = { id: 123 };

    // Mock tabs.sendMessage
    (chromeMock as unknown as { tabs: { sendMessage: unknown } }).tabs = { sendMessage: vi.fn() };
    (global as unknown as { chrome: unknown }).chrome = chromeMock;

    clickListener(info, tab);

    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(123, {
      type: 'OPEN_MODAL',
      text: 'hello world',
    });
  });

  it('should handle explanation request messages', async () => {
    // Mock the explainer
    vi.mock('../src/lib/explanation/providers/memcool', () => ({
      MemCoolExplainer: class {
        setBaseUrl = vi.fn();
        explain = vi.fn().mockResolvedValue({ word: 'eschew', in_chinese: '避开' });
      },
    }));

    await import('../src/background');
    const messageListener = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];

    const sendResponse = vi.fn();
    const result = messageListener({ type: 'EXPLAIN_TEXT', text: 'eschew' }, {}, sendResponse);

    expect(result).toBe(true);
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('should handle save to anki messages', async () => {
    // Mock AnkiClient
    vi.mock('../src/lib/anki/client', () => ({
      AnkiClient: class {
        setBaseUrl = vi.fn();
        whoami = vi.fn().mockResolvedValue({ user_id: 'u', collection_id: 'default' });
        addNote = vi.fn().mockResolvedValue(12345);
      },
    }));
    vi.mock('../src/lib/anki/formatter', () => ({
      formatExplanationToHtml: vi.fn().mockReturnValue('<div>HTML</div>'),
    }));

    await import('../src/background');
    const messageListener = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn();

    // Test SAVE_TO_ANKI
    const message = {
      type: 'SAVE_TO_ANKI',
      word: 'test',
      explanation: { word: 'test' },
    };

    const result = messageListener(message, {}, sendResponse);
    expect(result).toBe(true);
  });
});
