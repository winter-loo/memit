/** @typedef {{ cancel?: () => void }} TtsPlaybackHandle */

import { fetchAuthProfile, synthesizeTts } from '$lib/api';

/** @param {string} text */
function normalizeText(text) {
  return String(text || '').trim();
}

// --- Premium status cache ---
/** @type {boolean | null} */
let _cachedIsPremium = null;
/** @type {number} */
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | undefined | null} supabase
 * @returns {Promise<boolean>}
 */
async function checkPremium(supabase) {
  if (!supabase) return false;
  const now = Date.now();
  if (_cachedIsPremium !== null && now - _cachedAt < CACHE_TTL_MS) {
    return _cachedIsPremium;
  }
  try {
    const authProfile = await fetchAuthProfile(supabase);
    _cachedIsPremium = Boolean(authProfile?.isPremium);
    _cachedAt = now;
    return _cachedIsPremium;
  } catch {
    return false;
  }
}

/** Clear the cached premium status (e.g. on sign-out). */
export function clearTtsCache() {
  _cachedIsPremium = null;
  _cachedAt = 0;
}

/** @param {string} text @param {{ lang?: string, rate?: number, pitch?: number }} [options] */
export function playBrowserTts(text, options = {}) {
  const normalized = normalizeText(text);
  if (!normalized) return Promise.reject(new Error('Text is required'));
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.reject(new Error('Browser TTS is not supported'));
  }

  window.speechSynthesis.cancel();

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(normalized);
    if (options.lang) utterance.lang = options.lang;
    if (typeof options.rate === 'number') utterance.rate = options.rate;
    if (typeof options.pitch === 'number') utterance.pitch = options.pitch;
    utterance.onend = () => resolve({ engine: 'browser' });
    utterance.onerror = (event) => reject(new Error(event?.error || 'Browser TTS failed'));
    window.speechSynthesis.speak(utterance);
  });
}

/** @param {Blob} blob */
function playAudioBlob(blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return new Promise((resolve, reject) => {
    const cleanup = () => URL.revokeObjectURL(url);
    audio.onended = () => {
      cleanup();
      resolve({ engine: 'volcano' });
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('Premium TTS playback failed'));
    };
    audio.play().catch((err) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | undefined | null} supabase
 * @param {string} text
 * @param {{ speaker?: string, encoding?: string, sample_rate?: number, speed_ratio?: number, onStart?: () => void }} [options]
 */
export async function playPremiumTts(supabase, text, options = {}) {
  const blob = await synthesizeTts(supabase, {
    text: normalizeText(text),
    speaker: options.speaker,
    encoding: options.encoding || 'mp3',
    sample_rate: options.sample_rate || 24000,
    speed_ratio: options.speed_ratio || 1.0,
  });
  if (options.onStart) options.onStart();
  return playAudioBlob(blob);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | undefined | null} supabase
 * @param {string} text
 * @param {{ lang?: string, speaker?: string, encoding?: string, sample_rate?: number, speed_ratio?: number, onStart?: () => void }} [options]
 */
export async function speakText(supabase, text, options = {}) {
  const normalized = normalizeText(text);
  if (!normalized) throw new Error('Text is required');

  const isPremium = await checkPremium(supabase);

  if (isPremium) {
    try {
      return await playPremiumTts(supabase, normalized, { ...options, onStart: options.onStart });
    } catch (err) {
      console.warn('Premium TTS failed, falling back to browser TTS', err);
    }
  }

  if (options.onStart) options.onStart();
  return playBrowserTts(normalized, options);
}

export function stopBrowserTts() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
