export interface DictionaryResponse {
  word: string;
  ipa_pronunciation: string;
  part_of_speech: string;
  simple_definition: string;
  detailed_explanation: string;
  in_chinese: string;
  etymology: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  context_usage: string;
  error?: string;
}

export interface ContentExplainer {
  id: string;
  name: string;
  explain(text: string, options?: { modelId?: string }): Promise<DictionaryResponse>;
}
