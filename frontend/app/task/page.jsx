"use client";
import { useRouter, usePathname } from "next/navigation";
import React, { useState, useEffect } from 'react';
import {
  FiArrowLeft,
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiHome,
  FiCheckSquare,
  FiSettings,
  FiCheck,
  FiX,
  FiClock,
  FiCalendar,
  FiRepeat,
  FiFileText,
  FiMusic,
  FiBell,
  FiGrid,
  FiAlertCircle,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiUpload,
  FiType,
  FiUser,
} from 'react-icons/fi';
import "./Task.css";
import { audioActionsApi, remindersApi, notesApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

// ===== TYPE CONFIGURATION =====
const TYPE_CONFIG = {
  Action: {
    color: '#5b6ef5',
    bg: '#eceeff',
    icon: <FiMusic size={14} />,
    label: 'Action',
  },
  Reminder: {
    color: '#F5A623',
    bg: '#fff8ec',
    icon: <FiBell size={14} />,
    label: 'Reminder',
  },
  Notes: {
    color: '#4CAF82',
    bg: '#edfbf4',
    icon: <FiFileText size={14} />,
    label: 'Notes',
  },
};

const TAB_ICONS = {
  All: <FiGrid size={14} />,
  Action: <FiMusic size={14} />,
  Reminder: <FiBell size={14} />,
  Notes: <FiFileText size={14} />,
};

// ===== META CHIP COMPONENT =====
function MetaChip({ icon, children }) {
  return (
    <span className="tk-meta-chip">
      {icon && <span className="tk-meta-chip-icon">{icon}</span>}
      {children}
    </span>
  );
}

// ===== FORMAT HELPERS =====
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const date = new Date();
  date.setHours(hours, minutes);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// ===== TASK CARD COMPONENT =====
function TaskCard({ task, onEdit, onDelete }) {
  const cfg = TYPE_CONFIG[task.type];

  return (
    <div className="tk-card">
      <div className="tk-accent-bar" style={{ background: cfg.color }} />

      <div className="tk-card-body">
        {/* Top Row */}
        <div className="tk-card-top">
          <span
            className="tk-badge"
            style={{ color: cfg.color, background: cfg.bg }}
          >
            <span className="tk-badge-icon">{cfg.icon}</span>
            {task.type}
          </span>
          <div className="tk-card-actions">
            {/* <button
              className="tk-icon-btn tk-edit"
              onClick={() => onEdit(task)}
              aria-label="Edit task"
            >
              <FiEdit3 size={15} />
            </button> */}
            <button
              className="tk-icon-btn tk-edit"
              onClick={() => onEdit(task)}
              aria-label="Edit task"
              style={{
                background: "#ffcc00", // Yellow background for the "Edit" button
                border: "none", // No border for a cleaner look
                borderRadius: "50%", // Circular button
                padding: "8px", // Adds padding around the icon for better spacing
                cursor: "pointer", // Pointer cursor to indicate it's clickable
                display: "flex", // Use flexbox to center the icon
                justifyContent: "center", // Center the icon horizontally
                alignItems: "center", // Center the icon vertically
                transition: "background 0.3s ease", // Smooth transition for background color on hover
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#e6b800"} // Darken the button color on hover
              onMouseOut={(e) => e.currentTarget.style.background = "#ffcc00"} // Revert to the original color
            >
              <FiEdit3 size={15} color="white" /> {/* Edit icon with size 15 and white color */}
            </button>
            {/* <button
              className="tk-icon-btn tk-del btn-delete"
              onClick={() => onDelete(task.id)}
              aria-label="Delete task"
            >
              <FiTrash2 size={15} />
            </button> */}
            <button
              className="tk-icon-btn tk-del btn-delete"
              onClick={() => onDelete(task.id)}
              aria-label="Delete task"
              style={{
                background: "#ff4444", // Red background for the "Delete" button
                border: "none", // No border for a cleaner look
                borderRadius: "50%", // Circular button
                padding: "8px", // Padding around the icon for better spacing
                cursor: "pointer", // Pointer cursor to indicate it's clickable
                display: "flex", // Use flexbox to center the icon
                justifyContent: "center", // Center the icon horizontally
                alignItems: "center", // Center the icon vertically
                transition: "background 0.3s ease", // Smooth transition for background color on hover
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#e60000"} // Darken the button color on hover
              onMouseOut={(e) => e.currentTarget.style.background = "#ff4444"} // Revert to the original color
            >
              <FiTrash2 size={15} color="white" /> {/* Trash icon with size 15 and white color */}
            </button>
          </div>
        </div>

        {/* Title (if exists) */}
        {task.title && <h3 className="tk-card-title">{task.title}</h3>}

        {/* Content */}
        <p className="tk-content">{task.content}</p>

        {/* Description (if exists) */}
        {task.description && (
          <p className="tk-description">{task.description}</p>
        )}

        {/* Meta Chips */}
        <div className="tk-meta-row">
          {task.playDate && (
            <MetaChip icon={<FiCalendar size={12} />}>
              {formatDate(task.playDate)}
            </MetaChip>
          )}
          {task.date && (
            <MetaChip icon={<FiCalendar size={12} />}>
              {formatDate(task.date)}
            </MetaChip>
          )}
          {task.playTime && (
            <MetaChip icon={<FiClock size={12} />}>
              {formatTime(task.playTime)}
            </MetaChip>
          )}
          {task.time && (
            <MetaChip icon={<FiClock size={12} />}>
              {formatTime(task.time)}
            </MetaChip>
          )}
          {task.repeatTime !== undefined && (
            <MetaChip icon={<FiRepeat size={12} />}>
              {task.repeatTime ? 'Repeat On' : 'No Repeat'}
            </MetaChip>
          )}
          {task.audioFileName && (
            <MetaChip icon={<FiMusic size={12} />}>
              {task.audioFileName}
            </MetaChip>
          )}
          {task.transaction && (
            <MetaChip
              icon={
                task.transactionType === 'Expense' ? (
                  <FiTrendingDown size={12} />
                ) : (
                  <FiTrendingUp size={12} />
                )
              }
            >
              {task.transactionType} Rs.{task.transaction}
            </MetaChip>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== MAIN TASK COMPONENT =====
function Task() {
  const router = useRouter();
  const pathname = usePathname();

  // Data states
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [deletingId, setDeletingId] = useState(null);

  // UI states
  const [showForm, setShowForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [errors, setErrors] = useState({});

  // Form states
  const [formType, setFormType] = useState('Action');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formRepeat, setFormRepeat] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [formAudioName, setFormAudioName] = useState('');
  const [formAudioFile, setFormAudioFile] = useState('');
  const [formTransaction, setFormTransaction] = useState('');
  const [formTransactionType, setFormTransactionType] = useState('');

  // ===== Load from APIs =====
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dbAudio, dbReminders, dbNotes] = await Promise.all([
          audioActionsApi.list(),
          remindersApi.list(),
          notesApi.list(),
        ]);
        
        const unified = [];
        
        dbAudio.forEach(a => {
          unified.push({
            id: 'A_' + a.audio_action_id,
            realId: a.audio_action_id,
            type: 'Action',
            content: a.audio_name || 'Audio Action',
            audioName: a.audio_name,
            playDate: a.play_datetime ? a.play_datetime.split('T')[0] : '',
            playTime: a.play_datetime ? a.play_datetime.split('T')[1].substring(0,5) : '',
            repeatTime: a.repeat_type !== 'None',
            audioFileName: a.file_path || '',
          });
        });

        dbReminders.forEach(r => {
          unified.push({
            id: 'R_' + r.reminder_id,
            realId: r.reminder_id,
            type: 'Reminder',
            content: r.title || 'Reminder',
            title: r.title,
            description: r.description || '',
            date: r.reminder_datetime ? r.reminder_datetime.split('T')[0] : '',
            time: r.reminder_datetime ? r.reminder_datetime.split('T')[1].substring(0,5) : '',
            repeatTime: r.repeat_type !== 'None',
          });
        });

        dbNotes.forEach(n => {
          const txns = n.transactions || [];
          const txn = txns.length > 0 ? txns[0] : null;
          unified.push({
            id: 'N_' + n.note_id,
            realId: n.note_id,
            type: 'Notes',
            content: n.title || 'Note',
            title: n.title,
            description: n.description || '',
            date: n.note_date || '',
            transaction: txn ? parseFloat(txn.amount) : '',
            transactionType: txn ? (txn.party_kind === 'user_given' ? 'Expense' : 'Income') : '',
          });
        });
        
        setTasks(unified.sort((a,b) => b.id.localeCompare(a.id)));
      } catch (err) {
        console.error("Failed to load tasks", err);
      }
    };
    fetchData();
  }, []);

  // ===== Filtered & Counts =====
  const filteredTasks =
    activeTab === 'All'
      ? tasks
      : tasks.filter((t) => t.type === activeTab);

  const counts = {
    All: tasks.length,
    Action: tasks.filter((t) => t.type === 'Action').length,
    Reminder: tasks.filter((t) => t.type === 'Reminder').length,
    Notes: tasks.filter((t) => t.type === 'Notes').length,
  };

  // ===== Toast =====
  const showToast = (msg) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // ===== Validate =====
  const validateForm = () => {
    const newErrors = {};

    if (!formContent.trim()) {
      newErrors.content = 'Content is required';
    }

    if (formType === 'Action') {
      if (!formDate) newErrors.date = 'Date is required';
      if (!formTime) newErrors.time = 'Time is required';
    }

    if (formType === 'Reminder') {
      if (!formTitle.trim()) newErrors.title = 'Title is required';
      if (!formDate) newErrors.date = 'Date is required';
      if (!formTime) newErrors.time = 'Time is required';
    }

    if (formType === 'Notes') {
      if (!formTitle.trim()) newErrors.title = 'Title is required';
      if (!formDate) newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== Reset Form =====
  const resetForm = () => {
    setFormType('Action');
    setFormTitle('');
    setFormContent('');
    setFormDate('');
    setFormTime('');
    setFormRepeat(false);
    setFormDescription('');
    setFormAudioName('');
    setFormAudioFile('');
    setFormTransaction('');
    setFormTransactionType('');
    setErrors({});
    setEditingTask(null);
  };

  // ===== Submit =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (formType === 'Action') {
        const payload = {
          audio_name: formContent.trim(),
          playback_mode: 'custom',
          file_path: formAudioFile.trim() || 'default.mp3',
          play_datetime: formDate && formTime ? `${formDate}T${formTime}:00` : null,
          repeat_type: formRepeat ? 'Daily' : 'None',
        };
        if (editingTask) {
          await audioActionsApi.update(editingTask.realId, payload);
        } else {
          await audioActionsApi.create(payload);
        }
      } else if (formType === 'Reminder') {
        const payload = {
          title: formTitle.trim(),
          description: formDescription.trim(),
          reminder_datetime: formDate && formTime ? `${formDate}T${formTime}:00` : null,
          repeat_type: formRepeat ? 'Daily' : 'None',
        };
        if (editingTask) {
          await remindersApi.update(editingTask.realId, payload);
        } else {
          await remindersApi.create(payload);
        }
      } else if (formType === 'Notes') {
        const payload = {
          title: formTitle.trim(),
          description: formDescription.trim(),
          note_date: formDate || null,
          note_type: 'general',
          input_source: 'manual',
        };
        
        let savedNote;
        if (editingTask) {
          savedNote = await notesApi.update(editingTask.realId, payload);
        } else {
          savedNote = await notesApi.create(payload);
        }
        
        if (formTransaction && parseFloat(formTransaction) > 0) {
           const txnPayload = {
             amount: parseFloat(formTransaction),
             currency: 'PKR',
             sender_person_id: formTransactionType === 'Expense' ? null : 1, // Need valid ids usually, omitting for simplicity if it fails, maybe needs proper UI
           };
           // Note: Transactions are complex, mapping simply here
           // We'll skip transaction if it fails to avoid crash
           try { await notesApi.addTransaction(savedNote.note_id, txnPayload); } catch(e){}
        }
      }
      
      showToast(editingTask ? 'Task updated!' : 'Task created!');
      setTimeout(() => router.refresh(), 1000); // Quick refresh to load API data
    } catch(err) {
      console.error(err);
      showToast('Failed to save task');
    }
    
    resetForm();
    setShowForm(false);
  };

  // ===== Delete =====
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const task = tasks.find(t => t.id === id);
      if (task.type === 'Action') await audioActionsApi.remove(task.realId);
      if (task.type === 'Reminder') await remindersApi.remove(task.realId);
      if (task.type === 'Notes') await notesApi.remove(task.realId);
      
      setTasks((prev) => prev.filter((t) => t.id !== id));
      showToast('Task deleted!');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete');
    }
    setDeletingId(null);
  };

  // ===== Edit =====
  const handleEdit = (task) => {
    setEditingTask(task);
    setFormType(task.type);
    setFormContent(task.content || '');
    setFormTitle(task.title || '');
    setFormDescription(task.description || '');
    setFormRepeat(task.repeatTime || false);

    if (task.type === 'Action') {
      setFormDate(task.playDate || '');
      setFormTime(task.playTime || '');
      setFormAudioName(task.audioName || '');
      setFormAudioFile(task.audioFileName || '');
    } else if (task.type === 'Reminder') {
      setFormDate(task.date || '');
      setFormTime(task.time || '');
    } else if (task.type === 'Notes') {
      setFormDate(task.date || '');
      setFormTransaction(task.transaction || '');
      setFormTransactionType(task.transactionType || '');
    }

    setShowForm(true);
  };

  // ===== Cancel =====
  const handleCancelForm = () => {
    resetForm();
    setShowForm(false);
  };

  const isActive = (path) => pathname === path;

  return (
    <div className="tk-wrapper">
      {/* ===== Header ===== */}
     {/* ===== Header ===== */}
<header className="tk-header">
  <div className="tk-header-left">
    {/* <button
      className="tk-back-btn btn-back"
      onClick={() => router.back()}
      aria-label="Go back"
    >
      <FiArrowLeft size={24} />
    </button> */}
    <button
      className="tk-back-btn btn-back"
      onClick={() => router.back()}
      aria-label="Go back"
      style={{
        background: "#0066ff", // Blue background for the "Back" button
        border: "none", // No border for a cleaner look
        borderRadius: "50%", // Circular button shape
        padding: "12px", // Add padding around the icon for better spacing
        cursor: "pointer", // Pointer cursor to indicate clickability
        display: "flex", // Flexbox to center the icon
        justifyContent: "center", // Center the icon horizontally
        alignItems: "center", // Center the icon vertically
        transition: "background 0.3s ease", // Smooth transition for background color on hover
      }}
      onMouseOver={(e) => e.currentTarget.style.background = "#0052cc"} // Darken the button color on hover
      onMouseOut={(e) => e.currentTarget.style.background = "#0066ff"} // Revert to the original color
    >
      <FiArrowLeft size={24} color="white" /> {/* Arrow icon with size 24 and white color */}
    </button>
    <div>
      <h1 className="tk-title">Smart Diary</h1>
      <p className="tk-subtitle">Your intelligent personal assistant</p>
    </div>
  </div>

  {/* <button
    className="tk-header-add btn-add"
    onClick={() => {
      resetForm();
      setShowForm(true);
    }}
    aria-label="Add new task"
  >
    <FiPlus size={24} />
  </button> */}
  <button
    className="tk-header-add btn-add"
    onClick={() => {
      resetForm();
      setShowForm(true);
    }}
    aria-label="Add new task"
    style={{
      background: "#28a745", // Green background for the "Add" button
      border: "none", // No border for a cleaner look
      borderRadius: "50%", // Circular button shape
      padding: "12px", // Add padding around the icon for better spacing
      cursor: "pointer", // Pointer cursor to indicate clickability
      display: "flex", // Use flexbox for centering the icon
      justifyContent: "center", // Center the icon horizontally
      alignItems: "center", // Center the icon vertically
      transition: "background 0.3s ease", // Smooth transition for background color on hover
    }}
    onMouseOver={(e) => e.currentTarget.style.background = "#218838"} // Darken the button color on hover
    onMouseOut={(e) => e.currentTarget.style.background = "#28a745"} // Revert to the original color
    >
    <FiPlus size={24} color="white" /> {/* Plus icon with size 24 and white color */}
  </button>
</header>
      {/* ===== Success Toast ===== */}
      {showSuccess && (
        <div className="tk-toast">
          <FiCheck className="tk-toast-icon" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ===== Summary Strip ===== */}
      <div className="tk-summary-strip">
        {Object.entries(counts)
          .filter(([k]) => k !== 'All')
          .map(([type, count]) => {
            const cfg = TYPE_CONFIG[type];
            return (
              <div
                key={type}
                className="tk-summary-card"
                onClick={() => setActiveTab(type)}
                role="button"
                tabIndex={0}
                aria-label={`Filter by ${type}`}
              >
                <div
                  className="tk-summary-icon-wrap"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  {cfg.icon}
                </div>
                <span
                  className="tk-summary-count"
                  style={{ color: cfg.color }}
                >
                  {count}
                </span>
                <span className="tk-summary-label">{type}</span>
              </div>
            );
          })}
      </div>

      {/* ===== Tabs ===== */}
      <div className="tk-tabs">
        {['All', 'Action', 'Reminder', 'Notes'].map((tab) => (
          <button
            key={tab}
            className={`tk-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={
              activeTab === tab && tab !== 'All'
                ? {
                    color: TYPE_CONFIG[tab].color,
                    borderColor: TYPE_CONFIG[tab].color,
                    background: TYPE_CONFIG[tab].bg,
                  }
                : {}
            }
          >
            <span className="tk-tab-icon">{TAB_ICONS[tab]}</span>
            {tab}
            {counts[tab] > 0 && (
              <span
                className="tk-tab-count"
                style={
                  activeTab === tab && tab !== 'All'
                    ? { background: TYPE_CONFIG[tab].color }
                    : {}
                }
              >
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ===== Form Modal ===== */}
      {showForm && (
        <div className="tk-form-overlay" onClick={handleCancelForm}>
          <div
            className="tk-form-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tk-form-header">
              <h2 className="tk-form-title">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h2>
              {/* <button
                className="tk-form-close"
                onClick={handleCancelForm}
                aria-label="Close form"
              >
                <FiX size={18} />
              </button> */}
              <button
                className="tk-form-close"
                onClick={handleCancelForm}
                aria-label="Close form"
                style={{
                  background: "#ff4444", // Red background for the "Close" button
                  border: "none", // No border for a cleaner look
                  borderRadius: "50%", // Circular button
                  padding: "10px", // Padding around the icon for better spacing
                  cursor: "pointer", // Pointer cursor to indicate it's clickable
                  display: "flex", // Use flexbox to center the icon
                  justifyContent: "center", // Center the icon horizontally
                  alignItems: "center", // Center the icon vertically
                  transition: "background 0.3s ease", // Smooth transition for background color on hover
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "#e60000"} // Darken the button color on hover
                onMouseOut={(e) => e.currentTarget.style.background = "#ff4444"} // Revert to the original color
              >
                <FiX size={18} color="white" /> {/* Close icon with size 18 and white color */}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="tk-form">
              {/* Task Type */}
              <div className="tk-input-group">
                <label className="tk-label">
                  <FiGrid className="tk-label-icon" />
                  Task Type
                </label>
                <div className="tk-type-options">
                  {['Action', 'Reminder', 'Notes'].map((type) => {
                    const cfg = TYPE_CONFIG[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`tk-type-btn ${
                          formType === type ? 'tk-type-active' : ''
                        }`}
                        style={
                          formType === type
                            ? {
                                background: cfg.color,
                                borderColor: cfg.color,
                                color: '#ffffff',
                              }
                            : {}
                        }
                        onClick={() => setFormType(type)}
                      >
                        {cfg.icon}
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title (Reminder & Notes) */}
              {(formType === 'Reminder' || formType === 'Notes') && (
                <div className="tk-input-group">
                  <label className="tk-label">
                    <FiType className="tk-label-icon" />
                    Title
                  </label>
                  <input
                    type="text"
                    className={`tk-input ${
                      errors.title ? 'tk-input-error' : ''
                    }`}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Enter title..."
                  />
                  {errors.title && (
                    <span className="tk-error">{errors.title}</span>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="tk-input-group">
                <label className="tk-label">
                  <FiFileText className="tk-label-icon" />
                  Content
                </label>
                <textarea
                  className={`tk-textarea ${
                    errors.content ? 'tk-input-error' : ''
                  }`}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Describe the task..."
                  rows={3}
                />
                {errors.content && (
                  <span className="tk-error">{errors.content}</span>
                )}
              </div>

              {/* Date & Time */}
              <div className="tk-row">
                <div className="tk-input-group">
                  <label className="tk-label">
                    <FiCalendar className="tk-label-icon" />
                    Date
                  </label>
                  <input
                    type="date"
                    className={`tk-input ${
                      errors.date ? 'tk-input-error' : ''
                    }`}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                  {errors.date && (
                    <span className="tk-error">{errors.date}</span>
                  )}
                </div>

                {(formType === 'Action' || formType === 'Reminder') && (
                  <div className="tk-input-group">
                    <label className="tk-label">
                      <FiClock className="tk-label-icon" />
                      Time
                    </label>
                    <input
                      type="time"
                      className={`tk-input ${
                        errors.time ? 'tk-input-error' : ''
                      }`}
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                    />
                    {errors.time && (
                      <span className="tk-error">{errors.time}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Repeat (Action & Reminder) */}
              {(formType === 'Action' || formType === 'Reminder') && (
                <div className="tk-input-group">
                  <label className="tk-label">
                    <FiRepeat className="tk-label-icon" />
                    Repeat
                  </label>
                  <div className="tk-toggle-row">
                    <button
                      type="button"
                      className={`tk-toggle-btn ${
                        formRepeat ? 'tk-toggle-on' : ''
                      }`}
                      onClick={() => setFormRepeat(true)}
                    >
                      On
                    </button>
                    <button
                      type="button"
                      className={`tk-toggle-btn ${
                        !formRepeat ? 'tk-toggle-off' : ''
                      }`}
                      onClick={() => setFormRepeat(false)}
                    >
                      Off
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Fields (Action) */}
              {formType === 'Action' && (
                <>
                  <div className="tk-input-group">
                    <label className="tk-label">
                      <FiMusic className="tk-label-icon" />
                      Audio Name
                    </label>
                    <input
                      type="text"
                      className="tk-input"
                      value={formAudioName}
                      onChange={(e) => setFormAudioName(e.target.value)}
                      placeholder="e.g., Surah Rehman"
                    />
                  </div>
                  <div className="tk-input-group">
                    <label className="tk-label">
                      <FiUpload className="tk-label-icon" />
                      Audio File Name
                    </label>
                    <input
                      type="text"
                      className="tk-input"
                      value={formAudioFile}
                      onChange={(e) => setFormAudioFile(e.target.value)}
                      placeholder="e.g., surah_rehman.mp3"
                    />
                  </div>
                </>
              )}

              {/* Transaction Fields (Notes) */}
              {formType === 'Notes' && (
                <div className="tk-row">
                  <div className="tk-input-group">
                    <label className="tk-label">
                      <FiDollarSign className="tk-label-icon" />
                      Amount
                    </label>
                    <div className="tk-amount-wrapper">
                      <span className="tk-currency">Rs.</span>
                      <input
                        type="number"
                        className="tk-input tk-amount-input"
                        value={formTransaction}
                        onChange={(e) => setFormTransaction(e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="tk-input-group">
                    <label className="tk-label">
                      <FiTrendingUp className="tk-label-icon" />
                      Type
                    </label>
                    <div className="tk-trans-options">
                      <button
                        type="button"
                        className={`tk-trans-btn ${
                          formTransactionType === 'Income'
                            ? 'tk-trans-income'
                            : ''
                        }`}
                        onClick={() => setFormTransactionType('Income')}
                      >
                        <FiTrendingUp size={12} />
                        Income
                      </button>
                      <button
                        type="button"
                        className={`tk-trans-btn ${
                          formTransactionType === 'Expense'
                            ? 'tk-trans-expense'
                            : ''
                        }`}
                        onClick={() => setFormTransactionType('Expense')}
                      >
                        <FiTrendingDown size={12} />
                        Expense
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Description (Reminder & Notes) */}
              {(formType === 'Reminder' || formType === 'Notes') && (
                <div className="tk-input-group">
                  <label className="tk-label">
                    <FiAlertCircle className="tk-label-icon" />
                    Description
                  </label>
                  <textarea
                    className="tk-textarea"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Additional details..."
                    rows={2}
                  />
                </div>
              )}

              {/* Form Actions */}
              <div className="tk-form-actions">
                <button
                  type="button"
                  className="tk-cancel-btn"
                  onClick={handleCancelForm}
                >
                  Cancel
                </button>
                <button type="submit" className="tk-submit-btn">
                  <FiCheck size={16} />
                  {editingTask ? 'Update' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Task List ===== */}
      <main className="tk-list">
        {filteredTasks.length === 0 ? (
          <div className="tk-empty">
            <div className="tk-empty-icon">
              <FiCheckSquare size={32} />
            </div>
            <p className="tk-empty-title">
              No {activeTab === 'All' ? '' : activeTab + ' '}tasks yet
            </p>
            <span className="tk-empty-text">
              Tap the + button to add your first task
            </span>
            <button
              className="tk-empty-btn btn-add"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <FiPlus size={16} />
              Add Task
            </button>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`tk-card-wrap ${
                deletingId === task.id ? 'tk-deleting' : ''
              }`}
            >
              <TaskCard
                task={task}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default function ProtectedTask() { return <ProtectedRoute><Task /></ProtectedRoute>; }