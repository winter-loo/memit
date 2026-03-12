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

/** @param {{ id?: string | number, fields?: string[] | Record<string,string>, field_values?: string[] }} note */
export function withParsedBack(note) {
  let front = "";
  let back = "";

  if (Array.isArray(note.field_values) && note.field_values.length >= 1) {
    // New API format: field_values array
    front = note.field_values[0] || "";
    back = note.field_values[note.field_values.length - 1] || "";
  } else if (note.fields && !Array.isArray(note.fields)) {
    // Object format: { Front, Back }
    const f = /** @type {Record<string,string>} */ (note.fields);
    front = f["Front"] || f["front"] || "";
    back = f["Back"] || f["back"] || "";
  } else if (Array.isArray(note.fields)) {
    // Legacy array format
    const arr = note.fields;
    front = arr[0] || "";
    back = arr[arr.length - 1] || "";
  }

  // id is a timestamp in milliseconds (e.g. 1771234024960)
  const mtimeSecs = typeof note.id === "number" && note.id > 1e12
    ? Math.floor(note.id / 1000)
    : (note.mtimeSecs ?? null);

  return {
    ...note,
    // Expose normalized front/back so the template can use note._front directly
    _front: front,
    _back: back,
    _parsed: parseNoteBack(back),
    mtimeSecs,
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
