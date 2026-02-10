import type { ContentExplainer, DictionaryResponse } from '../types';

export class MemCoolExplainer implements ContentExplainer {
  id = 'memcool';
  name = 'Mem.Cool';
  private baseUrl = 'https://memstore.ldd.cool';

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  async explain(text: string, options?: { modelId?: string }): Promise<DictionaryResponse> {
    let url = `${this.baseUrl}/explain/${encodeURIComponent(text)}`;
    if (options?.modelId) {
      url += `?model=${encodeURIComponent(options.modelId)}`;
    }
    let response: Response;

    try {
      response = await fetch(url);
    } catch {
      throw new Error('Network error: Failed to connect to explanation service.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      try {
        // Try parsing as standard JSON first
        const errorData = JSON.parse(errorText);
        if (errorData && errorData.error) {
          if (typeof errorData.error === 'object' && errorData.error.message) {
            throw new Error(errorData.error.message);
          }
          throw new Error(String(errorData.error));
        }
      } catch {
        // Not standard JSON. Try to extract message from Python-like dict string or plain text
        const messageMatch = errorText.match(/['"]message['"]:\s*['"](.+?)['"]/);
        if (messageMatch && messageMatch[1]) {
          throw new Error(messageMatch[1].replace(/\\n/g, '\n'));
        }

        if (errorText.length < 500 && errorText.trim().length > 0) {
          throw new Error(errorText.trim());
        }
      }
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Some APIs return 200 OK but with an error field in the body
    if (data && data.error) {
      if (typeof data.error === 'object' && data.error.message) {
        throw new Error(data.error.message);
      }
      throw new Error(String(data.error));
    }

    return data as DictionaryResponse;
  }
}
