export type SessionUser = { id: string; name: string; phone: string };

export const SESSION_KEY = "snapword_user";

const SESSION_TTL_SEC = 30 * 24 * 60 * 60;

type StoredPayload = { v: 1; user: SessionUser; expiresAt: number };

const COOKIE_DOMAIN: string | undefined =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_COOKIE_DOMAIN
    ? process.env.NEXT_PUBLIC_COOKIE_DOMAIN
    : undefined;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = name + "=";
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.substring(prefix.length));
    }
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === "undefined") return;
  const isSecure =
    typeof location !== "undefined" && location.protocol === "https:";
  let cookie =
    `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
  if (COOKIE_DOMAIN) cookie += `; domain=${COOKIE_DOMAIN}`;
  if (isSecure) cookie += "; Secure";
  document.cookie = cookie;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  let cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  if (COOKIE_DOMAIN) cookie += `; domain=${COOKIE_DOMAIN}`;
  document.cookie = cookie;
}

function isSessionUser(x: unknown): x is SessionUser {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.phone === "string";
}

function readPayload(raw: string): StoredPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.v === 1 && isSessionUser(o.user) && typeof o.expiresAt === "number") {
      return { v: 1, user: o.user, expiresAt: o.expiresAt };
    }
    return null;
  } catch {
    return null;
  }
}

function migrateOldStorageOnce(): void {
  if (typeof window === "undefined") return;
  try {
    const ssRaw = window.sessionStorage.getItem(SESSION_KEY);
    if (ssRaw) {
      const parsed = JSON.parse(ssRaw) as unknown;
      if (isSessionUser(parsed)) {
        window.sessionStorage.removeItem(SESSION_KEY);
        saveSession(parsed);
        return;
      }
      window.sessionStorage.removeItem(SESSION_KEY);
    }
    const lsRaw = window.localStorage.getItem(SESSION_KEY);
    if (lsRaw) {
      const payload = readPayload(lsRaw);
      if (payload && Date.now() <= payload.expiresAt) {
        window.localStorage.removeItem(SESSION_KEY);
        saveSession(payload.user);
        return;
      }
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    migrateOldStorageOnce();
    const raw = getCookie(SESSION_KEY);
    if (!raw) return null;
    const payload = readPayload(raw);
    if (!payload) {
      deleteCookie(SESSION_KEY);
      return null;
    }
    if (Date.now() > payload.expiresAt) {
      deleteCookie(SESSION_KEY);
      return null;
    }
    return payload.user;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser) {
  if (typeof window === "undefined") return;
  const expiresAt = Date.now() + SESSION_TTL_SEC * 1000;
  const body: StoredPayload = { v: 1, user, expiresAt };
  setCookie(SESSION_KEY, JSON.stringify(body), SESSION_TTL_SEC);
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  deleteCookie(SESSION_KEY);
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
