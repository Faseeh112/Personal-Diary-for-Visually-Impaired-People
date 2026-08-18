
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiMic, FiSquare, FiMessageSquare, FiCalendar, FiBell, FiMusic, FiPaperclip, FiHome, FiCheckSquare, FiSettings, FiMapPin, FiDollarSign, FiUsers, FiMap, FiLogOut, FiLoader } from "react-icons/fi"; // Fixed the import issue
import { useAuth } from "../../contexts/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
import useMediaRecorder from "../../hooks/useMediaRecorder";
import { aiAssistant } from "../../lib/AiAssistantService";
import "./Home.css";

const MENU_ITEMS = [
  { label: "AI Query", path: "/ai-query", icon: <FiMessageSquare className="menu-item-icon" />, color: "#4a6cf7", bg: "#eef2ff" },
  { label: "Add Note", path: "/add-note", icon: <FiCalendar className="menu-item-icon" />, color: "#22c55e", bg: "#f0fdf4" },
  { label: "Reminder", path: "/reminder", icon: <FiBell className="menu-item-icon" />, color: "#f97316", bg: "#fff7ed" },
  { label: "Assets", path: "/assets", icon: <FiDollarSign className="menu-item-icon" />, color: "#8b5cf6", bg: "#faf5ff" },
  { label: "Contacts", path: "/contacts", icon: <FiUsers className="menu-item-icon" />, color: "#e11d48", bg: "#fff1f2" },
  { label: "Item Location", path: "/item-location", icon: <FiMapPin className="menu-item-icon" />, color: "#ef4444", bg: "#fef2f2" },
  { label: "Audio Action", path: "/audio-action", icon: <FiMusic className="menu-item-icon" />, color: "#a855f7", bg: "#faf5ff" },
  { label: "Attachment", path: "/attachment", icon: <FiPaperclip className="menu-item-icon" />, color: "#06b6d4", bg: "#ecfeff" },
  { label: "Tasks", path: "/task", icon: <FiMap className="menu-item-icon" />, color: "#14b8a6", bg: "#f0fdfa" },
  // { label: "Categories", path: "/categories", icon: <FiCheckSquare className="menu-item-icon" />, color: "#64748b", bg: "#f1f5f9" },
  // { label: "Locations", path: "/locations", icon: <FiMap className="menu-item-icon" />, color: "#0ea5e9", bg: "#f0f9ff" },
  // { label: "Settings", path: "/settings", icon: <FiSettings className="menu-item-icon" />, color: "#475569", bg: "#f8fafc" },
];

