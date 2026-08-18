/**
 * ReminderService.jsx
 * Place in: components/ReminderService.jsx
 *
 * Global background service — runs on EVERY screen because it lives in
 * ClientProviders which wraps the whole app in layout.jsx.
 *
 * What it does:
 *  - Polls GET /reminders/due every 30 s
 *  - When a reminder is due: plays chime + OS notification + speaks description
 *  - Shows a full-screen modal that rings for 60 s (chime+TTS every 15 s)
 *  - User can dismiss manually OR it auto-dismisses at 60 s
 */
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { remindersApi } from "../api/endpoints";

// ── Chime (3-note descending tone) ───────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [660, 0.25], [440, 0.5]].forEach(([freq, when]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.4);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 0.45);
    });
  } catch (_) {}
}

// ── TTS — speaks "Reminder: <title>. <description>" ─────────────────────────
function speak(title, description) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(
    `Reminder: ${title}. ${description || ""}`
  );
  u.rate = 0.92;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

// ── OS notification ───────────────────────────────────────────────────────────
async function showOsNotification(title, description) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification(`🔔 ${title}`, {
      body: description || "You have a reminder!",
      icon: "/favicon.ico",
      requireInteraction: true,
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// RingingModal — full-screen modal, rings for 60 s, repeats every 15 s
// ════════════════════════════════════════════════════════════════════════════
function RingingModal({ reminder, onDismiss }) {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const repeatRef    = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    // Fire immediately when modal opens
    playChime();
    showOsNotification(reminder.title, reminder.content);
    speak(reminder.title, reminder.content);

    // Repeat chime + TTS every 15 s
    repeatRef.current = setInterval(() => {
      playChime();
      speak(reminder.title, reminder.content);
    }, 15_000);

    // Count down every second; auto-dismiss at 0
    let remaining = 60;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) dismiss();
    }, 1_000);

    return () => {
      clearInterval(repeatRef.current);
      clearInterval(countdownRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []); // run once on mount

  const dismiss = () => {
    clearInterval(repeatRef.current);
    clearInterval(countdownRef.current);
    window.speechSynthesis?.cancel();
    onDismiss();
  };

  const pct = (secondsLeft / 60) * 100;

  return (
    <>
      {/* Blurred dark overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 99998,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }} />

      {/* Card */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 99999,
        width: "min(400px, 90vw)",
        background: "linear-gradient(145deg,#0055e9,#0099ff)",
        borderRadius: 24,
        padding: "32px 28px 24px",
        boxShadow: "0 24px 60px rgba(0,80,220,0.5)",
        color: "#fff",
        fontFamily: "inherit",
        animation: "rsIn 0.35s ease",
      }}>

        {/* Pulsing bell emoji */}
        <div style={{
          fontSize: 52, textAlign: "center", marginBottom: 12,
          animation: "rsPulse 1s ease infinite",
        }}>🔔</div>

        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, textAlign: "center" }}>
          {reminder.title}
        </h2>

        {reminder.content && (
          <p style={{
            margin: "0 0 20px", fontSize: 15, opacity: 0.9,
            textAlign: "center", lineHeight: 1.5,
          }}>
            {reminder.content}
          </p>
        )}

        {/* Countdown progress bar */}
        <div style={{
          background: "rgba(255,255,255,0.25)", borderRadius: 99,
          height: 6, marginBottom: 6, overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%", background: "#fff",
            transition: "width 1s linear", borderRadius: 99,
          }} />
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 12, opacity: 0.75, textAlign: "center" }}>
          Auto-dismissing in {secondsLeft}s
        </p>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => { playChime(); speak(reminder.title, reminder.content); }}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12,
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            🔊 Read Again
          </button>
          <button
            onClick={dismiss}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12,
              background: "#fff", border: "none",
              color: "#0055e9", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            ✓ Dismiss
          </button>
        </div>
      </div>

      <style>{`
        @keyframes rsIn {
          from { transform: translate(-50%,-50%) scale(0.85); opacity: 0; }
          to   { transform: translate(-50%,-50%) scale(1);    opacity: 1; }
        }
        @keyframes rsPulse {
          0%,100% { transform: scale(1);    }
          50%     { transform: scale(1.18); }
        }
      `}</style>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ReminderService — mounts once globally, polls /reminders/due every 30 s
// ════════════════════════════════════════════════════════════════════════════
export default function ReminderService() {
  const { isAuthenticated } = useAuth();
  const [ringing, setRinging]   = useState(null); // reminder currently ringing
  const firedRef = useRef(new Set());             // IDs fired this session

  // Request OS notification permission early
  useEffect(() => {
    if (!isAuthenticated) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isAuthenticated]);

  // Poll backend for due reminders
  const poll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const due = await remindersApi.due();   // GET /reminders/due
      if (!Array.isArray(due)) return;
      due.forEach((r) => {
        if (firedRef.current.has(r.reminder_id)) return;
        firedRef.current.add(r.reminder_id);
        // Show modal for the first due reminder not yet fired
        setRinging({
          id:      r.reminder_id,
          title:   r.title,
          content: r.description || "",
        });
      });
    } catch (_) {
      // Silently ignore network errors (user may be logged out)
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    poll();                                   // immediate check on login/mount
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [isAuthenticated, poll]);

  if (!ringing) return null;

  return (
    <RingingModal
      reminder={ringing}
      onDismiss={() => setRinging(null)}
    />
  );
}