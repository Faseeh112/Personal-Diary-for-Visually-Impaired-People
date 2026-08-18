// "use client";
// import { useRouter, usePathname } from "next/navigation";
// import React, { useState, useEffect } from 'react';
// import {
//   FiArrowLeft,
//   FiClock,
//   FiCalendar,
//   FiRepeat,
//   FiFileText,
//   FiPlus,
//   FiBell,
//   FiTrash2,
//   FiHome,
//   FiCheckSquare,
//   FiSettings,
//   FiCheck,
//   FiX,
// } from 'react-icons/fi';
// import "./Reminder.css";
// import { remindersApi } from "../../api/endpoints";
// import ProtectedRoute from "../../components/ProtectedRoute";

// function Reminder() {
//   const router = useRouter();
//   const pathname = usePathname();

//   // Form States
//   const [reminderTime, setReminderTime] = useState('');
//   const [reminderStartDate, setReminderStartDate] = useState('');
//   const [reminderEndDate, setReminderEndDate] = useState('');
//   const [repeatType, setRepeatType] = useState('none');
//   const [reminderTitle, setReminderTitle] = useState('');
//   const [reminderContent, setReminderContent] = useState('');

//   // UI States
//   const [reminders, setReminders] = useState([]);
//   const [showForm, setShowForm] = useState(false);
//   const [showSuccess, setShowSuccess] = useState(false);
//   const [errors, setErrors] = useState({});

//   // Load reminders from backend on mount
//   useEffect(() => {
//     const fetchReminders = async () => {
//       try {
//         const data = await remindersApi.list();
//         // Map backend format to frontend UI format
//         const mapped = data.map(r => {
//            // extract date and time from reminder_datetime
//            const dt = new Date(r.reminder_datetime);
//            const startDate = dt.toISOString().split('T')[0];
//            const time = dt.toTimeString().substring(0, 5); // HH:MM
//            return {
//              id: r.reminder_id,
//              title: r.title,
//              time: time,
//              startDate: startDate,
//              endDate: r.end_date,
//              repeat: (r.repeat_type || 'none').toLowerCase(),
//              content: r.description || '',
//              isActive: !r.is_done, // frontend uses isActive to mean !is_done
//            };
//         });
//         setReminders(mapped);
//       } catch (err) {
//         console.error("Failed to load reminders", err);
//       }
//     };
//     fetchReminders();
//   }, []);

//   // Validation
//   const validateForm = () => {
//     const newErrors = {};

//     if (!reminderTitle.trim()) {
//       newErrors.title = 'Title is required';
//     }
//     if (!reminderTime) {
//       newErrors.time = 'Time is required';
//     }
//     if (!reminderStartDate) {
//       newErrors.startDate = 'Start date is required';
//     }
//     if (!reminderEndDate) {
//       newErrors.endDate = 'End date is required';
//     }
//     if (reminderStartDate && reminderEndDate && reminderEndDate < reminderStartDate) {
//       newErrors.endDate = 'End date must be after start date';
//     }
//     if (!reminderContent.trim()) {
//       newErrors.content = 'Content is required';
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     if (!validateForm()) return;

//     // Build backend payload
//     const reminder_datetime = `${reminderStartDate}T${reminderTime}:00`;
//     const payload = {
//        title: reminderTitle.trim(),
//        description: reminderContent.trim() || undefined,
//        reminder_datetime: reminder_datetime,
//        end_date: reminderEndDate || undefined,
//        repeat_type: repeatType.charAt(0).toUpperCase() + repeatType.slice(1),
//        is_done: false,
//     };

//     try {
//       const created = await remindersApi.create(payload);
//       const dt = new Date(created.reminder_datetime);
//       const newReminder = {
//          id: created.reminder_id,
//          title: created.title,
//          time: dt.toTimeString().substring(0, 5),
//          startDate: dt.toISOString().split('T')[0],
//          endDate: created.end_date,
//          repeat: (created.repeat_type || 'none').toLowerCase(),
//          content: created.description || '',
//          isActive: !created.is_done,
//       };

//       setReminders((prev) => [newReminder, ...prev]);

//       // Reset form
//       setReminderTitle('');
//       setReminderTime('');
//       setReminderStartDate('');
//       setReminderEndDate('');
//       setRepeatType('none');
//       setReminderContent('');
//       setErrors({});
//       setShowForm(false);

//       // Show success message
//       setShowSuccess(true);
//       setTimeout(() => setShowSuccess(false), 3000);
//     } catch (err) {
//       console.error(err);
//       setErrors({ content: err.message || 'Failed to save reminder' });
//     }
//   };

//   const handleDeleteReminder = async (id) => {
//     try {
//       await remindersApi.remove(id);
//       setReminders((prev) => prev.filter((r) => r.id !== id));
//     } catch (err) {
//       console.error("Failed to delete reminder", err);
//     }
//   };

//   const handleToggleReminder = async (id) => {
//     try {
//       const current = reminders.find(r => r.id === id);
//       if (!current) return;
      
//       const newDoneStatus = current.isActive; // because isActive means NOT done
//       await remindersApi.update(id, { is_done: newDoneStatus });
      
//       setReminders((prev) =>
//         prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
//       );
//     } catch (err) {
//       console.error("Failed to toggle reminder status", err);
//     }
//   };

//   const handleCancelForm = () => {
//     setShowForm(false);
//     setErrors({});
//     setReminderTitle('');
//     setReminderTime('');
//     setReminderStartDate('');
//     setReminderEndDate('');
//     setRepeatType('none');
//     setReminderContent('');
//   };

//   // Format date for display
//   const formatDate = (dateStr) => {
//     const options = { month: 'short', day: 'numeric', year: 'numeric' };
//     return new Date(dateStr).toLocaleDateString('en-US', options);
//   };

//   // Format time for display
//   const formatTime = (timeStr) => {
//     const [hours, minutes] = timeStr.split(':');
//     const date = new Date();
//     date.setHours(hours, minutes);
//     return date.toLocaleTimeString('en-US', {
//       hour: 'numeric',
//       minute: '2-digit',
//       hour12: true,
//     });
//   };

//   const isActive = (path) => pathname === path;

//   return (
//     <div className="reminder-container">
//       {/* ===== Header ===== */}
//       <header className="reminder-header">
//         {/* <button

