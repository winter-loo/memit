/**
 * Counts whitespace-delimited words. Good for English, bad for CJK-only text.
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export const MAX_SELECTION_WORDS = 20;
export const MAX_SELECTION_CHARS = 14;

function countChars(text: string): number {
  return Array.from(text.trim()).length;
}

function containsCjk(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u.test(text);
}

export function getSelectionMetrics(text: string) {
  const trimmed = text.trim();
  return {
    text: trimmed,
    words: countWords(trimmed),
    chars: countChars(trimmed),
    containsCjk: containsCjk(trimmed),
  };
}

export function getSelectionLengthError(text: string): string | null {
  const metrics = getSelectionMetrics(text);
  if (!metrics.text) return null;

  if (metrics.containsCjk) {
    if (metrics.chars > MAX_SELECTION_CHARS) {
      return `Selection too long (${metrics.chars} chars). Please keep it within ${MAX_SELECTION_CHARS} characters.`;
    }
    return null;
  }

  if (metrics.words > MAX_SELECTION_WORDS) {
    return `Selection too long (${metrics.words} words). Please select less than ${MAX_SELECTION_WORDS} words.`;
  }

  return null;
}
