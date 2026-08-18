"use client";
import React, { useState, useRef, useEffect } from "react";

import {
  FiSend,
  FiHome,
  FiCheckSquare,
  FiSettings,
  FiMessageSquare,
  FiUser,
  FiCpu,
  FiArrowLeft,
  FiTrash2,
  FiMic,
  FiSquare,
  FiCheck,
  FiX,
} from "react-icons/fi";
import "./AiQuery.css";
import { useRouter, usePathname } from "next/navigation";

import { aiAssistant } from "../../lib/AiAssistantService";
import useMediaRecorder from "../../hooks/useMediaRecorder";
import ProtectedRoute from "../../components/ProtectedRoute";

/* Initial AI greeting */
const INITIAL_GREETING = {
  id: `init_${Date.now()}`,
  type: "ai",
  message:
    "Hello! I am your Smart Diary assistant. Ask me anything, or tell me what to store, update, delete, or remind you about. You can type or tap the mic.",
};

/* ─────── derive a sensible chat reply from /voice/process response ─────── */
function buildAiReplyText(result) {
  // result: { voice_entry_id, transcript, intent, entities, awaiting_confirm,
  //          confirmation_prompt?, message?, answer?, result?, target_entity? }

  if (result?.confirmation_prompt) return result.confirmation_prompt;
  if (result?.answer)              return String(result.answer);
  if (result?.message)             return String(result.message);

  // Render arrays/objects readably (e.g. query results)
  if (result?.result !== undefined) {
    if (Array.isArray(result.result)) {
      if (result.result.length === 0) return "No matching entries found.";
      return result.result
        .map((r, i) => `${i + 1}. ${typeof r === "string" ? r : JSON.stringify(r)}`)
        .join("\n");
    }
    if (typeof result.result === "object")
      return JSON.stringify(result.result, null, 2);
    return String(result.result);
  }

  if (result?.target_entity) return `Saved as ${result.target_entity}.`;
  return "Got it.";
}

/* ─────── derive reply text after a Yes/No confirmation ─────── */
function buildConfirmReplyText(resp, confirmed) {
  if (!confirmed) return "Cancelled.";
  if (resp?.message)       return String(resp.message);
  if (resp?.target_entity) return `Done — saved as ${resp.target_entity}.`;
  return "Done.";
}