//           className="reminder-back-btn btn-back"
//           onClick={() => router.back()}
//           aria-label="Go back"
//         >
//           <FiArrowLeft className="reminder-back-icon" />
//         </button> */}
//         <button
//           className="reminder-back-btn btn-back"
//           onClick={() => router.back()}
//           aria-label="Go back"
//           style={{
//             background: "#0066ff", // Background color for the button (blue)
//             border: "none", // Remove the border for a cleaner look
//             borderRadius: "50%", // Circular button
//             padding: "10px", // Padding around the icon for better spacing
//             cursor: "pointer", // Pointer cursor to indicate it's clickable
//             display: "flex", // Use flexbox to center the icon
//             justifyContent: "center", // Center the icon horizontally
//             alignItems: "center", // Center the icon vertically
//           }}
//         >
//           <FiArrowLeft className="reminder-back-icon" size={20} color="white" /> {/* Arrow icon with size 20 and white color */}
//         </button>

//         <div className="reminder-header-center">
//           <FiBell className="reminder-header-icon" />
//           <h1 className="reminder-title">Reminders</h1>
//         </div>

//         {/* <button
//           className="reminder-add-btn btn-add"
//           onClick={() => setShowForm(true)}
//           aria-label="Add new reminder"
//         >
//           <FiPlus className="reminder-add-icon" />
//         </button> */}
//         <button
//   className="reminder-add-btn btn-add"
//   onClick={() => setShowForm(true)}
//   aria-label="Add new reminder"
//   style={{
//     background: "#28a745", // Green background for the "Add" button
//     border: "none", // No border for a cleaner look
//     borderRadius: "50%", // Circular button
//     padding: "10px", // Add padding around the icon for better spacing
//     cursor: "pointer", // Pointer cursor to indicate clickability
//     display: "flex", // Use flexbox to center the icon
//     justifyContent: "center", // Center the icon horizontally
//     alignItems: "center", // Center the icon vertically
//   }}
// >
//   <FiPlus className="reminder-add-icon" size={20} color="white" /> {/* Plus icon with size 20 and white color */}
// </button>
//       </header>

//       {/* ===== Success Toast ===== */}
//       {showSuccess && (
//         <div className="reminder-toast">
//           <FiCheck className="reminder-toast-icon" />
//           <span>Reminder set successfully!</span>
//         </div>
//       )}

//       {/* ===== Main Content ===== */}
//       <main className="reminder-main">
//         {/* ===== Create Form Modal ===== */}
//         {showForm && (
//           <div className="reminder-form-overlay">
//             <div className="reminder-form-card">
//               <div className="reminder-form-header">
//                 <h2 className="reminder-form-title">New Reminder</h2>
//                 {/* <button
//                   className="reminder-form-close"
//                   onClick={handleCancelForm}
//                   aria-label="Close form"
//                 >
//                   <FiX />
//                 </button> */}
//                 <button
//                   className="reminder-add-btn btn-add"
//                   onClick={handleCancelForm}
//                   aria-label="Add new reminder"
//                   style={{
//                     background: "#28a745", // Green background for the "Add" button
//                     border: "none", // No border for a cleaner look
//                     borderRadius: "50%", // Circular button
//                     padding: "10px", // Add padding around the icon for better spacing
//                     cursor: "pointer", // Pointer cursor to indicate clickability
//                     display: "flex", // Use flexbox to center the icon
//                     justifyContent: "center", // Center the icon horizontally
//                     alignItems: "center", // Center the icon vertically
//                   }}
//                 >
//                   <FiX className="reminder-add-icon" size={20} color="white" /> {/* Plus icon with size 20 and white color */}
//                 </button>
//               </div>

//               <form onSubmit={handleSubmit} className="reminder-form">
//                 {/* Title */}
//                 <div className="reminder-input-group">
//                   <label className="reminder-label">
//                     <FiBell className="reminder-label-icon" />
//                     Title
//                   </label>
//                   <input
//                     type="text"
//                     className={`reminder-input ${errors.title ? 'reminder-input-error' : ''}`}
//                     value={reminderTitle}
//                     onChange={(e) => setReminderTitle(e.target.value)}
//                     placeholder="e.g., Team Meeting"
//                   />
//                   {errors.title && (
//                     <span className="reminder-error">{errors.title}</span>
//                   )}
//                 </div>

//                 {/* Time */}
//                 <div className="reminder-input-group">
//                   <label className="reminder-label">
//                     <FiClock className="reminder-label-icon" />
//                     Time
//                   </label>
//                   <input
//                     type="time"
//                     className={`reminder-input ${errors.time ? 'reminder-input-error' : ''}`}
//                     value={reminderTime}
//                     onChange={(e) => setReminderTime(e.target.value)}
//                   />
//                   {errors.time && (
//                     <span className="reminder-error">{errors.time}</span>
//                   )}
//                 </div>

//                 {/* Date Row */}
//                 <div className="reminder-date-row">
//                   <div className="reminder-input-group">
//                     <label className="reminder-label">
//                       <FiCalendar className="reminder-label-icon" />
//                       Start Date
//                     </label>
//                     <input
//                       type="date"
//                       className={`reminder-input ${errors.startDate ? 'reminder-input-error' : ''}`}
//                       value={reminderStartDate}
//                       onChange={(e) => setReminderStartDate(e.target.value)}
//                     />
//                     {errors.startDate && (
//                       <span className="reminder-error">{errors.startDate}</span>
//                     )}
//                   </div>

//                   <div className="reminder-input-group">
//                     <label className="reminder-label">
//                       <FiCalendar className="reminder-label-icon" />
//                       End Date
//                     </label>
//                     <input
//                       type="date"
//                       className={`reminder-input ${errors.endDate ? 'reminder-input-error' : ''}`}
//                       value={reminderEndDate}
//                       onChange={(e) => setReminderEndDate(e.target.value)}
//                     />
//                     {errors.endDate && (
//                       <span className="reminder-error">{errors.endDate}</span>
//                     )}
//                   </div>
//                 </div>

//                 {/* Repeat Type */}
//                 <div className="reminder-input-group">
//                   <label className="reminder-label">
//                     <FiRepeat className="reminder-label-icon" />
//                     Repeat
//                   </label>
//                   <div className="reminder-repeat-options">
//                     {['none', 'daily', 'weekly', 'monthly'].map((type) => (
//                       <button
//                         key={type}
//                         type="button"
//                         className={`reminder-repeat-btn ${
//                           repeatType === type ? 'reminder-repeat-active' : ''
//                         }`}
//                         onClick={() => setRepeatType(type)}
//                       >
//                         {type.charAt(0).toUpperCase() + type.slice(1)}
//                       </button>
//                     ))}
//                   </div>
//                 </div>

