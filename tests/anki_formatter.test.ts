import { describe, it, expect } from 'vitest';
import { formatExplanationToHtml } from '../src/lib/anki/formatter';
import type { DictionaryResponse } from '../src/lib/explanation/types';

describe('Anki Formatter', () => {
  it('should format simple response', () => {
    const data: DictionaryResponse = {
      word: 'test',
      simple_definition: 'a procedure',
      detailed_explanation: 'long desc',
      in_chinese: '测试'
    };
    
    const html = formatExplanationToHtml(data);
    expect(html).toContain('<strong>Definition:</strong> a procedure');
    expect(html).toContain('<strong>Translation:</strong> 测试');
  });

  it('should include examples', () => {
    const data: DictionaryResponse = {
      word: 'test',
      simple_definition: 'def',
      detailed_explanation: 'desc',
      in_chinese: 'cn',
      examples: ['ex1', 'ex2']
    };
    
    const html = formatExplanationToHtml(data);
    expect(html).toContain('<ul><li>ex1</li><li>ex2</li></ul>');
  });
});