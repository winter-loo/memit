import LANGUAGE_NAMES from '../../languages.json';

export { LANGUAGE_NAMES };

export const DEFAULT_LANGUAGE = '简体中文';

export function buildExplainPrompt(text: string, targetLanguage = DEFAULT_LANGUAGE): string {
  return `
        You are an advanced English dictionary and linguistic expert.
        Explain the term or phrase: "${text}".

        Return the response ONLY in raw JSON format (no markdown code blocks) with the following structure:
        {
            "term": "${text}",
            "ipa_pronunciation": "International Phonetic Alphabet representation",
            "part_of_speech": "noun/verb/adjective etc.",
            "simple_definition": "A clear, concise definition for a general audience.",
            "detailed_explanation": "A deeper look into the nuance and usage.",
            "translation": "translation in ${targetLanguage}",
            "etymology": "Brief origin of the term.",
            "examples": ["Sentence 1", "Sentence 2", "Sentence 3"],
            "synonyms": ["synonym1", "synonym2"],
            "antonyms": ["antonym1", "antonym2"],
            "context_usage": "When to use this term (formal, casual, slang, archaic)."
        }
    `;
}
