// Content script (runs on all pages)
// Purpose: when user signs in on the configured backend origin, detect Supabase session in
// localStorage and forward access token to the extension.

function normalizeBaseUrl(url: string): string {
  return (url || '').replace(/\/$/, '');
}

function findSupabaseAccessToken(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Supabase JS typically stores session under: sb-<project-ref>-auth-token
      if (!/^sb-.*-auth-token$/.test(key)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      // Supabase v2: { currentSession: { access_token, ... } }
      const token = parsed?.currentSession?.access_token;
      if (typeof token === 'string' && token.length > 0) return token;

      // Some variants store directly as { access_token }
      const token2 = parsed?.access_token;
      if (typeof token2 === 'string' && token2.length > 0) return token2;
    }
  } catch {
    // ignore
  }
  return null;
}

let sent = false;

function trySendToken() {
  if (sent) return;
  const token = findSupabaseAccessToken();
  if (!token) return;

  sent = true;
  chrome.runtime.sendMessage({
    type: 'ANKI_AUTH_TOKEN',
    token,
    sourceUrl: location.href,
  });
}

chrome.storage.sync.get(['ankiBackendUrl'], (res: { ankiBackendUrl?: string }) => {
  const configured = normalizeBaseUrl(res.ankiBackendUrl || 'https://memstore.ldd.cool');
  if (!configured) return;

  // Only run on the configured backend origin.
  if (!location.href.startsWith(configured)) return;

  // Try immediately, then poll for a short while.
  trySendToken();
  const interval = setInterval(() => {
    trySendToken();
    if (sent) clearInterval(interval);
  }, 1000);

  // Safety timeout (stop polling after 2 minutes)
  setTimeout(() => clearInterval(interval), 2 * 60 * 1000);
});
