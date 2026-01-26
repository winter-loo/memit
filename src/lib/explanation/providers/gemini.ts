import { GoogleGenAI } from '@google/genai';
import type { ContentExplainer, DictionaryResponse } from '../types';

export interface GeminiOptions {
  modelId?: string;
  apiKey?: string;
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

    const prompt = `
        You are an advanced English dictionary and linguistic expert.
        Explain the word: "${text}".

        Return the response ONLY in raw JSON format (no markdown code blocks) with the following structure:
        {
            "word": "${text}",
            "ipa_pronunciation": "International Phonetic Alphabet representation",
            "part_of_speech": "noun/verb/adjective etc.",
            "simple_definition": "A clear, concise definition for a general audience.",
            "detailed_explanation": "A deeper look into the nuance and usage.",
            "in_chinese": "中文释义",
            "etymology": "Brief origin of the word.",
            "examples": ["Sentence 1", "Sentence 2", "Sentence 3"],
            "synonyms": ["synonym1", "synonym2"],
            "antonyms": ["antonym1", "antonym2"],
            "context_usage": "When to use this word (formal, casual, slang, archaic)."
        }
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

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