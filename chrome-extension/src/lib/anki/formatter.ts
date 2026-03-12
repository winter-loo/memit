import type { DictionaryResponse } from '../explanation/types';

export function formatExplanationToHtml(data: DictionaryResponse): string {
  let html = '';

  if (data.ipaPronunciation) {
    html += `<p><strong>IPA:</strong> ${data.ipaPronunciation}</p>`;
  }
  if (data.partOfSpeech) {
    html += `<p><strong>Part of Speech:</strong> ${data.partOfSpeech}</p>`;
  }

  html += `<p><strong>Definition:</strong> ${data.simpleDefinition}</p>`;
  html += `<p><strong>Translation:</strong> ${data.translation}</p>`;

  html += `<hr><p>${data.detailedExplanation}</p>`;

  if (data.examples && data.examples.length > 0) {
    html += '<h3>Examples</h3><ul>';
    data.examples.forEach((ex) => (html += `<li>${ex}</li>`));
    html += '</ul>';
  }

  if (data.synonyms && data.synonyms.length > 0) {
    html += `<p><strong>Synonyms:</strong> ${data.synonyms.join(', ')}</p>`;
  }

  if (data.antonyms && data.antonyms.length > 0) {
    html += `<p><strong>Antonyms:</strong> ${data.antonyms.join(', ')}</p>`;
  }

  if (data.contextUsage) {
    html += `<p><strong>Context:</strong> ${data.contextUsage}</p>`;
  }

  if (data.etymology) {
    html += `<p><strong>Etymology:</strong> ${data.etymology}</p>`;
  }

  return html;
}
