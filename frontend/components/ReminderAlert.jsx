"use client";

/**
 * ReminderAlert — Global floating reminder alert component.
 * Listens for 'reminder_alert' SocketIO events and shows a premium
 * animated popup modal with Snooze / Dismiss actions.
 * Also plays an in-browser notification sound via Web Audio API.
 */
import React, { useState, useEffect, useCallback } from "react";
import { FiBell, FiClock, FiX, FiVolume2 } from "react-icons/fi";
import { remindersApi } from "../api/endpoints";
import "./ReminderAlert.css";

export default function ReminderAlert({ socket }) {
  const [alerts, setAlerts] = useState([]);

  // ── Listen for reminder_alert events ─────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = (data) => {
      console.log("[ReminderAlert] Received:", data);
      const id = data.reminder_id || Date.now();
      setAlerts((prev) => {
        // Avoid duplicates
        if (prev.some((a) => a.reminder_id === id)) return prev;
        return [...prev, { ...data, reminder_id: id, show: true }];
      });

      // Play notification sound
      playNotificationSound();
    };

    socket.on("reminder_alert", handler);
    return () => socket.off("reminder_alert", handler);
  }, [socket]);

  // ── Simple notification beep via Web Audio API ───────────────
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 830;
      osc.type = "sine";
      gain.gain.value = 0.3;
      osc.start();
      // Two beeps
      setTimeout(() => { gain.gain.value = 0; }, 200);
      setTimeout(() => { gain.gain.value = 0.3; }, 350);
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 600);
    } catch (e) {
      // Audio context might not be available
    }
  }, []);

  // ── Snooze handler ───────────────────────────────────────────
  const handleSnooze = useCallback(async (reminderId) => {
    try {
      await remindersApi.snooze(reminderId);
    } catch (err) {
      console.error("Failed to snooze:", err);
    }
    setAlerts((prev) => prev.filter((a) => a.reminder_id !== reminderId));
  }, []);

  // ── Dismiss handler ──────────────────────────────────────────
  const handleDismiss = useCallback(async (reminderId) => {
    try {
      await remindersApi.markDone(reminderId);
    } catch (err) {
      console.error("Failed to dismiss:", err);
    }
    setAlerts((prev) => prev.filter((a) => a.reminder_id !== reminderId));
  }, []);

  // ── Close without marking done ──────────────────────────────
  const handleClose = useCallback((reminderId) => {
    setAlerts((prev) => prev.filter((a) => a.reminder_id !== reminderId));
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="ra-container" id="reminder-alert-container">
      {alerts.map((alert) => (
        <div
          key={alert.reminder_id}
          className={`ra-modal ${alert.is_missed ? "ra-modal-missed" : ""}`}
        >
          {/* Pulse ring */}
          <div className="ra-pulse-ring" />

          {/* Close button */}
          <button
            className="ra-close-btn"
            onClick={() => handleClose(alert.reminder_id)}
            aria-label="Close alert"
          >
            <FiX />
          </button>

          {/* Icon */}
          <div className={`ra-icon-wrapper ${alert.is_missed ? "ra-icon-missed" : ""}`}>
            <FiBell className="ra-icon" />
          </div>

          {/* Badge */}
          {alert.is_missed && (
            <span className="ra-badge-missed">MISSED</span>
          )}

          {/* Title */}
          <h3 className="ra-title">{alert.title}</h3>

          {/* Message */}
          <p className="ra-message">{alert.message}</p>

          {/* Scheduled time */}
          {alert.scheduled_at && (
            <div className="ra-time">
              <FiClock />
              <span>
                {new Date(alert.scheduled_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
          )}

          {/* Description */}
          {alert.description && (
            <p className="ra-description">{alert.description}</p>
          )}

          {/* Actions */}
          <div className="ra-actions">
            <button
              className="ra-btn ra-btn-snooze"
              onClick={() => handleSnooze(alert.reminder_id)}
            >
              <FiClock />
              Snooze 5 min
            </button>
            <button
              className="ra-btn ra-btn-dismiss"
              onClick={() => handleDismiss(alert.reminder_id)}
            >
              <FiVolume2 />
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
