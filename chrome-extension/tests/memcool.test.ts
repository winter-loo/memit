import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemCoolExplainer } from '../src/lib/explanation/providers/memcool';

describe('MemCoolExplainer', () => {
  const explainer = new MemCoolExplainer();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should explain text correctly', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          word: 'test',
          simple_definition:
            'a procedure intended to establish the quality, performance, or reliability of something',
          detailed_explanation: 'A detailed explanation...',
          in_chinese: '测试',
        }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await explainer.explain('test');

    expect(result.word).toBe('test');
    expect(result.in_chinese).toBe('测试');
    expect(fetch).toHaveBeenCalledWith('https://memstore.ldd.cool/explain/test');
  });

  it('should handle URL encoding', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({}),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await explainer.explain('hello world');
    expect(fetch).toHaveBeenCalledWith('https://memstore.ldd.cool/explain/hello%20world');
  });

  it('should handle errors with message in body', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: () => Promise.resolve('{"error": "Quota exceeded"}'),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await expect(explainer.explain('unknown')).rejects.toThrow('Quota exceeded');
  });

  it('should handle errors with empty body', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(''),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await expect(explainer.explain('unknown')).rejects.toThrow('404 Not Found');
  });

  it('should include modelId in URL if provided', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ word: 'test' }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await explainer.explain('test', { modelId: 'gemini-1.5-pro' });
    expect(fetch).toHaveBeenCalledWith(
      'https://memstore.ldd.cool/explain/test?model=gemini-1.5-pro'
    );
  });
});