//                 {/* Content */}
//                 <div className="reminder-input-group">
//                   <label className="reminder-label">
//                     <FiFileText className="reminder-label-icon" />
//                     Description
//                   </label>
//                   <textarea
//                     className={`reminder-textarea ${errors.content ? 'reminder-input-error' : ''}`}
//                     value={reminderContent}
//                     onChange={(e) => setReminderContent(e.target.value)}
//                     placeholder="What do you want to be reminded about?"
//                     rows={3}
//                   />
//                   {errors.content && (
//                     <span className="reminder-error">{errors.content}</span>
//                   )}
//                 </div>

//                 {/* Buttons */}
//                 <div className="reminder-form-actions">
//                   <button
//                     type="button"
//                     className="reminder-cancel-btn"
//                     onClick={handleCancelForm}
//                   >
//                     Cancel
//                   </button>
//                   <button type="submit" className="reminder-submit-btn">
//                     <FiBell />
//                     Set Reminder
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         )}

//         {/* ===== Reminders List ===== */}
//         {reminders.length === 0 && !showForm ? (
//           <div className="reminder-empty">
//             <div className="reminder-empty-icon">🔔</div>
//             <h3 className="reminder-empty-title">No Reminders Yet</h3>
//             <p className="reminder-empty-text">
//               Tap the + button to create your first reminder
//             </p>
//             <button
//               className="reminder-empty-btn btn-add"
//               onClick={() => setShowForm(true)}
//             >
//               <FiPlus />
//               Create Reminder
//             </button>
//           </div>
//         ) : (
//           <div className="reminder-list">
//             {reminders.map((reminder) => (
//               <div
//                 key={reminder.id}
//                 className={`reminder-card ${
//                   !reminder.isActive ? 'reminder-card-inactive' : ''
//                 }`}
//               >
//                 <div className="reminder-card-left">
//                   {/* <button
//                     className={`reminder-toggle ${
//                       reminder.isActive ? 'reminder-toggle-active' : ''
//                     }`}
//                     onClick={() => handleToggleReminder(reminder.id)}
//                     aria-label="Toggle reminder"
//                   >
//                     {reminder.isActive ? <FiBell /> : <FiX />}
//                   </button> */}
//                   <button
//   className={`reminder-toggle ${reminder.isActive ? 'reminder-toggle-active' : ''}`}
//   onClick={() => handleToggleReminder(reminder.id)} // Toggle the reminder status
//   aria-label="Toggle reminder"
//   style={{
//     background: reminder.isActive ? "#28a745" : "#dc3545", // Green for active, red for inactive
//     border: "none", // No border for a cleaner look
//     borderRadius: "50%", // Circular button
//     padding: "10px", // Add padding around the icon for better spacing
//     cursor: "pointer", // Pointer cursor to indicate clickability
//     display: "flex", // Use flexbox to center the icon
//     justifyContent: "center", // Center the icon horizontally
//     alignItems: "center", // Center the icon vertically
//   }}
// >
//   {reminder.isActive ? (
//     <FiBell className="reminder-toggle-icon" size={20} color="white" /> // Bell icon for active
//   ) : (
//     <FiX className="reminder-toggle-icon" size={20} color="white" /> // X icon for inactive
//   )}
// </button>
//                 </div>

//                 <div className="reminder-card-center">
//                   <h3 className="reminder-card-title">{reminder.title}</h3>
//                   <p className="reminder-card-content">{reminder.content}</p>
//                   <div className="reminder-card-meta">
//                     <span className="reminder-card-time">
//                       <FiClock />
//                       {formatTime(reminder.time)}
//                     </span>
//                     <span className="reminder-card-date">
//                       <FiCalendar />
//                       {formatDate(reminder.startDate)} - {formatDate(reminder.endDate)}
//                     </span>
//                     {reminder.repeat !== 'none' && (
//                       <span className="reminder-card-repeat">
//                         <FiRepeat />
//                         {reminder.repeat}
//                       </span>
//                     )}
//                   </div>
//                 </div>

//                 <div className="reminder-card-right">
//                   {/* <button
//                     className="reminder-delete-btn btn-delete"
//                     onClick={() => handleDeleteReminder(reminder.id)}
//                     aria-label="Delete reminder"
//                   >
//                     <FiTrash2 />
//                   </button> */}
//                   <button
//   className="reminder-delete-btn btn-delete"
//   onClick={() => handleDeleteReminder(reminder.id)} // Handle the delete action
//   aria-label="Delete reminder"
//   style={{
//     background: "#dc3545", // Red background for the delete button
//     border: "none", // No border for a cleaner look
//     borderRadius: "50%", // Circular button
//     padding: "10px", // Add padding around the icon for better spacing
//     cursor: "pointer", // Pointer cursor to indicate clickability
//     display: "flex", // Use flexbox to center the icon
//     justifyContent: "center", // Center the icon horizontally
//     alignItems: "center", // Center the icon vertically
//   }}
// >
//   <FiTrash2 className="reminder-delete-icon" size={20} color="white" /> {/* Trash icon with size 20 and white color */}
// </button>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </main>
//     </div>
//   );
// }
// export default function ProtectedReminder() { return <ProtectedRoute><Reminder /></ProtectedRoute>; }

// // "use client";
// // import { useRouter, usePathname } from "next/navigation";
// // import React, { useState, useEffect, useRef, useCallback } from "react";
// // import {
// //   FiArrowLeft,
// //   FiClock,
// //   FiCalendar,
// //   FiRepeat,
// //   FiFileText,
// //   FiPlus,
// //   FiBell,
// //   FiTrash2,
// //   FiCheck,
// //   FiX,
// //   FiVolume2,
// // } from "react-icons/fi";
// // import "./Reminder.css";
// // import { remindersApi } from "../../api/endpoints";
// // import ProtectedRoute from "../../components/ProtectedRoute";

// // const REPEAT_MAP = { none: "None", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

