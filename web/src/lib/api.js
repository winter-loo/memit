import { PUBLIC_API_BASE_URL } from "$env/static/public";

const API_BASE = (PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

/** @param {string} path */
export function apiUrl(path) {
  if (!API_BASE) return path;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

/** @param {Response} res */
async function throwIfHttpError(res) {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(`HTTP ${res.status}: ${text}`);
}

/** @param {string} path @param {string} token @param {RequestInit} [options] */
async function apiFetchWithBearerToken(path, token, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", "Bearer " + token);

  // Default to no-store to prevent aggressive browser caching of API responses
  /** @type {RequestInit} */
  const fetchOptions = { cache: "no-store", ...options, headers };

  const res = await fetch(apiUrl(path), fetchOptions);
  await throwIfHttpError(res);
  return res;
}

/** @param {string} path @param {RequestInit} [options] */
export async function apiFetch(path, options = {}) {
  // Default to no-store to prevent aggressive browser caching of API responses
  /** @type {RequestInit} */
  const fetchOptions = { cache: "no-store", ...options };
  const res = await fetch(apiUrl(path), fetchOptions);
  await throwIfHttpError(res);
  return res;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | undefined | null} supabase
 */
export async function getAccessToken(supabase) {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session?.access_token || null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | undefined | null} supabase
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function apiFetchAuthed(supabase, path, options = {}) {
  const token = await getAccessToken(supabase);
  if (!token) throw new Error("Not signed in");
  return apiFetchWithBearerToken(path, token, options);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | undefined | null} supabase
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function apiFetchAuthedIfSignedIn(supabase, path, options = {}) {
  const token = await getAccessToken(supabase);
  if (!token) return null;
  return apiFetchWithBearerToken(path, token, options);
}
