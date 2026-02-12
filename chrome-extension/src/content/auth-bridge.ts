// Content script (runs on all pages)
// Purpose: when the extension needs an auth token, detect the Supabase session on the configured
// Memit origin and forward the provider token (and access token as a fallback) to the extension.

function normalizeBaseUrl(url: string): string {
  return (url || '').replace(/\/$/, '');
}

const EXT_AUTH_QUERY_PARAM = 'memit_ext_auth';
const EXT_AUTH_SESSION_KEY = 'memit_ext_auth_tab';
const PAGE_SIGNOUT_MESSAGE_TYPE = 'MEMIT_SIGNED_OUT';

function isExtensionAuthTab(): boolean {
  // Mark the tab once via URL so the state survives OAuth redirects that drop the query string.
  try {
    const url = new URL(location.href);
    if (url.searchParams.get(EXT_AUTH_QUERY_PARAM) === '1') {
      try {
        sessionStorage.setItem(EXT_AUTH_SESSION_KEY, '1');
      } catch {
        // ignore
      }
      return true;
    }
  } catch {
    // ignore
  }

  try {
    return sessionStorage.getItem(EXT_AUTH_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

type SupabaseTokens = { providerToken?: string; accessToken?: string; expiresAt?: number };

function extractSupabaseTokens(raw: string): SupabaseTokens | null {
  try {
    const parsed = JSON.parse(raw);

    const providerToken =
      parsed?.provider_token ??
      parsed?.currentSession?.provider_token ??
      parsed?.session?.provider_token ??
      parsed?.data?.session?.provider_token;

    const accessToken =
      parsed?.access_token ??
      parsed?.currentSession?.access_token ??
      parsed?.session?.access_token ??
      parsed?.data?.session?.access_token;

    const tokens: SupabaseTokens = {};
    if (typeof providerToken === 'string' && providerToken.length > 0) {
      tokens.providerToken = providerToken;
    }
    if (typeof accessToken === 'string' && accessToken.length > 0) {
      tokens.accessToken = accessToken;
    }

    if (!tokens.providerToken && !tokens.accessToken) return null;

    const expiresAt =
      parsed?.expires_at ??
      parsed?.currentSession?.expires_at ??
      parsed?.session?.expires_at ??
      parsed?.data?.session?.expires_at;

    if (typeof expiresAt === 'number') {
      tokens.expiresAt = expiresAt;
    }

    // Supabase stores expires_at as a unix timestamp in seconds. If it's expired (or about to),
    // wait for the page to refresh it rather than capturing a dead token.
    if (typeof expiresAt === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt < now + 30) return null;
    }

    return tokens;
  } catch {
    return null;
  }
}

function findSupabaseTokens(): SupabaseTokens | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Supabase JS typically stores session under: sb-<project-ref>-auth-token
      if (!/^sb-.*-auth-token$/.test(key)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const tokens = extractSupabaseTokens(raw);
      if (tokens) return tokens;
    }
  } catch {
    // ignore
  }
  return null;
}

function hasSupabaseSessionRecord(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!/^sb-.*-auth-token$/.test(key)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const providerToken =
          parsed?.provider_token ??
          parsed?.currentSession?.provider_token ??
          parsed?.session?.provider_token ??
          parsed?.data?.session?.provider_token;

        const accessToken =
          parsed?.access_token ??
          parsed?.currentSession?.access_token ??
          parsed?.session?.access_token ??
          parsed?.data?.session?.access_token;

        if (typeof providerToken === 'string' && providerToken.length > 0) return true;
        if (typeof accessToken === 'string' && accessToken.length > 0) return true;
      } catch {
        // ignore malformed values
      }
    }
  } catch {
    // ignore
  }

  return false;
}

let sent = false;
let started = false;
let signoutSyncStarted = false;
let hadSupabaseSession: boolean | null = null;

function trySendToken() {
  if (sent) return;
  const tokens = findSupabaseTokens();
  if (!tokens) return;

  // Prefer provider_token because that is what the backend expects in this deployment.
  // Keep access_token as a fallback so the background can auto-detect if needed.
  const primaryToken = tokens.providerToken || tokens.accessToken;
  if (!primaryToken) return;
  const fallbackToken =
    tokens.providerToken && tokens.accessToken && primaryToken === tokens.providerToken
      ? tokens.accessToken
      : tokens.providerToken && tokens.accessToken
        ? tokens.providerToken
        : undefined;

  // Only forward tokens when an auth flow is pending, to avoid interfering with normal Memit usage.
  chrome.storage.local.get(['ankiAuthPending'], (res: { ankiAuthPending?: boolean }) => {
    if (sent) return;
    if (!res.ankiAuthPending) return;

    sent = true;
    chrome.runtime.sendMessage({
      type: 'ANKI_AUTH_TOKEN',
      token: primaryToken,
      fallbackToken,
      tokenType: primaryToken === tokens.providerToken ? 'provider_token' : 'access_token',
      sourceUrl: location.href,
    });
  });
}

function startPolling() {
  if (started) return;
  started = true;

  // Try immediately, then poll for a short while.
  trySendToken();
  const interval = setInterval(() => {
    trySendToken();
    if (sent) clearInterval(interval);
  }, 1000);

  // Safety timeout (stop polling after 2 minutes)
  setTimeout(() => clearInterval(interval), 2 * 60 * 1000);
}

function notifyExtensionSignedOut(reason: string) {
  chrome.runtime.sendMessage({
    type: 'ANKI_AUTH_SIGNED_OUT',
    reason,
    sourceUrl: location.href,
  });
}

function syncSignedOutState() {
  const hasSession = hasSupabaseSessionRecord();
  if (hadSupabaseSession === hasSession) return;
  hadSupabaseSession = hasSession;
  if (!hasSession) {
    notifyExtensionSignedOut('supabase_session_missing');
  }
}

function startSignoutSync() {
  if (signoutSyncStarted) return;
  signoutSyncStarted = true;

  syncSignedOutState();

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as { type?: string } | null;
    if (!data || data.type !== PAGE_SIGNOUT_MESSAGE_TYPE) return;

    hadSupabaseSession = false;
    notifyExtensionSignedOut('explicit_signout_message');
  });

  window.addEventListener('storage', () => {
    syncSignedOutState();
  });

  const interval = setInterval(() => {
    syncSignedOutState();
  }, 1500);

  // Keep polling bounded so dormant tabs don't hold intervals forever.
  setTimeout(() => clearInterval(interval), 60 * 60 * 1000);
}

chrome.storage.sync.get(['ankiAuthUrl'], (res: { ankiAuthUrl?: string }) => {
  const configured = normalizeBaseUrl(res.ankiAuthUrl || 'https://memit.ldd.cool');
  if (!configured) return;

  // Only run on the configured auth origin (exact origin match to avoid prefix spoofing).
  try {
    const here = new URL(location.href);
    const cfg = new URL(configured);
    if (here.origin !== cfg.origin) return;
    if (!here.href.startsWith(configured)) return;
  } catch {
    return;
  }

  // Keep extension auth cache in sync with the actual Memit session state.
  startSignoutSync();

  // Only the dedicated auth tab is allowed to forward tokens. This prevents normal Memit tabs
  // from being auto-closed or leaking tokens when the extension triggers a login.
  if (!isExtensionAuthTab()) return;

  startPolling();
});