// // // ── Audio chime ───────────────────────────────────────────────────────────────
// // function playChime() {
// //   try {
// //     const ctx = new (window.AudioContext || window.webkitAudioContext)();
// //     [[880, 0], [660, 0.25], [440, 0.5]].forEach(([freq, when]) => {
// //       const osc = ctx.createOscillator();
// //       const gain = ctx.createGain();
// //       osc.connect(gain); gain.connect(ctx.destination);
// //       osc.type = "sine"; osc.frequency.value = freq;
// //       gain.gain.setValueAtTime(0.35, ctx.currentTime + when);
// //       gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.4);
// //       osc.start(ctx.currentTime + when);
// //       osc.stop(ctx.currentTime + when + 0.45);
// //     });
// //   } catch (_) {}
// // }

// // // ── TTS — reads description aloud ────────────────────────────────────────────
// // function speak(title, description) {
// //   if (!("speechSynthesis" in window)) return;
// //   window.speechSynthesis.cancel();
// //   const u = new SpeechSynthesisUtterance(`Reminder: ${title}. ${description || ""}`);
// //   u.rate = 0.92; u.pitch = 1;
// //   window.speechSynthesis.speak(u);
// // }

// // // ── OS notification ───────────────────────────────────────────────────────────
// // async function showBrowserNotification(title, description) {
// //   if (!("Notification" in window)) return;
// //   if (Notification.permission === "default") await Notification.requestPermission();
// //   if (Notification.permission === "granted") {
// //     new Notification(`${title}`, {
// //       body: description || "You have a reminder!",
// //       icon: "/favicon.ico",
// //       requireInteraction: true,
// //     });
// //   }
// // }

// // // ── Map backend → frontend ────────────────────────────────────────────────────
// // function mapReminder(r) {
// //   const dt = new Date(r.reminder_datetime);
// //   return {
// //     id:              r.reminder_id,
// //     title:           r.title,
// //     time:            dt.toTimeString().substring(0, 5),
// //     startDate:       dt.toISOString().split("T")[0],
// //     endDate:         r.end_date ?? "",
// //     repeat:          (r.repeat_type || "none").toLowerCase(),
// //     content:         r.description || "",
// //     isActive:        !r.is_done,
// //     reminderDatetime: dt,
// //   };
// // }

// // // ── Shared circle button style ────────────────────────────────────────────────
// // const circleBtn = (bg) => ({
// //   background: bg, border: "none", borderRadius: "50%", padding: "10px",
// //   cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center",
// // });

// // // ════════════════════════════════════════════════════════════════════════════
// // // RingingModal — shows for 60 s, repeats chime+TTS every 15 s, user can cancel
// // // ════════════════════════════════════════════════════════════════════════════
// // function RingingModal({ reminder, onDismiss }) {
// //   const [secondsLeft, setSecondsLeft] = useState(60);
// //   const repeatRef   = useRef(null);
// //   const countdownRef = useRef(null);

// //   useEffect(() => {
// //     // Fire immediately on open
// //     playChime();
// //     showBrowserNotification(reminder.title, reminder.content);
// //     speak(reminder.title, reminder.content);

// //     // Repeat chime + TTS every 15 s
// //     repeatRef.current = setInterval(() => {
// //       playChime();
// //       speak(reminder.title, reminder.content);
// //     }, 15_000);

// //     // Countdown every second; auto-dismiss at 0
// //     let remaining = 60;
// //     countdownRef.current = setInterval(() => {
// //       remaining -= 1;
// //       setSecondsLeft(remaining);
// //       if (remaining <= 0) {
// //         clearInterval(repeatRef.current);
// //         clearInterval(countdownRef.current);
// //         window.speechSynthesis?.cancel();
// //         onDismiss();
// //       }
// //     }, 1_000);

// //     return () => {
// //       clearInterval(repeatRef.current);
// //       clearInterval(countdownRef.current);
// //       window.speechSynthesis?.cancel();
// //     };
// //   }, []); // intentionally empty — fire once on mount

// //   const handleDismiss = () => {
// //     clearInterval(repeatRef.current);
// //     clearInterval(countdownRef.current);
// //     window.speechSynthesis?.cancel();
// //     onDismiss();
// //   };

// //   const pct = (secondsLeft / 60) * 100;

// //   return (
// //     <>
// //       {/* Dark overlay */}
// //       <div style={{
// //         position: "fixed", inset: 0, zIndex: 99998,
// //         background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
// //       }} />

// //       {/* Modal card */}
// //       <div style={{
// //         position: "fixed", top: "50%", left: "50%",
// //         transform: "translate(-50%,-50%)",
// //         zIndex: 99999,
// //         width: "min(400px, 90vw)",
// //         background: "linear-gradient(145deg, #0055e9, #0099ff)",
// //         borderRadius: 24, padding: "32px 28px 24px",
// //         boxShadow: "0 24px 60px rgba(0,80,220,0.5)",
// //         color: "#fff", fontFamily: "inherit",
// //         animation: "rsSlideIn 0.35s ease",
// //       }}>
// //         {/* Pulsing bell */}
// //         <div style={{ fontSize: 52, textAlign: "center", marginBottom: 12, animation: "rsPulse 1s ease infinite" }}>
// //           🔔
// //         </div>

// //         <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, textAlign: "center" }}>
// //           {reminder.title}
// //         </h2>

// //         {reminder.content && (
// //           <p style={{ margin: "0 0 20px", fontSize: 15, opacity: 0.9, textAlign: "center", lineHeight: 1.5 }}>
// //             {reminder.content}
// //           </p>
// //         )}

// //         {/* Progress bar */}
// //         <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, height: 6, marginBottom: 6, overflow: "hidden" }}>
// //           <div style={{
// //             width: `${pct}%`, height: "100%", background: "#fff",
// //             transition: "width 1s linear", borderRadius: 99,
// //           }} />
// //         </div>
// //         <p style={{ margin: "0 0 20px", fontSize: 12, opacity: 0.75, textAlign: "center" }}>
// //           Auto-dismissing in {secondsLeft}s
// //         </p>

