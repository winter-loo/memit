import { GoogleGenAI } from '@google/genai';
import type { ContentExplainer, DictionaryResponse } from '../types';
import { buildExplainPrompt } from './prompt';

export interface GeminiOptions {
  modelId?: string;
  apiKey?: string;
  targetLanguage?: string;
}

export class GeminiExplainer implements ContentExplainer {
  id = 'gemini';
  name = 'Gemini';

  async explain(text: string, options?: GeminiOptions): Promise<DictionaryResponse> {
    const model = options?.modelId || 'gemini-2.0-flash';
    const apiKey = options?.apiKey;

    if (!apiKey) {
      throw new Error('Gemini API Key is missing. Please set it in the extension options.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = buildExplainPrompt(text, options?.targetLanguage);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      if (!response.text) {
        throw new Error('Gemini API returned an empty response.');
      }

      let content = response.text.trim();

      // Strip markdown code blocks if present
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
      console.error('Gemini explanation error:', error);
      throw error instanceof Error ? error : new Error('Failed to get explanation from Gemini');
    }
  }
}
