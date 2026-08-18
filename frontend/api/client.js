/**
 * Axios client for Smart Diary backend.
 *
 * Responsibilities:
 *   1. Attach `Authorization: Bearer <access_token>` on every request.
 *   2. Unwrap the backend's `{ success, message, data }` envelope so callers
 *      receive `data` directly (errors throw with the backend message).
 *   3. On 401, attempt a single refresh using the refresh token; if it
 *      succeeds, replay the original request. If it fails, clear tokens
 *      and dispatch a logout event so AuthContext can react.
 */
import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export const ACCESS_TOKEN_KEY  = "smartdiary_access_token";
export const REFRESH_TOKEN_KEY = "smartdiary_refresh_token";
export const USER_KEY          = "smartdiary_user";

// Event hub — AuthContext listens for forced-logout signals.
export const AUTH_EVENT = "smartdiary:auth-changed";

const emitAuthChange = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EVENT));
};

export const tokenStore = {
  getAccess: () =>
    typeof window !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null,
  getRefresh: () =>
    typeof window !== "undefined" ? localStorage.getItem(REFRESH_TOKEN_KEY) : null,
  getUser: () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set: ({ access_token, refresh_token, user }) => {
    if (typeof window === "undefined") return;
    if (access_token)  localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    if (user)          localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000, // generous for first /voice/process (Whisper warmup)
});

// ── Request interceptor: attach access token ────────────────────────────────
client.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: unwrap envelope, handle 401 ───────────────────────
let refreshInflight = null; // dedupe concurrent 401s

const refreshAccessToken = async () => {
  const refresh = tokenStore.getRefresh();
  if (!refresh) throw new Error("No refresh token");
  // Bypass our own client to avoid recursive 401 handling.
  const res = await axios.post(
    `${BASE_URL}/auth/refresh`,
    {},
    { headers: { Authorization: `Bearer ${refresh}` } },
  );
  const newAccess = res.data?.data?.access_token;
  if (!newAccess) throw new Error("Refresh response missing access_token");
  tokenStore.set({ access_token: newAccess });
  return newAccess;
};

client.interceptors.response.use(
  // Success: unwrap envelope so callers get plain data.
  (res) => {
    if (res.data && typeof res.data === "object" && "data" in res.data) {
      return res.data.data;
    }
    return res.data;
  },
  // Failure: attempt refresh once on 401, otherwise translate to clean error.
  async (err) => {
    const original = err.config;
    const status   = err.response?.status;

    if (status === 401 && original && !original._retried) {
      original._retried = true;
      try {
        refreshInflight = refreshInflight || refreshAccessToken();
        const newAccess = await refreshInflight;
        refreshInflight = null;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return client(original);
      } catch (refreshErr) {
        refreshInflight = null;
        tokenStore.clear();
        emitAuthChange();
        return Promise.reject(toCleanError(refreshErr));
      }
    }

    return Promise.reject(toCleanError(err));
  },
);

const toCleanError = (err) => {
  // Backend errors look like { success: false, message: "...", details?: ... }
  const body    = err.response?.data;
  const message = body?.message || err.message || "Request failed";
  const cleaned = new Error(message);
  cleaned.status  = err.response?.status;
  cleaned.details = body?.details;
  return cleaned;
};

export default client;
