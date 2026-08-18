/**
 * Auth helpers for Next.js.
 *
 * Backend contract (from auth_service):
 *   POST /auth/register  → { access_token, refresh_token, user }
 *   POST /auth/login     → { access_token, refresh_token, user }
 *   POST /auth/refresh   → { access_token }
 *
 * NOTE: localStorage is only available client-side.
 * Guard with typeof window checks where SSR may run this code.
 */
import { api, setToken, getToken } from "./api";

const USER_KEY = "smart_diary_user";

// ─────────────────────────────────────────────────────────────────────
// SESSION HELPERS
// ─────────────────────────────────────────────────────────────────────
export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getToken());
}

function persistSession({ access_token, user }) {
  setToken(access_token);
  if (user && typeof window !== "undefined")
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  setToken(null);
  if (typeof window !== "undefined") localStorage.removeItem(USER_KEY);
}

// ─────────────────────────────────────────────────────────────────────
// AUTH OPERATIONS
// ─────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  const data = await api.post("/auth/login", { email, password });
  persistSession(data);
  return data.user;
}

export async function register(name, email, password) {
  const data = await api.post("/auth/register", { name, email, password });
  persistSession(data);
  return data.user;
}

export function logout() {
  clearSession();
}