// //         {/* Buttons */}
// //         <div style={{ display: "flex", gap: 12 }}>
// //           <button
// //             onClick={() => { playChime(); speak(reminder.title, reminder.content); }}
// //             style={{
// //               flex: 1, padding: "12px 0", borderRadius: 12,
// //               background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)",
// //               color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
// //             }}
// //           >
// //             🔊 Read Again
// //           </button>
// //           <button
// //             onClick={handleDismiss}
// //             style={{
// //               flex: 1, padding: "12px 0", borderRadius: 12,
// //               background: "#fff", border: "none",
// //               color: "#0055e9", fontSize: 14, fontWeight: 700, cursor: "pointer",
// //             }}
// //           >
// //             ✓ Dismiss
// //           </button>
// //         </div>
// //       </div>

// //       <style>{`
// //         @keyframes rsSlideIn {
// //           from { transform: translate(-50%,-50%) scale(0.85); opacity: 0; }
// //           to   { transform: translate(-50%,-50%) scale(1);    opacity: 1; }
// //         }
// //         @keyframes rsPulse {
// //           0%,100% { transform: scale(1); }
// //           50%     { transform: scale(1.18); }
// //         }
// //       `}</style>
// //     </>
// //   );
// // }

// // // ════════════════════════════════════════════════════════════════════════════
// // // Main Reminder page — everything from your original page + ringing modal added
// // // ════════════════════════════════════════════════════════════════════════════
// // function Reminder() {
// //   const router   = useRouter();
// //   const pathname = usePathname();

// //   // Form states
// //   const [reminderTime,      setReminderTime]      = useState("");
// //   const [reminderStartDate, setReminderStartDate] = useState("");
// //   const [reminderEndDate,   setReminderEndDate]   = useState("");
// //   const [repeatType,        setRepeatType]        = useState("none");
// //   const [reminderTitle,     setReminderTitle]     = useState("");
// //   const [reminderContent,   setReminderContent]   = useState("");

// //   // UI states
// //   const [reminders,   setReminders]   = useState([]);
// //   const [showForm,    setShowForm]    = useState(false);
// //   const [showSuccess, setShowSuccess] = useState(false);
// //   const [errors,      setErrors]      = useState({});

// //   // Ringing modal state — null = no alert, object = reminder currently ringing
// //   const [ringingReminder, setRingingReminder] = useState(null);

// //   const firedRef = useRef(new Set());

// //   // Request notification permission on mount
// //   useEffect(() => {
// //     if ("Notification" in window && Notification.permission === "default") {
// //       Notification.requestPermission();
// //     }
// //   }, []);

// //   // Load reminders
// //   useEffect(() => {
// //     remindersApi.list()
// //       .then((data) => setReminders(data.map(mapReminder)))
// //       .catch((err) => console.error("Failed to load reminders", err));
// //   }, []);

// //   // Poll every 30 s for due reminders
// //   const checkDueReminders = useCallback(() => {
// //     const now = new Date();
// //     setReminders((prev) => {
// //       prev.forEach((r) => {
// //         if (!r.isActive || firedRef.current.has(r.id) || !r.reminderDatetime) return;
// //         const diffMs = now - r.reminderDatetime;
// //         if (diffMs >= 0 && diffMs < 31_000) {
// //           firedRef.current.add(r.id);
// //           setRingingReminder(r); // opens the ringing modal
// //         }
// //       });
// //       return prev;
// //     });
// //   }, []);

// //   useEffect(() => {
// //     const interval = setInterval(checkDueReminders, 30_000);
// //     return () => clearInterval(interval);
// //   }, [checkDueReminders]);

// //   // Validation
// //   const validateForm = () => {
// //     const e = {};
// //     if (!reminderTitle.trim())  e.title     = "Title is required";
// //     if (!reminderTime)          e.time      = "Time is required";
// //     if (!reminderStartDate)     e.startDate = "Start date is required";
// //     if (!reminderEndDate)       e.endDate   = "End date is required";
// //     if (reminderStartDate && reminderEndDate && reminderEndDate < reminderStartDate)
// //       e.endDate = "End date must be after start date";
// //     if (!reminderContent.trim()) e.content  = "Content is required";
// //     setErrors(e);
// //     return Object.keys(e).length === 0;
// //   };

// //   // Submit
// //   const handleSubmit = async (ev) => {
// //     ev.preventDefault();
// //     if (!validateForm()) return;

// //     const payload = {
// //       title:             reminderTitle.trim(),
// //       description:       reminderContent.trim() || null,
// //       reminder_datetime: `${reminderStartDate}T${reminderTime}:00`,
// //       end_date:          reminderEndDate || null,
// //       repeat_type:       REPEAT_MAP[repeatType] ?? "None",
// //       is_done:           false,
// //     };

// //     try {
// //       const created = await remindersApi.create(payload);
// //       setReminders((prev) => [mapReminder(created), ...prev]);
// //       handleCancelForm();
// //       setShowSuccess(true);
// //       setTimeout(() => setShowSuccess(false), 3000);
// //     } catch (err) {
// //       console.error("Reminder create error:", err);
// //       const msg = err?.response?.data?.detail || err?.message || "Failed to save reminder";
// //       setErrors({ content: msg });
// //     }
// //   };

// //   // Delete — uses reminder_id (integer) directly
// //   const handleDeleteReminder = async (id) => {
// //     try {
// //       await remindersApi.remove(id);
// //       setReminders((prev) => prev.filter((r) => r.id !== id));
// //     } catch (err) {
// //       console.error("Failed to delete reminder:", err);
// //     }
// //   };

// //   // Toggle active/done
// //   const handleToggleReminder = async (id) => {
// //     try {
// //       const current = reminders.find((r) => r.id === id);
// //       if (!current) return;
// //       await remindersApi.update(id, { is_done: current.isActive });
// //       setReminders((prev) =>
// //         prev.map((r) => r.id === id ? { ...r, isActive: !r.isActive } : r)
// //       );
// //     } catch (err) {
// //       console.error("Failed to toggle reminder status", err);
// //     }
// //   };

// //   const handleCancelForm = () => {
// //     setShowForm(false); setErrors({});
// //     setReminderTitle(""); setReminderTime("");
// //     setReminderStartDate(""); setReminderEndDate("");
// //     setRepeatType("none"); setReminderContent("");
// //   };

// //   const formatDate = (s) => {
// //     if (!s) return "—";
// //     const d = new Date(s);
// //     return isNaN(d) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
// //   };

// //   const formatTime = (s) => {
// //     if (!s) return "—";
// //     const [h, m] = s.split(":");
// //     const d = new Date(); d.setHours(+h, +m);
// //     return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
// //   };

// //   const isActive = (path) => pathname === path;

