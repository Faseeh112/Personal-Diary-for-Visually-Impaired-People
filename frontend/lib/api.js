/**
 * Single source of truth for backend API calls.
 *
 * - Reads base URL from NEXT_PUBLIC_API_BASE_URL env var (defaults to localhost:5000)
 * - Auto-injects JWT bearer token from localStorage
 * - Normalizes server's {success, data, message} envelope -> just `data`
 * - Throws clean Error objects with status + message for the UI to catch
 *
 * Usage:
 *   import { api } from "../lib/api";
 *   const reminders = await api.get("/reminders");
 *   const created   = await api.post("/reminders", { title, ... });
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

const TOKEN_KEY = "smart_diary_token";

// ─────────────────────────────────────────────────────────────────────
// TOKEN HELPERS
// ─────────────────────────────────────────────────────────────────────
export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// ─────────────────────────────────────────────────────────────────────
// API ERROR
// ─────────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name    = "ApiError";
    this.status  = status;
    this.payload = payload;
  }
}

// ─────────────────────────────────────────────────────────────────────
// CORE REQUEST
// ─────────────────────────────────────────────────────────────────────
async function request(method, path, body = null, opts = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    Accept: "application/json",
    ...(opts.headers || {}),
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body: payload });
  } catch (err) {
    throw new ApiError(
      `Cannot reach the server at ${API_BASE}. Check that the backend is running and CORS is enabled.`,
      0,
    );
  }

  // 204 No Content
  if (response.status === 204) return null;

  let json;
  try {
    json = await response.json();
  } catch {
    if (!response.ok)
      throw new ApiError(`Server returned ${response.status}`, response.status);
    return null;
  }

  if (!response.ok) {
    const message =
      json?.message || json?.error || `Request failed (${response.status})`;

    // Clear invalid token on 401
    if (response.status === 401) {
      setToken(null);
      if (typeof window !== "undefined")
        localStorage.removeItem("smart_diary_user");
    }

    throw new ApiError(message, response.status, json);
  }

  // Unwrap { success, data }
  if (json && typeof json === "object" && "data" in json) return json.data;

  return json;
}

// ─────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────
export const api = {
  get:  (path, opts)        => request("GET",    path, undefined, opts),
  post: (path, body, opts)  => request("POST",   path, body,      opts),
  put:  (path, body, opts)  => request("PUT",    path, body,      opts),
  del:  (path, opts)        => request("DELETE", path, undefined, opts),
  baseUrl: API_BASE,
};
