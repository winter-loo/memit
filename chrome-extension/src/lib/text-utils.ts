/**
 * Counts the number of words in a given text.
 * Splits by whitespace and filters out empty strings.
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