// //   return (
// //     <div className="reminder-container">

// //       {/* Ringing modal — appears on top of everything when a reminder fires */}
// //       {ringingReminder && (
// //         <RingingModal
// //           reminder={ringingReminder}
// //           onDismiss={() => setRingingReminder(null)}
// //         />
// //       )}

// //       {/* Header */}
// //       <header className="reminder-header">
// //         <button
// //           className="reminder-back-btn btn-back"
// //           onClick={() => router.back()}
// //           aria-label="Go back"
// //           style={circleBtn("#0066ff")}
// //         >
// //           <FiArrowLeft size={20} color="white" />
// //         </button>

// //         <div className="reminder-header-center">
// //           <FiBell className="reminder-header-icon" />
// //           <h1 className="reminder-title">Reminders</h1>
// //         </div>

// //         <button
// //           className="reminder-add-btn btn-add"
// //           onClick={() => setShowForm(true)}
// //           aria-label="Add new reminder"
// //           style={circleBtn("#28a745")}
// //         >
// //           <FiPlus size={20} color="white" />
// //         </button>
// //       </header>

// //       {/* Success toast */}
// //       {showSuccess && (
// //         <div className="reminder-toast">
// //           <FiCheck className="reminder-toast-icon" />
// //           <span>Reminder set successfully!</span>
// //         </div>
// //       )}

// //       <main className="reminder-main">

// //         {/* Create Form Modal */}
// //         {showForm && (
// //           <div className="reminder-form-overlay">
// //             <div className="reminder-form-card">
// //               <div className="reminder-form-header">
// //                 <h2 className="reminder-form-title">New Reminder</h2>
// //                 <button
// //                   className="reminder-form-close"
// //                   onClick={handleCancelForm}
// //                   aria-label="Close form"
// //                   style={circleBtn("#dc3545")}
// //                 >
// //                   <FiX size={20} color="white" />
// //                 </button>
// //               </div>

// //               <form onSubmit={handleSubmit} className="reminder-form">
// //                 {/* Title */}
// //                 <div className="reminder-input-group">
// //                   <label className="reminder-label">
// //                     <FiBell className="reminder-label-icon" /> Title
// //                   </label>
// //                   <input
// //                     type="text"
// //                     className={`reminder-input ${errors.title ? "reminder-input-error" : ""}`}
// //                     value={reminderTitle}
// //                     onChange={(e) => setReminderTitle(e.target.value)}
// //                     placeholder="e.g., Team Meeting"
// //                   />
// //                   {errors.title && <span className="reminder-error">{errors.title}</span>}
// //                 </div>

// //                 {/* Time */}
// //                 <div className="reminder-input-group">
// //                   <label className="reminder-label">
// //                     <FiClock className="reminder-label-icon" /> Time
// //                   </label>
// //                   <input
// //                     type="time"
// //                     className={`reminder-input ${errors.time ? "reminder-input-error" : ""}`}
// //                     value={reminderTime}
// //                     onChange={(e) => setReminderTime(e.target.value)}
// //                   />
// //                   {errors.time && <span className="reminder-error">{errors.time}</span>}
// //                 </div>

// //                 {/* Dates */}
// //                 <div className="reminder-date-row">
// //                   <div className="reminder-input-group">
// //                     <label className="reminder-label">
// //                       <FiCalendar className="reminder-label-icon" /> Start Date
// //                     </label>
// //                     <input
// //                       type="date"
// //                       className={`reminder-input ${errors.startDate ? "reminder-input-error" : ""}`}
// //                       value={reminderStartDate}
// //                       onChange={(e) => setReminderStartDate(e.target.value)}
// //                     />
// //                     {errors.startDate && <span className="reminder-error">{errors.startDate}</span>}
// //                   </div>
// //                   <div className="reminder-input-group">
// //                     <label className="reminder-label">
// //                       <FiCalendar className="reminder-label-icon" /> End Date
// //                     </label>
// //                     <input
// //                       type="date"
// //                       className={`reminder-input ${errors.endDate ? "reminder-input-error" : ""}`}
// //                       value={reminderEndDate}
// //                       onChange={(e) => setReminderEndDate(e.target.value)}
// //                     />
// //                     {errors.endDate && <span className="reminder-error">{errors.endDate}</span>}
// //                   </div>
// //                 </div>

// //                 {/* Repeat */}
// //                 <div className="reminder-input-group">
// //                   <label className="reminder-label">
// //                     <FiRepeat className="reminder-label-icon" /> Repeat
// //                   </label>
// //                   <div className="reminder-repeat-options">
// //                     {["none", "daily", "weekly", "monthly"].map((type) => (
// //                       <button
// //                         key={type} type="button"
// //                         className={`reminder-repeat-btn ${repeatType === type ? "reminder-repeat-active" : ""}`}
// //                         onClick={() => setRepeatType(type)}
// //                       >
// //                         {type.charAt(0).toUpperCase() + type.slice(1)}
// //                       </button>
// //                     ))}
// //                   </div>
// //                 </div>

// //                 {/* Description */}
// //                 <div className="reminder-input-group">
// //                   <label className="reminder-label">
// //                     <FiFileText className="reminder-label-icon" /> Description
// //                   </label>
// //                   <textarea
// //                     className={`reminder-textarea ${errors.content ? "reminder-input-error" : ""}`}
// //                     value={reminderContent}
// //                     onChange={(e) => setReminderContent(e.target.value)}
// //                     placeholder="What do you want to be reminded about?"
// //                     rows={3}
// //                   />
// //                   {errors.content && <span className="reminder-error">{errors.content}</span>}
// //                 </div>

// //                 <div className="reminder-form-actions">
// //                   <button type="button" className="reminder-cancel-btn" onClick={handleCancelForm}>
// //                     Cancel
// //                   </button>
// //                   <button type="submit" className="reminder-submit-btn">
// //                     <FiBell /> Set Reminder
// //                   </button>
// //                 </div>
// //               </form>
// //             </div>
// //           </div>
// //         )}

