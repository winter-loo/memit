import { apiFetchAuthed } from "./api";

/** @param {unknown} value */
export function normalizeNotes(value) {
  return Array.isArray(value) ? value : [];
}

/** @param {string | undefined | null} value */
export function decodeFieldText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** @param {string | undefined | null} value */
export function splitFieldLines(value) {
  return decodeFieldText(value)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** @param {string | undefined | null} value */
export function splitInlineList(value) {
  return decodeFieldText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** @param {{ id?: string | number, fields?: Record<string, string>, mtimeSecs?: number }} note */
export function withPreparedFields(note) {
  const fields = note.fields || {};

  const mtimeSecs = typeof note.id === "number" && note.id > 1e12
    ? Math.floor(note.id / 1000)
    : (note.mtimeSecs ?? null);

  return {
    ...note,
    mtimeSecs,
    _term: decodeFieldText(fields.Term),
    _ipa: decodeFieldText(fields.IPA),
    _translation: decodeFieldText(fields.Translation),
    _simpleDefinition: decodeFieldText(fields.SimpleDefinition),
    _detailedExplanation: decodeFieldText(fields.DetailedExplanation),
    _examples: splitFieldLines(fields.ExamplesAll),
    _synonyms: splitInlineList(fields.Synonyms),
    _antonyms: splitInlineList(fields.Antonyms),
    _contextUsage: decodeFieldText(fields.ContextUsage),
    _etymology: decodeFieldText(fields.Etymology),
    _sourceUrl: decodeFieldText(fields.SourceUrl),
    _highlights: splitFieldLines(fields.Highlights),
  };
}

/** @param {unknown} value */
export function prepareNotes(value) {
  return normalizeNotes(value)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .map((note) => withPreparedFields(note));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | undefined | null} supabase
 */
export async function fetchNotes(supabase) {
  const res = await apiFetchAuthed(supabase, "/api/note/list");
  return normalizeNotes(await res.json());
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | undefined | null} supabase
 */
export async function fetchPreparedNotes(supabase) {
  return prepareNotes(await fetchNotes(supabase));
}
