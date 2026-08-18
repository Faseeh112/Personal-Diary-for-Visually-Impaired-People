/**
 * useSocket — React hook for connecting to the Flask-SocketIO backend.
 * Auto-connects when the user is authenticated, auto-disconnects on logout.
 * Returns the socket instance so components can listen for events.
 *
 * NOTE: This hook is client-only. Use it inside a "use client" component.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { tokenStore } from "../api/client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!token) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("[SocketIO] Connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("[SocketIO] Disconnected:", reason);
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.warn("[SocketIO] Connection error:", err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  return { socket: socketRef.current, connected };
}