function AiQuery() {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery]               = useState("");
  const [chatHistory, setChatHistory]   = useState([INITIAL_GREETING]);
  const [isTyping, setIsTyping]         = useState(false);
  const [confirmingId, setConfirmingId] = useState(null); // which confirm-msg is mid-submit

  const recorder = useMediaRecorder();

  const chatEndRef = useRef(null);
  const inputRef   = useRef(null);
  const lastBlobRef = useRef(null);   // dedupe: same blob shouldn't re-process

  /* Auto-scroll on new messages or typing state */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  /* Focus input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* When recorder produces a new blob, send it through /voice/process */
  useEffect(() => {
    const blob = recorder.audioBlob;
    if (!blob || blob === lastBlobRef.current) return;
    lastBlobRef.current = blob;

    // Reject obvious silences (matches Home behaviour)
    if (blob.size < 5000) {
      pushMessage({
        type: "error",
        message: "Recording too short — speak for at least 1 second.",
      });
      recorder.reset();
      return;
    }
    sendToBackend({ audioBlob: blob });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob]);

  /* Surface mic permission / hardware errors */
  useEffect(() => {
    if (recorder.error) {
      pushMessage({ type: "error", message: recorder.error });
    }
  }, [recorder.error]);

  /* ─────────────────────── helpers ─────────────────────── */
  const pushMessage = (msg) =>
    setChatHistory((prev) => [...prev, { id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...msg }]);

  const updateMessage = (id, patch) =>
    setChatHistory((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  /* ─────────────────────── core: send to /voice/process ─────────────────────── */
  async function sendToBackend({ transcript, audioBlob }) {
    setIsTyping(true);
    try {
      const result = await aiAssistant.processInput({
        transcript: transcript?.trim() || undefined,
        audioBlob:  audioBlob || undefined,
        enableTTS: true
      });

      // For audio path, surface the transcribed user message in the chat first.
      if (audioBlob && result?.transcript) {
        pushMessage({ type: "user", message: result.transcript });
      }

      if (result?.awaiting_confirm && result?.voice_entry_id) {
        pushMessage({
          type: "confirm",
          message: buildAiReplyText(result),
          voice_entry_id: result.voice_entry_id,
          intent: result.intent,
          resolved: false,
        });
      } else {
        pushMessage({ type: "ai", message: buildAiReplyText(result) });
      }
    } catch (err) {
      pushMessage({
        type: "error",
        message: err.message || "Couldn't process that. Try again.",
      });
    } finally {
      setIsTyping(false);
      recorder.reset();
      inputRef.current?.focus();
    }
  }

  /* ─────────────────────── confirm Yes / No ─────────────────────── */
  async function handleConfirm(message, confirmed) {
    if (message.resolved || confirmingId) return;
    setConfirmingId(message.id);
    setIsTyping(true);
    try {
      const resp = await aiAssistant.confirm(message.voice_entry_id, confirmed, true);
      updateMessage(message.id, { resolved: true, resolvedAs: confirmed ? "yes" : "no" });
      pushMessage({ type: "ai", message: buildConfirmReplyText(resp, confirmed) });
    } catch (err) {
      pushMessage({
        type: "error",
        message: err.message || "Confirmation failed.",
      });
    } finally {
      setConfirmingId(null);
      setIsTyping(false);
    }
  }

  /* ─────────────────────── form handlers ─────────────────────── */
  const handleQueryChange = (e) => setQuery(e.target.value);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = query.trim();
    if (!text || isTyping) return;
    pushMessage({ type: "user", message: text });
    setQuery("");
    sendToBackend({ transcript: text });
  };

  const handleClearChat = () => {
    setChatHistory([{ ...INITIAL_GREETING, id: `init_${Date.now()}`, message: "Chat cleared. How can I help?" }]);
    inputRef.current?.focus();
  };

  /* ─────────────────────── mic toggle ─────────────────────── */
  const handleMicClick = async () => {
    if (isTyping) return;
    if (recorder.recording) {
      recorder.stop();        // blob will arrive via the effect
      return;
    }
    recorder.reset();
    lastBlobRef.current = null;
    await recorder.start();
  };

  const isActive = (path) => pathname === path;
  const sendDisabled = !query.trim() || isTyping || recorder.recording;

  return (
    <div className="aiquery-container">
      {/* ===== Header ===== */}
      <header className="aiquery-header">
        {/* <button
          className="aiquery-back-btn btn-back"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <FiArrowLeft className="aiquery-back-icon" />
        </button> */}
        <button
          className="aiquery-back-btn btn-back"
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            backgroundColor: "#0066ff", // Optional, to match your button color
            borderRadius: "50%", padding: "10px", border: "none", display: "flex", justifyContent: "center", alignItems: "center",
          }}>
        <FiArrowLeft
        className="aiquery-back-icon" style={{ color: "white", fontSize: "18px" }} // White color and size set to 18px
      />
