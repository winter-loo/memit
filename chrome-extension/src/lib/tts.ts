const DEFAULT_MEMSTORE_URL = 'https://memstore.ldd.cool';

type StorageShape = {
  ankiBackendUrl?: string;
  ankiAuthToken?: string;
  ankiAuthTokenFallback?: string;
};

function normalizeBaseUrl(url: string): string {
  return (url || '').replace(/\/$/, '');
}

function storageGet<T extends Record<string, unknown>>(area: typeof chrome.storage.sync | typeof chrome.storage.local, keys: string[]): Promise<T> {
  return new Promise((resolve) => area.get(keys, (result) => resolve(result as T)));
}

function browserSpeak(text: string, onStart?: () => void): Promise<'browser'> {
  // Content scripts cannot access chrome.tts directly; use Web Speech API instead.
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.onstart = () => onStart?.();
    utterance.onend = () => resolve('browser');
    utterance.onerror = (event) => reject(new Error(event.error || 'Browser TTS failed'));
    window.speechSynthesis.speak(utterance);
  });
}

async function getExtensionAuthContext() {
  const sync = await storageGet<StorageShape>(chrome.storage.sync, ['ankiBackendUrl']);
  const local = await storageGet<StorageShape>(chrome.storage.local, ['ankiAuthToken', 'ankiAuthTokenFallback']);
  const backendUrl = normalizeBaseUrl(sync.ankiBackendUrl || DEFAULT_MEMSTORE_URL);
  const primaryToken = typeof local.ankiAuthToken === 'string' ? local.ankiAuthToken : '';
  const fallbackToken = typeof local.ankiAuthTokenFallback === 'string' ? local.ankiAuthTokenFallback : '';
  const token = primaryToken || fallbackToken || '';
  return { backendUrl, token };
}

// --- Premium status cache ---
let _cachedIsPremium: boolean | null = null;
let _cachedAt = 0;
let _cacheIsAuthFailure = false;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for successful checks
const AUTH_FAIL_TTL_MS = 60 * 1000; // 1 minute before retrying a failed auth

async function checkPremium(backendUrl: string, token: string): Promise<boolean> {
  if (!token) return false;
  const now = Date.now();
  const ttl = _cacheIsAuthFailure ? AUTH_FAIL_TTL_MS : CACHE_TTL_MS;
  if (_cachedIsPremium !== null && now - _cachedAt < ttl) {
    return _cachedIsPremium;
  }
  try {
    const response = await fetch(`${backendUrl}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    _cachedIsPremium = Boolean(data?.isPremium);
    _cachedAt = now;
    _cacheIsAuthFailure = false;
    return _cachedIsPremium;
  } catch {
    // Backend auth failed — cache the failure briefly and fall back to browser TTS
    _cachedIsPremium = false;
    _cachedAt = now;
    _cacheIsAuthFailure = true;
    return false;
  }
}

async function fetchPremiumTts(backendUrl: string, token: string, text: string): Promise<Blob> {
  const response = await fetch(`${backendUrl}/api/tts/synthesize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      encoding: 'mp3',
      sample_rate: 24000,
      speed_ratio: 1.0,
    }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => '')}`);
  }
  return await response.blob();
}

function playAudioBlob(blob: Blob, onStart?: () => void): Promise<'volcano'> {
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  return new Promise((resolve, reject) => {
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    audio.onplay = () => onStart?.();
    audio.onended = () => {
      cleanup();
      resolve('volcano');
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

export async function speakText(text: string, onStart?: () => void): Promise<'browser' | 'volcano'> {
  const normalized = String(text || '').trim();
  if (!normalized) throw new Error('Text is required');

  const { backendUrl, token } = await getExtensionAuthContext();
  const isPremium = await checkPremium(backendUrl, token);

  if (isPremium) {
    try {
      const blob = await fetchPremiumTts(backendUrl, token, normalized);
      return await playAudioBlob(blob, onStart);
    } catch (err) {
      console.warn('Premium TTS unavailable, falling back to browser TTS', err);
    }
  }

  return await browserSpeak(normalized, onStart);
}
