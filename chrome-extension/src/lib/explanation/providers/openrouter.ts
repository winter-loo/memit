import type { ContentExplainer, DictionaryResponse } from '../types';
import { buildExplainPrompt } from './prompt';

export interface OpenRouterOptions {
  modelId?: string;
  apiKey?: string;
  targetLanguage?: string;
}

export class OpenRouterExplainer implements ContentExplainer {
  id = 'openrouter';
  name = 'OpenRouter';
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

  async explain(text: string, options?: OpenRouterOptions): Promise<DictionaryResponse> {
    const model = options?.modelId || 'google/gemini-2.5-flash-lite';
    const apiKey = options?.apiKey;

    if (!apiKey) {
      throw new Error('OpenRouter API Key is missing. Please set it in the extension options.');
    }

    const prompt = buildExplainPrompt(text, options?.targetLanguage);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/ldd/memit',
          'X-Title': 'Memit Extension',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || `OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      let content = data.choices[0].message.content.trim();

      // Attempt to strip markdown code blocks if present
      if (content.startsWith('```json')) {
        content = content.substring(7);
      } else if (content.startsWith('```')) {
        content = content.substring(3);
      }
      if (content.endsWith('```')) {
        content = content.substring(0, content.length - 3);
      }

      return JSON.parse(content.trim()) as DictionaryResponse;
    } catch (error) {
      console.error('OpenRouter explanation error:', error);
      throw error instanceof Error ? error : new Error('Failed to get explanation from OpenRouter');
    }
  }
}
