import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock chrome API
(global as unknown as { chrome: unknown }).chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    sync: {
      get: vi.fn((keys, cb) => cb?.({})),
      set: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
};

if (!HTMLElement.prototype.animate) {
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    value: () => ({
      onfinish: null,
      cancel: () => {},
      finished: Promise.resolve(),
    }),
    configurable: true,
  });
}
