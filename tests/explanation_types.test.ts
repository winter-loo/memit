import { describe, it, expect } from 'vitest';
import type { DictionaryResponse, ContentExplainer } from '../src/lib/explanation/types';

describe('Explanation Types', () => {
  it('should define DictionaryResponse and ContentExplainer', () => {
    // Type-only test
    const response: DictionaryResponse = {
      word: 'test',
      simple_definition: 'def',
      detailed_explanation: 'det',
      in_chinese: 'cn'
    };
    const explainer: Partial<ContentExplainer> = { id: 'test' };
    
    expect(response.word).toBe('test');
    expect(explainer.id).toBe('test');
  });
});