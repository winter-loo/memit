import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnkiClient } from '../src/lib/anki/client';

describe('AnkiClient', () => {
  const client = new AnkiClient();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should add a note successfully', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ note_id: 12345 }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const noteId = await client.addNote('Front', 'Back', 'test-token');

    expect(noteId).toBe(12345);
    expect(fetch).toHaveBeenCalledWith(
      'https://memstore.ldd.cool/api/note/add',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fields: ['Front', 'Back'] }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
    );
  });

  it('should handle errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'Database connection failed' }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await expect(client.addNote('Front', 'Back', 'test-token')).rejects.toThrow(
      'Database connection failed'
    );
  });
});
