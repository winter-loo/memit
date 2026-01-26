import type { ContentExplainer, DictionaryResponse } from '../types';

export class OpenRouterExplainer implements ContentExplainer {
  id = 'openrouter';
  name = 'OpenRouter';
  private apiKey = '';
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

  async explain(text: string, options?: { modelId?: string }): Promise<DictionaryResponse> {
    const model = options?.modelId || 'google/gemini-2.5-flash-lite';

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
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/ldd/memit',
          'X-Title': 'Memit Extension'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
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