</button>

        <div className="aiquery-header-center">
          <FiCpu className="aiquery-header-icon" />
          <h1 className="aiquery-title">AI Query</h1>
        </div>

        {/* <button
          className="aiquery-clear-btn btn-delete"
          onClick={handleClearChat}
          aria-label="Clear chat history"
        >
          <FiTrash2 className="aiquery-clear-icon" />
        </button> */}
        <button 
          className="aiquery-clear-btn btn-delete" onClick={handleClearChat} aria-label="Clear chat history"
          style={{
            backgroundColor: "#ff4444", // Optional: to style the button with a color
            borderRadius: "50%",
            padding: "10px",
            border: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <FiTrash2
            className="aiquery-clear-icon"
            style={{ fontSize: "18px", color: "white" }} // Set size to 18px and color to white
          />
        </button>
      </header>

      {/* ===== Chat Area ===== */}
      <main className="aiquery-chat-area">
        {chatHistory.map((chat) => (
          <ChatBubble
            key={chat.id}
            chat={chat}
            confirming={confirmingId === chat.id}
            onConfirm={handleConfirm}
          />
        ))}

        {isTyping && (
          <div className="aiquery-chat-bubble aiquery-ai-bubble">
            <div className="aiquery-bubble-avatar">
              <FiCpu className="aiquery-avatar-icon" />
            </div>
            <div className="aiquery-bubble-content aiquery-ai-content">
              <div className="aiquery-typing-indicator">
                <span className="aiquery-typing-dot"></span>
                <span className="aiquery-typing-dot"></span>
                <span className="aiquery-typing-dot"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </main>

      {/* ===== Input Area ===== */}
      <div className="aiquery-input-area">
        <form
          onSubmit={handleSubmit}
          className="aiquery-form"
          aria-label="Send a message"
        >
          <div className="aiquery-input-wrapper">
            <FiMessageSquare className="aiquery-input-icon" />
            <input
              ref={inputRef}
              type="text"
              className="aiquery-input"
              value={query}
              onChange={handleQueryChange}
              placeholder={
                recorder.recording
                  ? "Listening… tap stop to send"
                  : "Type a question or command…"
              }
              aria-label="Type your question"
              disabled={isTyping || recorder.recording}
            />
          </div>

          <button
            type="button"
            className={`aiquery-mic-btn ${recorder.recording ? "aiquery-mic-active" : ""}`}
            onClick={handleMicClick}
            disabled={isTyping}
            aria-label={recorder.recording ? "Stop recording" : "Voice input"}
            style={
              recorder.recording
                ? { background: "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)", color: "#fff" }
                : undefined
            }
          >
            {recorder.recording ? (
              <FiSquare className="aiquery-mic-icon" />
            ) : (
              <FiMic className="aiquery-mic-icon" />
            )}
          </button>

          <button
            type="submit"
            className="aiquery-send-btn"
            disabled={sendDisabled}
            aria-label="Send message"
          >
            <FiSend className="aiquery-send-icon" />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Chat bubble — handles user / ai / confirm / error message types */
/* ─────────────────────────────────────────────────────────────── */
function ChatBubble({ chat, confirming, onConfirm }) {
  const isUser    = chat.type === "user";
  const isError   = chat.type === "error";
  const isConfirm = chat.type === "confirm";

  return (
    <div
      className={`aiquery-chat-bubble ${
        isUser ? "aiquery-user-bubble" : "aiquery-ai-bubble"
      }`}
    >
      <div className="aiquery-bubble-avatar">
        {isUser ? (
          <FiUser className="aiquery-avatar-icon" />
        ) : (
          <FiCpu className="aiquery-avatar-icon" />
        )}
      </div>

      <div
        className={`aiquery-bubble-content ${
          isUser ? "aiquery-user-content" : "aiquery-ai-content"
        }`}
        style={isError ? { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" } : undefined}
      >
        <p className="aiquery-bubble-text" style={{ whiteSpace: "pre-wrap" }}>
          {chat.message}
        </p>

        {isConfirm && !chat.resolved && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => onConfirm(chat, true)}
              disabled={confirming}
              style={confirmBtnStyle("#10b981", confirming)}
            >
              <FiCheck size={14} style={{ marginRight: 4 }} />
              {confirming ? "Working…" : "Yes"}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(chat, false)}
              disabled={confirming}
              style={confirmBtnStyle("#64748b", confirming, true)}
            >
              <FiX size={14} style={{ marginRight: 4 }} />
              No
            </button>
          </div>
        )}

        {isConfirm && chat.resolved && (
          <p style={{ marginTop: 8, fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
            {chat.resolvedAs === "yes" ? "Confirmed." : "Cancelled."}
          </p>
        )}
      </div>
    </div>
  );
}

const confirmBtnStyle = (color, busy, outline = false) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 14px",
  borderRadius: 8,
  border: outline ? `1px solid ${color}` : "none",
  background: outline ? "transparent" : color,
  color: outline ? color : "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: busy ? "wait" : "pointer",
  opacity: busy ? 0.7 : 1,
});

export default function ProtectedAiQuery() { return <ProtectedRoute><AiQuery /></ProtectedRoute>; }