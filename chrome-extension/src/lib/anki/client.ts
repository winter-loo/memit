import type { DictionaryResponse } from '../explanation/types';

export interface AddExplanationNotePayload {
  explanation: DictionaryResponse;
  pageUrl?: string;
  highlights?: string[];
  deckId?: number;
}

export class AnkiClient {
  private baseUrl = 'https://memstore.ldd.cool';

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  private get addNoteUrl() {
    return `${this.baseUrl}/api/note/add`;
  }

  private get whoamiUrl() {
    return `${this.baseUrl}/api/auth/whoami`;
  }

  async whoami(
    token: string
  ): Promise<{ user_id: string; collection_id: string; auth_mode: string; jwt_alg: string }> {
    const response = await fetch(this.whoamiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Auth Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async addNote(payload: AddExplanationNotePayload, token: string): Promise<number> {
    const response = await fetch(this.addNoteUrl, {
      method: 'POST',
      body: JSON.stringify({
        explanation: payload.explanation,
        page_url: payload.pageUrl,
        highlights: payload.highlights ?? [],
        deck_id: payload.deckId,
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          throw new Error(errorData.error);
        }
      } catch (e) {
        if (e instanceof Error) throw e;
      }
      throw new Error(`Anki Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.error) {
      throw new Error(data.error);
    }
    return data.note_id;
  }
}
