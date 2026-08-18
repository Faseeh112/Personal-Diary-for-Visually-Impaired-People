/**
 * Typed endpoint functions. One function per backend route we currently use.
 * All return promises that resolve to unwrapped `data` (envelope removed
 * by the response interceptor in client.js) and throw clean Errors on failure.
 */
import client from "./client";

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: ({ name, email, password }) =>
    client.post("/auth/register", { name, email, password }),
  login: ({ email, password }) =>
    client.post("/auth/login", { email, password }),
  refresh: () => client.post("/auth/refresh"),
};

// ── User ────────────────────────────────────────────────────────────────────
export const userApi = {
  me: () => client.get("/user/me"),
  updateMe: (payload) => client.put("/user/me", payload),
  getSettings: () => client.get("/user/settings"),
  updateSettings: (payload) => client.put("/user/settings", payload),
};

// ── Notes ───────────────────────────────────────────────────────────────────
export const notesApi = {
  list: () => client.get("/notes"),
  get: (id) => client.get(`/notes/${id}`),
  create: (payload) => client.post("/notes", payload),
  update: (id, payload) => client.put(`/notes/${id}`, payload),
  remove: (id) => client.delete(`/notes/${id}`),
  listTransactions: (id) => client.get(`/notes/${id}/transactions`),
  addTransaction: (id, payload) =>
    client.post(`/notes/${id}/transactions`, payload),
};

// ── Voice ───────────────────────────────────────────────────────────────────
export const voiceApi = {
  /**
   * Process voice OR text. Pass either `transcript` (string) or `audioBlob` (Blob).
   * Returns { voice_entry_id, transcript, intent, entities, awaiting_confirm, ... }.
   */
  process: ({ transcript, audioBlob }) => {
    if (audioBlob) {
      const fd = new FormData();
      fd.append(
        "audio",
        audioBlob,
        audioBlob.name || `recording.${blobExt(audioBlob)}`,
      );
      if (transcript) fd.append("transcript", transcript);
      return client.post("/voice/process", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return client.post("/voice/process", { transcript });
  },
  confirm: (voiceEntryId, confirmed) =>
    client.post(`/voice/${voiceEntryId}/confirm`, { confirmed }),
};

const blobExt = (blob) => {
  const map = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/flac": "flac",
  };
  // Strip codec param (e.g. "audio/webm;codecs=opus")
  const baseType = (blob.type || "").split(";")[0];
  return map[baseType] || "webm";
};

// ── Uploads (NEW chunk 2) ───────────────────────────────────────────────────
export const uploadsApi = {
  /**
   * Upload an audio file. Used by AudioAction's "custom" mode to obtain a
   * server-side `file_path` before creating the scheduled action.
   * @param {File|Blob} file
   * @returns {Promise<{file_path, file_name, file_size_kb, mime_type, kind}>}
   */
  uploadAudio: (file) => {
    const fd = new FormData();
    fd.append("file", file, file.name || "upload.webm");
    return client.post("/uploads/audio", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Query (RAG) ─────────────────────────────────────────────────────────────
export const queryApi = {
  ask: ({ question, input_source = "text", use_llm = true }) =>
    client.post("/query/ask", { question, input_source, use_llm }),
};

// ── Generic CRUD factories ──────────────────────────────────────────────────
const crud = (basePath) => ({
  list: () => client.get(basePath),
  get: (id) => client.get(`${basePath}/${id}`),
  create: (payload) => client.post(basePath, payload),
  update: (id, payload) => client.put(`${basePath}/${id}`, payload),
  remove: (id) => client.delete(`${basePath}/${id}`),
});

export const personsApi      = crud("/persons");
export const locationsApi    = crud("/locations");
export const categoriesApi   = crud("/categories");
export const tagsApi = {
  list: () => client.get("/tags"),
  create: (payload) => client.post("/tags", payload),
  remove: (id) => client.delete(`/tags/${id}`),
};
export const assetsApi       = crud("/assets");
export const storedItemsApi  = crud("/stored-items");
export const remindersApi    = {
  ...crud("/reminders"),
  upcoming: () => client.get("/reminders/upcoming"),
  markDone: (id) => client.post(`/reminders/${id}/done`),
  snooze: (id, minutes = 5) => client.post(`/reminders/${id}/snooze`, { minutes }),
};
export const timetableApi    = crud("/timetable");
export const eventsApi       = {
  ...crud("/events"),
  cascade: (id) => client.get(`/events/${id}/cascade`),
};
export const triplesApi      = {
  ...crud("/triples"),
  verify: (id) => client.post(`/triples/${id}/verify`),
};
export const currenciesApi   = { list: () => client.get("/currencies") };
export const predicatesApi   = {
  list: () => client.get("/predicates"),
  create: (payload) => client.post("/predicates", payload),
};
export const attachmentsApi  = {
  ...crud("/attachments"),
  updateExtraction: (id, payload) =>
    client.put(`/attachments/${id}/extraction`, payload),
};
export const audioActionsApi = crud("/audio-actions");
export const activityLogsApi = {
  list: () => client.get("/activity-logs"),
  get: (id) => client.get(`/activity-logs/${id}`),
  create: (payload) => client.post("/activity-logs", payload),
  update: (id, payload) => client.put(`/activity-logs/${id}`, payload),
  ratio: () => client.get("/activity-logs/ratio"),
};
export const voiceEntriesApi = {
  list: () => client.get("/voice-entries"),
  get: (id) => client.get(`/voice-entries/${id}`),
  pending: () => client.get("/voice-entries/pending-confirm"),
  confirm: (id, confirmed) =>
    client.post(`/voice-entries/${id}/confirm`, { confirmed }),
};
