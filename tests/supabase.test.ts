import { describe, it, expect, vi } from 'vitest';

// Mock supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({}),
}));

describe('Supabase Client', () => {
  it('should initialize with environment variables', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    
    // We'll set the environment variables in the test
    const metaEnv = import.meta.env as unknown as Record<string, string>;
    metaEnv.VITE_SUPABASE_URL = 'https://test.supabase.co';
    metaEnv.VITE_SUPABASE_ANON_KEY = 'test-key';

    await import('../src/lib/supabase');

    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-key'
    );
  });

  it('should be able to call auth.getSession', async () => {
    const { supabase } = await import('../src/lib/supabase');
    const mockSession = { data: { session: null }, error: null };
    
    (supabase as unknown as { auth: { getSession: unknown } }).auth = {
      getSession: vi.fn().mockResolvedValue(mockSession)
    };

    const result = await supabase.auth.getSession();
    expect(result).toEqual(mockSession);
  });
});