export class AnkiClient {
  private apiUrl = 'https://mem.ldd.cool/api/note/add';

  async addNote(front: string, back: string): Promise<number> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      body: JSON.stringify({ fields: [front, back] }),
      headers: { 'Content-Type': 'application/json' },
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
