/**
 * useMediaRecorder — minimal browser-audio recording hook.
 *
 * Returns:
 *   recording   : boolean — is the mic currently capturing
 *   start()     : begin recording (requests mic permission first time)
 *   stop()      : end recording; updates `audioBlob` and `durationMs`
 *   reset()     : clear blob/duration so the user can re-record
 *   audioBlob   : Blob | null — finished recording (mime = audio/webm by default)
 *   durationMs  : number      — recorded length in ms
 *   error       : string | null
 *
 * Browser MediaRecorder emits webm/opus by default. Faster-Whisper handles
 * webm via ffmpeg auto-decode in recent versions.
 *
 * NOTE: This hook is client-only. Use it inside a "use client" component.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREFERRED_MIME = "audio/webm;codecs=opus";

export default function useMediaRecorder() {
  const [recording, setRecording]   = useState(false);
  const [audioBlob, setAudioBlob]   = useState(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError]           = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const startTimeRef     = useRef(0);
  const streamRef        = useRef(null);

  // Cleanup on unmount: stop tracks, kill recorder.
  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.state === "recording" &&
          mediaRecorderRef.current.stop();
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setDurationMs(0);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone API not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported(PREFERRED_MIME)
        ? PREFERRED_MIME
        : ""; // let browser pick

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || PREFERRED_MIME,
        });
        setAudioBlob(blob);
        setDurationMs(Date.now() - startTimeRef.current);
        // Release mic
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
      };

      recorder.onerror = (e) => {
        setError(e.error?.message || "Recorder error");
        setRecording(false);
      };

      startTimeRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Microphone permission denied."
          : err.message || "Failed to access microphone.",
      );
      setRecording(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setDurationMs(0);
    setError(null);
  }, []);

  return { recording, start, stop, reset, audioBlob, durationMs, error };
}
