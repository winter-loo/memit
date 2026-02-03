import type { DictionaryResponse } from '../explanation/types';

export function formatExplanationToHtml(data: DictionaryResponse): string {
  let html = '';

  if (data.ipa_pronunciation) {
    html += `<p><strong>IPA:</strong> ${data.ipa_pronunciation}</p>`;
  }
  if (data.part_of_speech) {
    html += `<p><strong>Part of Speech:</strong> ${data.part_of_speech}</p>`;
  }

  html += `<p><strong>Definition:</strong> ${data.simple_definition}</p>`;
  html += `<p><strong>Translation:</strong> ${data.in_chinese}</p>`;

  html += `<hr><p>${data.detailed_explanation}</p>`;

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

  if (data.context_usage) {
    html += `<p><strong>Context:</strong> ${data.context_usage}</p>`;
  }

  if (data.etymology) {
    html += `<p><strong>Etymology:</strong> ${data.etymology}</p>`;
  }

  return html;
}