// //         {/* Reminders List */}
// //         {reminders.length === 0 && !showForm ? (
// //           <div className="reminder-empty">
// //             <div className="reminder-empty-icon">🔔</div>
// //             <h3 className="reminder-empty-title">No Reminders Yet</h3>
// //             <p className="reminder-empty-text">Tap the + button to create your first reminder</p>
// //             <button className="reminder-empty-btn btn-add" onClick={() => setShowForm(true)}>
// //               <FiPlus /> Create Reminder
// //             </button>
// //           </div>
// //         ) : (
// //           <div className="reminder-list">
// //             {reminders.map((reminder) => (
// //               <div
// //                 key={reminder.id}
// //                 className={`reminder-card ${!reminder.isActive ? "reminder-card-inactive" : ""}`}
// //               >
// //                 {/* Toggle button — green bell = active, red X = done */}
// //                 <div className="reminder-card-left">
// //                   <button
// //                     className={`reminder-toggle ${reminder.isActive ? "reminder-toggle-active" : ""}`}
// //                     onClick={() => handleToggleReminder(reminder.id)}
// //                     aria-label="Toggle reminder"
// //                     style={circleBtn(reminder.isActive ? "#28a745" : "#dc3545")}
// //                   >
// //                     {reminder.isActive
// //                       ? <FiBell size={20} color="white" />
// //                       : <FiX    size={20} color="white" />}
// //                   </button>
// //                 </div>

// //                 {/* Content */}
// //                 <div className="reminder-card-center">
// //                   <h3 className="reminder-card-title">{reminder.title}</h3>
// //                   <p className="reminder-card-content">{reminder.content}</p>
// //                   <div className="reminder-card-meta">
// //                     <span className="reminder-card-time">
// //                       <FiClock /> {formatTime(reminder.time)}
// //                     </span>
// //                     <span className="reminder-card-date">
// //                       <FiCalendar /> {formatDate(reminder.startDate)} - {formatDate(reminder.endDate)}
// //                     </span>
// //                     {reminder.repeat !== "none" && (
// //                       <span className="reminder-card-repeat">
// //                         <FiRepeat /> {reminder.repeat}
// //                       </span>
// //                     )}
// //                   </div>
// //                 </div>

// //                 {/* Delete button */}
// //                 <div className="reminder-card-right">
// //                   <button
// //                     className="reminder-delete-btn btn-delete"
// //                     onClick={() => handleDeleteReminder(reminder.id)}
// //                     aria-label="Delete reminder"
// //                     style={circleBtn("#dc3545")}
// //                   >
// //                     <FiTrash2 size={20} color="white" />
// //                   </button>
// //                 </div>
// //               </div>
// //             ))}
// //           </div>
// //         )}
// //       </main>
// //     </div>
// //   );
// // }

// // export default function ProtectedReminder() {
// //   return <ProtectedRoute><Reminder /></ProtectedRoute>;
// // }
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FiArrowLeft,
  FiClock,
  FiCalendar,
  FiRepeat,
  FiFileText,
  FiPlus,
  FiBell,
  FiTrash2,
  FiHome,
  FiCheckSquare,
  FiSettings,
  FiCheck,
  FiX,
} from 'react-icons/fi';
import './Reminder.css';
import { remindersApi } from '../../api/endpoints';