function Home() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const recorder = useMediaRecorder();

  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [feedbackKind, setFKind] = useState("info");

  useEffect(() => {
    if (recorder.audioBlob && phase === "idle") processAudio(recorder.audioBlob);
  }, [recorder.audioBlob]);

  useEffect(() => {
    if (recorder.error) {
      setFeedback(recorder.error);
      setFKind("error");
      setPhase("idle");
    }
  }, [recorder.error]);

  const handleMicClick = async () => {
    if (phase === "processing" || phase === "submitting") return;
    if (recorder.recording) {
      recorder.stop();
      return;
    }
    setFeedback(null);
    setResult(null);
    recorder.reset();
    await recorder.start();
  };

  const processAudio = async (blob) => {
    setPhase("processing");
    try {
      const data = await aiAssistant.processInput({ audioBlob: blob });
      setResult(data);
      setPhase(data?.awaiting_confirm === false ? "done" : "confirming");
      if (data?.awaiting_confirm === false) {
        setFeedback(data?.message || "Done.");
        setFKind("success");
        setTimeout(() => setPhase("idle"), 1800);
      }
    } catch (err) {
      setFeedback(err.message || "Couldn't process audio.");
      setFKind("error");
      setPhase("idle");
    } finally {
      recorder.reset();
    }
  };

  const handleConfirm = async (confirmed) => {
    if (!result?.voice_entry_id) return;
    setPhase("submitting");
    try {
      const resp = await aiAssistant.confirm(result.voice_entry_id, confirmed);
      setFeedback(confirmed ? (resp?.message || "Done.") : "Cancelled.");
      setFKind(confirmed ? "success" : "info");
      setPhase("done");
      setResult(null);
      setTimeout(() => setPhase("idle"), 1800);
    } catch (err) {
      setFeedback(err.message || "Confirmation failed.");
      setFKind("error");
      setPhase("confirming");
    }
  };

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const isBusy = phase === "processing" || phase === "submitting";
  const isRecording = recorder.recording;
  const greetingName = user?.name?.split(" ")[0] || "there";
  const voiceLabel =
    isRecording ? "Listening… tap to stop" :
    phase === "processing" ? "Processing your audio…" :
    phase === "submitting" ? "Saving…" :
    phase === "done" ? "Done!" : `Say "Hi Diary"`;

  const voiceHint = isRecording
    ? "Speak your command, then tap the button to stop."
    : "Tap the mic to give a voice command (store, query, update, delete, reminder).";

  return (
    <div className="home-container">
      {/* Header */}
      <div className="home-header" style={{ position: "relative", width: "100%" }}>
        {/* <button type="button" onClick={handleLogout} aria-label="Log out" title="Log out" style={{
          position: "absolute", top: 0, right: 10, width: 38, height: 38, background: "rgba(255,255,255,0.85)",
          border: "1px solid #e2e8f0", color: "#475569", borderRadius: "50%", cursor: "pointer",
        }}>
          <FiLogOut size={18} />
        </button> */}
        <button 
          type="button" 
          onClick={handleLogout} 
          aria-label="Log out" 
          title="Log out" 
          style={{
            position: "absolute", 
            top: 0, 
            right: 10, 
            width: 38, 
            height: 38, 
            background: "rgba(255,255,255,0.85)",
            border: "1px solid #e2e8f0", 
            color: "#475569", 
            borderRadius: "50%", 
            cursor: "pointer",
            // Add these three lines to center the icon:
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 0 // Ensures no default button padding interferes
          }} >
          <FiLogOut size={18} />
        </button>
        <h1 className="home-title">Smart Diary</h1>
        <p className="home-subtitle">Welcome back, {greetingName}</p>
      </div>

      {/* Voice Section */}
      <div className="voice-section">
        <div className="voice-circle-wrapper">
          {!isBusy && <div className="voice-circle-ring"></div>}
          <button className="voice-btn" onClick={handleMicClick} disabled={isBusy}
            aria-label={isRecording ? "Stop recording" : "Start voice command"}
            style={isRecording ? { background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }
              : isBusy ? { opacity: 0.7, cursor: "wait" } : undefined}>
            {phase === "processing" || phase === "submitting" ? (
              <FiLoader className="mic-icon" style={{ animation: "spin 1s linear infinite" }} />
            ) : isRecording ? <FiSquare className="mic-icon" /> : <FiMic className="mic-icon" />}
          </button>
        </div>
        <p className="voice-label">{voiceLabel}</p>
        <p className="voice-hint">{voiceHint}</p>
        {feedback && phase !== "confirming" && (
          <div role="status" style={{ marginTop: 10, padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 500, maxWidth: 360, textAlign: "center",
            background: feedbackKind === "error" ? "#fef2f2" : feedbackKind === "success" ? "#f0fdf4" : "#eff6ff",
            color: feedbackKind === "error" ? "#b91c1c" : feedbackKind === "success" ? "#15803d" : "#1d4ed8" }}>
            {feedback}
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="menu-grid">
        {MENU_ITEMS.map((item) => (
          <button key={item.path} className="menu-card" onClick={() => router.push(item.path)} disabled={isBusy}>
            <div className="menu-icon-wrapper" style={{ backgroundColor: item.bg, color: item.color }}>{item.icon}</div>
            <span className="menu-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Confirmation Modal */}
      {phase === "confirming" && result && (
        <ConfirmModal result={result} submitting={false} onYes={() => handleConfirm(true)} onNo={() => handleConfirm(false)} />
      )}
      {phase === "submitting" && result && (
        <ConfirmModal result={result} submitting={true} onYes={() => {}} onNo={() => {}} />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Confirmation Modal
function ConfirmModal({ result, submitting, onYes, onNo }) {
  const { transcript, intent, entities } = result || {};
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "24px 24px 18px", width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 18, color: "#1a1a2e" }}>Did I get that right?</h3>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>You said</div>
          <div style={{ padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#0f172a", fontStyle: "italic" }}>"{transcript || "—"}"</div>
        </div>
        {intent && (
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            <span style={{ color: "#64748b" }}>Intent: </span>
            <span style={{ fontWeight: 600, color: "#4a6cf7", background: "#eef2ff", padding: "2px 10px", borderRadius: 999, fontSize: 13 }}>
              {typeof intent === "string" ? intent : intent?.label || JSON.stringify(intent)}
            </span>
          </div>
        )}
        {entities && Object.keys(entities).length > 0 && (
          <div style={{ marginBottom: 18, fontSize: 13, color: "#475569" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Detected</div>
            <pre style={{ margin: 0, padding: 10, background: "#f1f5f9", borderRadius: 8, fontSize: 12, overflowX: "auto", maxHeight: 140 }}>
              {JSON.stringify(entities, null, 2)}
            </pre>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onNo} disabled={submitting} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, cursor: submitting ? "wait" : "pointer" }}>No, cancel</button>
          <button type="button" onClick={onYes} disabled={submitting} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4a6cf7 0%, #6366f1 100%)", color: "#fff", fontWeight: 600, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Working…" : "Yes, do it"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedHome() { return <ProtectedRoute><Home /></ProtectedRoute>; }
// "use client";

// import React, { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import {
//   FiMic,
//   FiSquare,
//   FiMessageSquare,
//   FiCalendar,
//   FiBell,
//   FiMusic,
//   FiPaperclip,
//   FiMapPin,
//   FiDollarSign,
//   FiUsers,
//   FiMap,
//   FiLogOut,
//   FiLoader,
// } from "react-icons/fi";

// import { useAuth } from "../../contexts/AuthContext";
// import ProtectedRoute from "../../components/ProtectedRoute";
// import useMediaRecorder from "../../hooks/useMediaRecorder";
// import { aiAssistant } from "../../lib/AiAssistantService";
// import "./Home.css";

// const MENU_ITEMS = [
//   {
//     label: "AI Query",
//     path: "/ai-query",
//     icon: <FiMessageSquare className="menu-item-icon" />,
//     color: "#4a6cf7",
//     bg: "#eef2ff",
//   },
//   {
//     label: "Add Note",
//     path: "/add-note",
//     icon: <FiCalendar className="menu-item-icon" />,
//     color: "#22c55e",
//     bg: "#f0fdf4",
//   },
//   {
//     label: "Reminder",
//     path: "/reminder",
//     icon: <FiBell className="menu-item-icon" />,
//     color: "#f97316",
//     bg: "#fff7ed",
//   },
//   {
//     label: "Assets",
//     path: "/assets",
//     icon: <FiDollarSign className="menu-item-icon" />,
//     color: "#8b5cf6",
//     bg: "#faf5ff",
//   },
//   {
//     label: "Contacts",
//     path: "/contacts",
//     icon: <FiUsers className="menu-item-icon" />,
//     color: "#e11d48",
//     bg: "#fff1f2",
//   },
//   {
//     label: "Item Location",
//     path: "/item-location",
//     icon: <FiMapPin className="menu-item-icon" />,
//     color: "#ef4444",
//     bg: "#fef2f2",
//   },
//   {
//     label: "Audio Action",
//     path: "/audio-action",
//     icon: <FiMusic className="menu-item-icon" />,
//     color: "#a855f7",
//     bg: "#faf5ff",
//   },
//   {
//     label: "Attachment",
//     path: "/attachment",
//     icon: <FiPaperclip className="menu-item-icon" />,
//     color: "#06b6d4",
//     bg: "#ecfeff",
//   },
//   {
//     label: "Tasks",
//     path: "/task",
//     icon: <FiMap className="menu-item-icon" />,
//     color: "#14b8a6",
//     bg: "#f0fdfa",
//   },
// ];

// function Home() {
//   const router = useRouter();
//   const { user, logout } = useAuth();
//   const recorder = useMediaRecorder();

//   const [phase, setPhase] = useState("idle");
//   const [result, setResult] = useState(null);
//   const [feedback, setFeedback] = useState(null);
//   const [feedbackKind, setFKind] = useState("info");

//   useEffect(() => {
//     if (recorder.audioBlob && phase === "idle") {
//       processAudio(recorder.audioBlob);
//     }
//   }, [recorder.audioBlob]);

//   useEffect(() => {
//     if (recorder.error) {
//       setFeedback(recorder.error);
//       setFKind("error");
//       setPhase("idle");
//     }
//   }, [recorder.error]);

//   const handleMicClick = async () => {
//     if (phase === "processing" || phase === "submitting") return;

//     if (recorder.recording) {
//       recorder.stop();
//       return;
//     }

//     setFeedback(null);
//     setResult(null);
//     recorder.reset();

//     await recorder.start();
//   };

//   const handleScreenClick = async (e) => {
//     const blockedElement = e.target.closest("[data-no-voice-toggle='true']");

//     if (blockedElement) return;

//     await handleMicClick();
//   };

//   const processAudio = async (blob) => {
//     setPhase("processing");

//     try {
//       const data = await aiAssistant.processInput({ audioBlob: blob });

//       setResult(data);
//       setPhase(data?.awaiting_confirm === false ? "done" : "confirming");

//       if (data?.awaiting_confirm === false) {
//         setFeedback(data?.message || "Done.");
//         setFKind("success");

//         setTimeout(() => {
//           setPhase("idle");
//         }, 1800);
//       }
//     } catch (err) {
//       setFeedback(err.message || "Couldn't process audio.");
//       setFKind("error");
//       setPhase("idle");
//     } finally {
//       recorder.reset();
//     }
//   };

//   const handleConfirm = async (confirmed) => {
//     if (!result?.voice_entry_id) return;

//     setPhase("submitting");

//     try {
//       const resp = await aiAssistant.confirm(result.voice_entry_id, confirmed);

//       setFeedback(confirmed ? resp?.message || "Done." : "Cancelled.");
//       setFKind(confirmed ? "success" : "info");
//       setPhase("done");
//       setResult(null);

//       setTimeout(() => {
//         setPhase("idle");
//       }, 1800);
//     } catch (err) {
//       setFeedback(err.message || "Confirmation failed.");
//       setFKind("error");
//       setPhase("confirming");
//     }
//   };

//   const handleLogout = () => {
//     logout();
//     router.replace("/login");
//   };

//   const isBusy = phase === "processing" || phase === "submitting";
//   const isRecording = recorder.recording;
//   const greetingName = user?.name?.split(" ")[0] || "there";

//   const voiceLabel = isRecording
//     ? "Listening… tap anywhere to stop"
//     : phase === "processing"
//     ? "Processing your audio…"
//     : phase === "submitting"
//     ? "Saving…"
//     : phase === "done"
//     ? "Done!"
//     : `Say "Hi Diary"`;

//   const voiceHint = isRecording
//     ? "Speak your command, then tap anywhere on the screen to stop."
//     : "Tap anywhere on the screen to give a voice command.";

//   return (
//     <div
//       className="home-container"
//       onClick={handleScreenClick}
//       style={{ cursor: isBusy ? "wait" : "pointer" }}
//     >
//       {/* Header */}
//       <div
//         className="home-header"
//         style={{ position: "relative", width: "100%" }}
//       >
//         <button
//           type="button"
//           onClick={handleLogout}
//           data-no-voice-toggle="true"
//           aria-label="Log out"
//           title="Log out"
//           style={{
//             position: "absolute",
//             top: 0,
//             right: 10,
//             width: 38,
//             height: 38,
//             background: "rgba(255,255,255,0.85)",
//             border: "1px solid #e2e8f0",
//             color: "#475569",
//             borderRadius: "50%",
//             cursor: "pointer",
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             padding: 0,
//           }}
//         >
//           <FiLogOut size={18} />
//         </button>

//         <h1 className="home-title">Smart Diary</h1>
//         <p className="home-subtitle">Welcome back, {greetingName}</p>
//       </div>

//       {/* Voice Section */}
//       <div className="voice-section">
//         <div className="voice-circle-wrapper">
//           {!isBusy && <div className="voice-circle-ring"></div>}

//           <button
//             className="voice-btn"
//             onClick={(e) => {
//               e.stopPropagation();
//               handleMicClick();
//             }}
//             disabled={isBusy}
//             aria-label={isRecording ? "Stop recording" : "Start voice command"}
//             style={
//               isRecording
//                 ? {
//                     background:
//                       "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
//                   }
//                 : isBusy
//                 ? { opacity: 0.7, cursor: "wait" }
//                 : undefined
//             }
//           >
//             {phase === "processing" || phase === "submitting" ? (
//               <FiLoader
//                 className="mic-icon"
//                 style={{ animation: "spin 1s linear infinite" }}
//               />
//             ) : isRecording ? (
//               <FiSquare className="mic-icon" />
//             ) : (
//               <FiMic className="mic-icon" />
//             )}
//           </button>
//         </div>

//         <p className="voice-label">{voiceLabel}</p>
//         <p className="voice-hint">{voiceHint}</p>

//         {feedback && phase !== "confirming" && (
//           <div
//             role="status"
//             style={{
//               marginTop: 10,
//               padding: "8px 14px",
//               borderRadius: 10,
//               fontSize: 14,
//               fontWeight: 500,
//               maxWidth: 360,
//               textAlign: "center",
//               background:
//                 feedbackKind === "error"
//                   ? "#fef2f2"
//                   : feedbackKind === "success"
//                   ? "#f0fdf4"
//                   : "#eff6ff",
//               color:
//                 feedbackKind === "error"
//                   ? "#b91c1c"
//                   : feedbackKind === "success"
//                   ? "#15803d"
//                   : "#1d4ed8",
//             }}
//           >
//             {feedback}
//           </div>
//         )}
//       </div>

//       {/* Menu */}
//       <div className="menu-grid" data-no-voice-toggle="true">
//         {MENU_ITEMS.map((item) => (
//           <button
//             key={item.path}
//             className="menu-card"
//             onClick={() => router.push(item.path)}
//             disabled={isBusy}
//             data-no-voice-toggle="true"
//           >
//             <div
//               className="menu-icon-wrapper"
//               style={{
//                 backgroundColor: item.bg,
//                 color: item.color,
//               }}
//             >
//               {item.icon}
//             </div>

//             <span className="menu-label">{item.label}</span>
//           </button>
//         ))}
//       </div>

//       {/* Confirmation Modal */}
//       {phase === "confirming" && result && (
//         <ConfirmModal
//           result={result}
//           submitting={false}
//           onYes={() => handleConfirm(true)}
//           onNo={() => handleConfirm(false)}
//         />
//       )}

//       {phase === "submitting" && result && (
//         <ConfirmModal
//           result={result}
//           submitting={true}
//           onYes={() => {}}
//           onNo={() => {}}
//         />
//       )}

//       <style>
//         {`
//           @keyframes spin {
//             to {
//               transform: rotate(360deg);
//             }
//           }
//         `}
//       </style>
//     </div>
//   );
// }

// function ConfirmModal({ result, submitting, onYes, onNo }) {
//   const { transcript, intent, entities } = result || {};

//   return (
//     <div
//       role="dialog"
//       aria-modal="true"
//       data-no-voice-toggle="true"
//       style={{
//         position: "fixed",
//         inset: 0,
//         background: "rgba(15, 23, 42, 0.45)",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         padding: 16,
//         zIndex: 1000,
//         cursor: "default",
//       }}
//     >
//       <div
//         data-no-voice-toggle="true"
//         style={{
//           background: "#fff",
//           borderRadius: 16,
//           padding: "24px 24px 18px",
//           width: "100%",
//           maxWidth: 440,
//           boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
//         }}
//       >
//         <h3
//           style={{
//             margin: "0 0 12px",
//             fontSize: 18,
//             color: "#1a1a2e",
//           }}
//         >
//           Did I get that right?
//         </h3>

//         <div style={{ marginBottom: 14 }}>
//           <div
//             style={{
//               fontSize: 12,
//               color: "#64748b",
//               marginBottom: 4,
//             }}
//           >
//             You said
//           </div>

//           <div
//             style={{
//               padding: "10px 12px",
//               background: "#f8fafc",
//               border: "1px solid #e2e8f0",
//               borderRadius: 10,
//               fontSize: 15,
//               color: "#0f172a",
//               fontStyle: "italic",
//             }}
//           >
//             "{transcript || "—"}"
//           </div>
//         </div>

//         {intent && (
//           <div style={{ marginBottom: 12, fontSize: 14 }}>
//             <span style={{ color: "#64748b" }}>Intent: </span>

//             <span
//               style={{
//                 fontWeight: 600,
//                 color: "#4a6cf7",
//                 background: "#eef2ff",
//                 padding: "2px 10px",
//                 borderRadius: 999,
//                 fontSize: 13,
//               }}
//             >
//               {typeof intent === "string"
//                 ? intent
//                 : intent?.label || JSON.stringify(intent)}
//             </span>
//           </div>
//         )}

//         {entities && Object.keys(entities).length > 0 && (
//           <div
//             style={{
//               marginBottom: 18,
//               fontSize: 13,
//               color: "#475569",
//             }}
//           >
//             <div
//               style={{
//                 fontSize: 12,
//                 color: "#64748b",
//                 marginBottom: 4,
//               }}
//             >
//               Detected
//             </div>

//             <pre
//               style={{
//                 margin: 0,
//                 padding: 10,
//                 background: "#f1f5f9",
//                 borderRadius: 8,
//                 fontSize: 12,
//                 overflowX: "auto",
//                 maxHeight: 140,
//               }}
//             >
//               {JSON.stringify(entities, null, 2)}
//             </pre>
//           </div>
//         )}

//         <div
//           style={{
//             display: "flex",
//             gap: 10,
//             justifyContent: "flex-end",
//           }}
//         >
//           <button
//             type="button"
//             onClick={onNo}
//             disabled={submitting}
//             data-no-voice-toggle="true"
//             style={{
//               padding: "10px 18px",
//               borderRadius: 10,
//               border: "1px solid #e2e8f0",
//               background: "#fff",
//               color: "#475569",
//               fontWeight: 600,
//               cursor: submitting ? "wait" : "pointer",
//             }}
//           >
//             No, cancel
//           </button>

//           <button
//             type="button"
//             onClick={onYes}
//             disabled={submitting}
//             data-no-voice-toggle="true"
//             style={{
//               padding: "10px 22px",
//               borderRadius: 10,
//               border: "none",
//               background: "linear-gradient(135deg, #4a6cf7 0%, #6366f1 100%)",
//               color: "#fff",
//               fontWeight: 600,
//               cursor: submitting ? "wait" : "pointer",
//               opacity: submitting ? 0.7 : 1,
//             }}
//           >
//             {submitting ? "Working…" : "Yes, do it"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function ProtectedHome() {
//   return (
//     <ProtectedRoute>
//       <Home />
//     </ProtectedRoute>
//   );
// }