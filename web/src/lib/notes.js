import { apiFetchAuthed } from "./api";

/** @param {unknown} value */
export function normalizeNotes(value) {
  return Array.isArray(value) ? value : [];
}

/** @param {string | undefined | null} rawBack */
export function parseNoteBack(rawBack) {
  if (!rawBack) return {};
  try {
    return JSON.parse(rawBack);
  } catch {
    return {};
  }
}

/** @param {{ id?: string | number, fields?: string[] }} note */
export function withParsedBack(note) {
  return {
    ...note,
    _parsed: parseNoteBack(note.fields?.[1] || ""),
  };
}

/** @param {unknown} value */
export function prepareNotesWithParsedBack(value) {
  return normalizeNotes(value)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .map((note) => withParsedBack(note));
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
  return prepareNotesWithParsedBack(await fetchNotes(supabase));
}