function Reminder() {
  const router = useRouter();
  const pathname = usePathname();

  // Form States
  const [reminderTime, setReminderTime] = useState('');
  const [reminderStartDate, setReminderStartDate] = useState('');
  const [reminderEndDate, setReminderEndDate] = useState('');
  const [repeatType, setRepeatType] = useState('none');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderContent, setReminderContent] = useState('');

  // UI States
  const [reminders, setReminders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  // Load reminders from backend on mount
  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const data = await remindersApi.list();
        // Map backend format to frontend UI format
        const mapped = data.map(r => {
           // extract date and time from reminder_datetime
           const dt = new Date(r.reminder_datetime);
           const startDate = dt.toISOString().split('T')[0];
           const time = dt.toTimeString().substring(0, 5); // HH:MM
           return {
             id: r.reminder_id,
             title: r.title,
             time: time,
             startDate: startDate,
             endDate: r.end_date,
             repeat: (r.repeat_type || 'none').toLowerCase(),
             content: r.description || '',
             isActive: !r.is_done, // frontend uses isActive to mean !is_done
           };
        });
        setReminders(mapped);
      } catch (err) {
        console.error("Failed to load reminders", err);
      }
    };
    fetchReminders();
  }, []);

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!reminderTitle.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!reminderTime) {
      newErrors.time = 'Time is required';
    }
    if (!reminderStartDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!reminderEndDate) {
      newErrors.endDate = 'End date is required';
    }
    if (reminderStartDate && reminderEndDate && reminderEndDate < reminderStartDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (!reminderContent.trim()) {
      newErrors.content = 'Content is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Build backend payload
    const reminder_datetime = `${reminderStartDate}T${reminderTime}:00`;
    const payload = {
       title: reminderTitle.trim(),
       description: reminderContent.trim() || undefined,
       reminder_datetime: reminder_datetime,
       end_date: reminderEndDate || undefined,
       repeat_type: repeatType.charAt(0).toUpperCase() + repeatType.slice(1),
       is_done: false,
    };

    try {
      const created = await remindersApi.create(payload);
      const dt = new Date(created.reminder_datetime);
      const newReminder = {
         id: created.reminder_id,
         title: created.title,
         time: dt.toTimeString().substring(0, 5),
         startDate: dt.toISOString().split('T')[0],
         endDate: created.end_date,
         repeat: (created.repeat_type || 'none').toLowerCase(),
         content: created.description || '',
         isActive: !created.is_done,
      };

      setReminders((prev) => [newReminder, ...prev]);

      // Reset form
      setReminderTitle('');
      setReminderTime('');
      setReminderStartDate('');
      setReminderEndDate('');
      setRepeatType('none');
      setReminderContent('');
      setErrors({});
      setShowForm(false);

      // Show success message
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setErrors({ content: err.message || 'Failed to save reminder' });
    }
  };

  const handleDeleteReminder = async (id) => {
    try {
      await remindersApi.remove(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete reminder", err);
    }
  };

  const handleToggleReminder = async (id) => {
    try {
      const current = reminders.find(r => r.id === id);
      if (!current) return;
      
      const newDoneStatus = current.isActive; // because isActive means NOT done
      await remindersApi.update(id, { is_done: newDoneStatus });
      
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
      );
    } catch (err) {
      console.error("Failed to toggle reminder status", err);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setErrors({});
    setReminderTitle('');
    setReminderTime('');
    setReminderStartDate('');
    setReminderEndDate('');
    setRepeatType('none');
    setReminderContent('');
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  // Format time for display
  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isActive = (path) => pathname === path;

  return (
    <div className="reminder-container">
      {/* ===== Header ===== */}
      <header className="reminder-header">
        <button
          className="reminder-back-btn btn-back"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <FiArrowLeft className="reminder-back-icon" />
        </button>

        <div className="reminder-header-center">
          <FiBell className="reminder-header-icon" />
          <h1 className="reminder-title">Reminders</h1>
        </div>

        <button
          className="reminder-add-btn btn-add"
          onClick={() => setShowForm(true)}
          aria-label="Add new reminder"
        >
          <FiPlus className="reminder-add-icon" />
        </button>
      </header>

      {/* ===== Success Toast ===== */}
      {showSuccess && (
        <div className="reminder-success-toast">
          <FiCheck /> Reminder created successfully!
        </div>
      )}

      {/* ===== Main Content ===== */}
      <main className="reminder-main">
        {/* ===== Create Form Modal ===== */}
        {showForm && (
          <div className="reminder-form-overlay">
            <div className="reminder-form-card">
              <div className="reminder-form-header">
                <h2 className="reminder-form-title">New Reminder</h2>
                <button
                  className="reminder-form-close"
                  onClick={handleCancelForm}
                  aria-label="Close form"
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="reminder-form">
                {/* Title */}
                <div className="reminder-input-group">
                  <label className="reminder-label">
                    <FiBell className="reminder-label-icon" />
                    Title
                  </label>
                  <input
                    type="text"
                    className={`reminder-input ${errors.title ? 'reminder-input-error' : ''}`}
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder="e.g., Team Meeting"
                  />
                  {errors.title && (
                    <span className="reminder-error">{errors.title}</span>
                  )}
                </div>

                {/* Time */}
                <div className="reminder-input-group">
                  <label className="reminder-label">
                    <FiClock className="reminder-label-icon" />
                    Time
                  </label>
                  <input
                    type="time"
                    className={`reminder-input ${errors.time ? 'reminder-input-error' : ''}`}
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                  />
                  {errors.time && (
                    <span className="reminder-error">{errors.time}</span>
                  )}
                </div>

                {/* Date Row */}
                <div className="reminder-date-row">
                  <div className="reminder-input-group">
                    <label className="reminder-label">
                      <FiCalendar className="reminder-label-icon" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      className={`reminder-input ${errors.startDate ? 'reminder-input-error' : ''}`}
                      value={reminderStartDate}
                      onChange={(e) => setReminderStartDate(e.target.value)}
                    />
                    {errors.startDate && (
                      <span className="reminder-error">{errors.startDate}</span>
                    )}
                  </div>

                  <div className="reminder-input-group">
                    <label className="reminder-label">
                      <FiCalendar className="reminder-label-icon" />
                      End Date
                    </label>
                    <input
                      type="date"
                      className={`reminder-input ${errors.endDate ? 'reminder-input-error' : ''}`}
                      value={reminderEndDate}
                      onChange={(e) => setReminderEndDate(e.target.value)}
                    />
                    {errors.endDate && (
                      <span className="reminder-error">{errors.endDate}</span>
                    )}
                  </div>
                </div>

                {/* Repeat Type */}
                <div className="reminder-input-group">
                  <label className="reminder-label">
                    <FiRepeat className="reminder-label-icon" />
                    Repeat
                  </label>
                  <div className="reminder-repeat-options">
                    {['none', 'daily', 'weekly', 'monthly'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`reminder-repeat-btn ${
                          repeatType === type ? 'reminder-repeat-active' : ''
                        }`}
                        onClick={() => setRepeatType(type)}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="reminder-input-group">
                  <label className="reminder-label">
                    <FiFileText className="reminder-label-icon" />
                    Description
                  </label>
                  <textarea
                    className={`reminder-textarea ${errors.content ? 'reminder-input-error' : ''}`}
                    value={reminderContent}
                    onChange={(e) => setReminderContent(e.target.value)}
                    placeholder="What do you want to be reminded about?"
                    rows={3}
                  />
                  {errors.content && (
                    <span className="reminder-error">{errors.content}</span>
                  )}
                </div>

                {/* Buttons */}
                <div className="reminder-form-actions">
                  <button
                    type="button"
                    className="reminder-cancel-btn"
                    onClick={handleCancelForm}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="reminder-submit-btn">
                    <FiBell />
                    Set Reminder
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== Reminders List ===== */}
        {reminders.length === 0 && !showForm ? (
          <div className="reminder-empty">
            <div className="reminder-empty-icon">🔔</div>
            <h3 className="reminder-empty-title">No Reminders Yet</h3>
            <p className="reminder-empty-text">
              Tap the + button to create your first reminder
            </p>
            <button
              className="reminder-empty-btn btn-add"
              onClick={() => setShowForm(true)}
            >
              <FiPlus />
              Create Reminder
            </button>
          </div>
        ) : (
          <div className="reminder-list">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`reminder-card ${
                  !reminder.isActive ? 'reminder-card-inactive' : ''
                }`}
              >
                <div className="reminder-card-left">
                  <button
                    className={`reminder-toggle ${
                      reminder.isActive ? 'reminder-toggle-active' : ''
                    }`}
                    onClick={() => handleToggleReminder(reminder.id)}
                    aria-label="Toggle reminder"
                  >
                    {reminder.isActive ? <FiBell /> : <FiX />}
                  </button>
                </div>

                <div className="reminder-card-center">
                  <h3 className="reminder-card-title">{reminder.title}</h3>
                  <p className="reminder-card-content">{reminder.content}</p>
                  <div className="reminder-card-meta">
                    <span className="reminder-card-time">
                      <FiClock />
                      {formatTime(reminder.time)}
                    </span>
                    <span className="reminder-card-date">
                      <FiCalendar />
                      {formatDate(reminder.startDate)} - {formatDate(reminder.endDate)}
                    </span>
                    {reminder.repeat !== 'none' && (
                      <span className="reminder-card-repeat">
                        <FiRepeat />
                        {reminder.repeat}
                      </span>
                    )}
                  </div>
                </div>

                <div className="reminder-card-right">
                  <button
                    className="reminder-delete-btn btn-delete"
                    onClick={() => handleDeleteReminder(reminder.id)}
                    aria-label="Delete reminder"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Reminder;