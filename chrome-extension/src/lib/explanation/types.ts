export interface DictionaryResponse {
  term: string;
  ipaPronunciation: string;
  partOfSpeech: string;
  simpleDefinition: string;
  detailedExplanation: string;
  translation: string;
  etymology: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  contextUsage: string;
  error?: string;
}

export interface ResponseEntry {
  modelId: string;
  status: 'success' | 'error';
  result?: DictionaryResponse;
  error?: string;
  responseTimeMs: number;
  receivedAt: number;
}

export interface ContentExplainer {
  id: string;
  name: string;
  explain(text: string, options?: { modelId?: string; targetLanguage?: string }): Promise<DictionaryResponse>;
}
