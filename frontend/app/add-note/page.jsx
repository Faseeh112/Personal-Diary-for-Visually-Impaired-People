"use client";
import { useRouter, usePathname } from "next/navigation";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FiArrowLeft, FiCalendar, FiDollarSign, FiFileText, FiTag, FiType,
  FiSave, FiPlus, FiTrash2, FiEdit3, FiHome, FiCheckSquare, FiSettings,
  FiCheck, FiX, FiTrendingUp, FiTrendingDown, FiBookOpen,
  FiToggleLeft, FiToggleRight, FiUser, FiMapPin,
} from 'react-icons/fi';
import "./AddNote.css";
import { notesApi, categoriesApi, personsApi, locationsApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

/* ── Schema-aligned categories (from category table INSERT) ── */
const CATEGORIES = [
  { value: 'Gold',       label: 'Gold',       color: '#F5A623' },
  { value: 'Silver',     label: 'Silver',     color: '#94a3b8' },
  { value: 'Cash',       label: 'Cash',       color: '#10b981' },
  { value: 'Vehicle',    label: 'Vehicle',    color: '#3b82f6' },
  { value: 'Property',   label: 'Property',   color: '#8b5cf6' },
  { value: 'Expense',    label: 'Expense',    color: '#ef4444' },
  { value: 'Income',     label: 'Income',     color: '#22c55e' },
  { value: 'Health',     label: 'Health',     color: '#06b6d4' },
  { value: 'Education',  label: 'Education',  color: '#f59e0b' },
  { value: 'Legal',      label: 'Legal',      color: '#64748b' },
  { value: 'Gift',       label: 'Gift',       color: '#ec4899' },
  { value: 'Travel',     label: 'Travel',     color: '#a855f7' },
  { value: 'Function',   label: 'Function',   color: '#e11d48' },
  { value: 'Meeting',    label: 'Meeting',    color: '#14b8a6' },
  { value: 'Shopping',   label: 'Shopping',   color: '#ec4899' },
  { value: 'Bills',      label: 'Bills',      color: '#ef4444' },
  { value: 'Investment', label: 'Investment', color: '#6366f1' },
  { value: 'Zakat',      label: 'Zakat',      color: '#059669' },
  { value: 'General',    label: 'General',    color: '#64748b' },
];

/* ── note_type from schema CHECK constraint ── */
const NOTE_TYPES = [
  { value: 'event',         label: 'Event',         icon: '', desc: 'Wedding, meeting, function' },
  { value: 'memory',        label: 'Memory',        icon: '', desc: 'Personal memory or thought' },
  { value: 'asset',         label: 'Asset',         icon: '', desc: 'Bought car, gold, property' },
  { value: 'gift_received', label: 'Gift Received', icon: '', desc: 'Received gift (auto-tracks asset)' },
  { value: 'general',       label: 'General',       icon: '', desc: 'Free-form diary entry' },
];

/* ── currency from currency table ── */
const CURRENCIES = ['PKR', 'USD', 'GBP', 'EUR', 'SAR', 'AED'];

function AddNote() {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef(null);
  const timeoutRef = useRef(null);

  /* ── Form state (maps to note table columns) ── */
  const [title, setTitle]                   = useState('');
  const [description, setDescription]       = useState('');
  const [noteType, setNoteType]             = useState('general');   // note.note_type
  const [noteDate, setNoteDate]             = useState('');           // note.note_date
  const [category, setCategory]             = useState('');           // note.category_id
  const [personId, setPersonId]             = useState('');           // note.person_id
  const [locationId, setLocationId]         = useState('');           // note.location_id

  /* ── Transaction fields ── */
  const [hasTransaction, setHasTransaction] = useState(false);       // note.has_transaction
  const [amount, setAmount]                 = useState('');           // note.amount
  const [direction, setDirection]           = useState('');           // note.direction: 'given' | 'received'
  const [currency, setCurrency]             = useState('PKR');        // note.currency

  /* ── Custom category ── */
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  /* ── UI state ── */
  const [notes, setNotes]                 = useState([]);
  const [persons, setPersons]             = useState([]);
  const [locations, setLocations]         = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [showSuccess, setShowSuccess]     = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errors, setErrors]               = useState({});
  const [editingId, setEditingId]         = useState(null);
  const [filterType, setFilterType]       = useState('all');
  const [filterNoteType, setFilterNoteType] = useState('all');

  /* ── Custom categories from localStorage ── */
  const [userCategories, setUserCategories] = useState([]);

  const allCategories = useMemo(
    () => [...CATEGORIES, ...userCategories],
    [userCategories]
  );

  /* ── Load from API ── */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dbNotes, dbCats, dbPersons, dbLocs] = await Promise.all([
          notesApi.list(),
          categoriesApi.list(),
          personsApi.list(),
          locationsApi.list()
        ]);
        
        setPersons(dbPersons);
        setLocations(dbLocs);
        
        setUserCategories(dbCats.map(c => ({
          value: String(c.category_id),
          label: c.name,
          color: c.color || '#64748b'
        })));

        const mappedNotes = dbNotes.map(n => {
          const txns = n.transactions || [];
          const txn = txns.length > 0 ? txns[0] : null;
          return {
            id: n.note_id,
            title: n.title || '',
            description: n.description || '',
            noteType: n.note_type,
            noteDate: n.note_date,
            category: String(n.category_id),
            personId: String(n.person_id || ''),
            locationId: String(n.location_id || ''),
            hasTransaction: !!txn,
            amount: txn ? parseFloat(txn.amount) : '',
            direction: txn ? (txn.party_kind === 'user_given' ? 'given' : 'received') : '',
            currency: txn ? txn.currency : 'PKR',
          };
        });
        setNotes(mappedNotes);
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setIsInitialized(true);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const handleEscape = (e) => { if (e.key === 'Escape') handleCancelForm(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showForm]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  /* ── Helpers ── */
  const isActive = (path) => pathname === path;

  const showToast = (msg) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSuccessMessage(msg); setShowSuccess(true);
    timeoutRef.current = setTimeout(() => setShowSuccess(false), 3000);
  };

  const getCategoryInfo = (val) =>
    allCategories.find(c => c.value === val) || { label: val, color: '#64748b' };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const formatAmount = (amt) => `${new Intl.NumberFormat('en-PK').format(amt)}`;

  /* ── Validation (matches schema CHECK constraints) ── */
  const validateForm = () => {
    const e = {};
    // ck_note_has_content: title OR description required
    if (!title.trim() && !description.trim()) e.title = 'Title or description is required';
    if (!noteDate) e.noteDate = 'Date is required';
    if (!category) e.category = 'Select a category';
    if (category === 'custom' && !customCategory.trim()) e.customCategory = 'Enter category name';
    // ck_note_transaction: if has_transaction, amount and direction required
    if (hasTransaction) {
      if (!amount || parseFloat(amount) <= 0) e.amount = 'Enter a valid amount';
      if (!direction) e.direction = 'Select Given or Received';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Reset ── */
  const resetForm = () => {
    setTitle(''); setDescription(''); setNoteType('general'); setNoteDate('');
    setCategory(''); setPersonId(''); setLocationId('');
    setHasTransaction(false); setAmount(''); setDirection(''); setCurrency('PKR');
    setCustomCategory(''); setShowCustomCategory(false);
    setErrors({}); setEditingId(null);
  };

  const handleCancelForm = () => { resetForm(); setShowForm(false); };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    let finalCategoryId = category;
    try {
      if (category === 'custom' && customCategory.trim()) {
        const customCatPayload = {
          name: customCategory.trim(),
          description: 'Created via AddNote',
          color: '#e11d48',
          is_zakatable: false,
          tax_relevant: false,
        };
        const createdCat = await categoriesApi.create(customCatPayload);
        finalCategoryId = String(createdCat.category_id);
        setUserCategories(prev => [...prev, {
          value: finalCategoryId,
          label: createdCat.name,
          color: createdCat.color
        }]);
      }

      const payload = {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        note_type: noteType,
        note_date: noteDate,
        category_id: finalCategoryId ? parseInt(finalCategoryId) : null,
        person_id: personId ? parseInt(personId) : null,
        location_id: locationId ? parseInt(locationId) : null,
        input_source: 'manual',
      };

      let savedNote;
      if (editingId) {
        savedNote = await notesApi.update(editingId, payload);
      } else {
        savedNote = await notesApi.create(payload);
      }

      let txnObj = null;
      if (hasTransaction) {
        const txnPayload = {
          amount: parseFloat(amount),
          currency: currency,
          sender_person_id: direction === 'given' ? null : (personId ? parseInt(personId) : null),
          receiver_person_id: direction === 'given' ? (personId ? parseInt(personId) : null) : null,
          category_id: finalCategoryId ? parseInt(finalCategoryId) : null,
        };
        txnObj = await notesApi.addTransaction(savedNote.note_id, txnPayload);
      }

      const newNote = {
        id: savedNote.note_id,
        title: savedNote.title || '',
        description: savedNote.description || '',
        noteType: savedNote.note_type,
        noteDate: savedNote.note_date,
        category: String(savedNote.category_id),
        personId: String(savedNote.person_id || ''),
        locationId: String(savedNote.location_id || ''),
        hasTransaction: !!txnObj,
        amount: txnObj ? parseFloat(txnObj.amount) : '',
        direction: txnObj ? (txnObj.party_kind === 'user_given' ? 'given' : 'received') : '',
        currency: txnObj ? txnObj.currency : 'PKR',
      };

      if (editingId) {
        setNotes(prev => prev.map(n => n.id === editingId ? newNote : n));
        showToast('Note updated!');
      } else {
        setNotes(prev => [newNote, ...prev]);
        showToast('Note saved!');
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setErrors({ title: err.message || 'Failed to save note' });
    }
  };

  /* ── Edit ── */
  const handleEdit = (note) => {
    setTitle(note.title || ''); setDescription(note.description || '');
    setNoteType(note.noteType || 'general'); setNoteDate(note.noteDate || '');
    setCategory(note.category || ''); setPersonId(note.personId || '');
    setLocationId(note.locationId || '');
    setHasTransaction(note.hasTransaction || false);
    setAmount(note.amount ? note.amount.toString() : '');
    setDirection(note.direction || ''); setCurrency(note.currency || 'PKR');
    setEditingId(note.id); setShowForm(true);
  };

  /* ── Delete ── */
  const handleDelete = async (id) => {
    if (window.confirm('Delete this note?')) {
      try {
        await notesApi.remove(id);
        setNotes(prev => prev.filter(n => n.id !== id));
        showToast('Note deleted!');
      } catch (err) {
        console.error(err);
        showToast('Failed to delete note');
      }
    }
  };

  /* ── Computed ── */
  const totalGiven = useMemo(() =>
    notes.filter(n => n.hasTransaction && n.direction === 'given')
      .reduce((s, n) => s + (n.amount || 0), 0), [notes]);

  const totalReceived = useMemo(() =>
    notes.filter(n => n.hasTransaction && n.direction === 'received')
      .reduce((s, n) => s + (n.amount || 0), 0), [notes]);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (filterNoteType !== 'all') result = result.filter(n => n.noteType === filterNoteType);
    if (filterType === 'given') result = result.filter(n => n.hasTransaction && n.direction === 'given');
    if (filterType === 'received') result = result.filter(n => n.hasTransaction && n.direction === 'received');
    if (filterType === 'none') result = result.filter(n => !n.hasTransaction);
    return result;
  }, [notes, filterType, filterNoteType]);

  return (
    <div className="addnote-container">
      {/* ── Header ── */}
      <header className="addnote-header">
        {/* <button className="addnote-back-btn btn-back" onClick={() => router.back()} aria-label="Go back"><FiArrowLeft size={20} /></button> */}
        <button
          className="addnote-back-btn btn-back"
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            backgroundColor: "#0066ff", // Optional: to style the button color
            borderRadius: "50%",
            padding: "10px", // Adds space inside the button
            border: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer", // Makes sure the button is clickable
          }}>
          <FiArrowLeft size={20} color="white" /> {/* Sets icon size to 20px and color to white */}
        </button>
        <div className="addnote-header-center">
          <FiBookOpen className="addnote-header-icon" />
          <h1 className="addnote-title">Notes</h1>
        </div>
        {/* <button className="addnote-add-btn btn-add" onClick={() => { resetForm(); setShowForm(true); }} aria-label="Add new note"><FiPlus size={20} /></button> */}
        <button
          className="addnote-add-btn btn-add"
          onClick={() => { resetForm(); setShowForm(true); }}
          aria-label="Add new note"
          style={{
            backgroundColor: "#28a745", // Green color for the button (can be customized)
            borderRadius: "50%",
            padding: "10px", // Adds space inside the button around the icon
            border: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer", // Ensures the button is clickable
          }} >
        <FiPlus size={20} color="white" /> {/* Sets icon size to 20px and color to white */}
      </button>
      </header>

      {/* ── Toast ── */}
      {showSuccess && (
        <div className="addnote-toast"><FiCheck size={16} /><span>{successMessage}</span></div>
      )}

      {/* ── Main ── */}
      <main className="addnote-main">
        {/* Summary Cards */}
        {notes.length > 0 && (totalGiven > 0 || totalReceived > 0) && (
          <div className="addnote-summary">
            <div className="addnote-summary-card addnote-given-card">
              <div className="addnote-summary-icon-wrap addnote-given-icon"><FiTrendingUp size={18} /></div>
              <div>
                <p className="addnote-summary-label">Given</p>
                <p className="addnote-summary-amount">{formatAmount(totalGiven)} <small>{currency}</small></p>
              </div>
            </div>
            <div className="addnote-summary-card addnote-received-card">
              <div className="addnote-summary-icon-wrap addnote-received-icon"><FiTrendingDown size={18} /></div>
              <div>
                <p className="addnote-summary-label">Received</p>
                <p className="addnote-summary-amount">{formatAmount(totalReceived)} <small>{currency}</small></p>
              </div>
            </div>
          </div>
        )}

        {/* Note Type Filter */}
        <div className="addnote-type-filter">
          <button className={`addnote-type-pill ${filterNoteType === 'all' ? 'addnote-pill-active' : ''}`}
            onClick={() => setFilterNoteType('all')}>All</button>
          {NOTE_TYPES.map(t => (
            <button key={t.value}
              className={`addnote-type-pill ${filterNoteType === t.value ? 'addnote-pill-active' : ''}`}
              onClick={() => setFilterNoteType(t.value)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Transaction Filter */}
        <div className="addnote-trans-filter">
          {['all','given','received','none'].map(f => (
            <button key={f}
              className={`addnote-trans-pill ${filterType === f ? 'addnote-transpill-active' : ''}`}
              onClick={() => setFilterType(f)}>
              {f === 'all' ? 'All' : f === 'given' ? '↑ Given' : f === 'received' ? '↓ Received' : 'No Trans'}
            </button>
          ))}
        </div>

        {/* ── Form Modal ── */}
        {showForm && (
          <div className="addnote-modal-overlay" onClick={handleCancelForm}>
            <div className="addnote-modal" onClick={e => e.stopPropagation()}>
              <div className="addnote-modal-header">
                <h2>{editingId ? 'Edit Note' : 'Add Note'}</h2>
                {/* <button className="addnote-modal-close" onClick={handleCancelForm}><FiX size={20} /></button> */}
                <button
                  className="addnote-modal-close"
                  onClick={handleCancelForm}
                  style={{
                    backgroundColor: "transparent", // Button background is transparent
                    border: "none", // No border
                    display: "flex",
                    justifyContent: "center", // Center the icon horizontally
                    alignItems: "center", // Center the icon vertically
                    padding: "8px", // Padding around the icon for better spacing
                    cursor: "pointer", // Ensure it's clickable
                  }}>
                  <FiX size={20} color="#475569" /> {/* Close icon with size 20 and a specific color */}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="addnote-form">
                {/* ── Note Type Selector (schema: note_type) ── */}
                <div className="addnote-input-group">
                  <label className="addnote-label"><FiFileText size={14} /> Note Type</label>
                  <div className="addnote-notetype-grid">
                    {NOTE_TYPES.map(t => (
                      <button key={t.value} type="button"
                        className={`addnote-notetype-btn ${noteType === t.value ? 'addnote-notetype-active' : ''}`}
                        onClick={() => setNoteType(t.value)}>
                        <span className="addnote-notetype-icon">{t.icon}</span>
                        <span className="addnote-notetype-label">{t.label}</span>
                        <span className="addnote-notetype-desc">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Title ── */}
                <div className="addnote-input-group">
                  <label className="addnote-label"><FiType size={14} /> Title</label>
                  <input type="text" className={`addnote-input ${errors.title ? 'addnote-input-error' : ''}`}
                    value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g., Ali's Wedding, Bought Gold Ring" autoFocus />
                  {errors.title && <span className="addnote-error">{errors.title}</span>}
                </div>

                {/* ── Date (schema: note_date) ── */}
                <div className="addnote-input-group">
                  <label className="addnote-label"><FiCalendar size={14} /> Date</label>
                  <input type="date" className={`addnote-input ${errors.noteDate ? 'addnote-input-error' : ''}`}
                    value={noteDate} onChange={e => setNoteDate(e.target.value)} />
                  {errors.noteDate && <span className="addnote-error">{errors.noteDate}</span>}
                </div>

                {/* ── Person (schema: person_id) ── */}
                <div className="addnote-input-group">
                  <label className="addnote-label"><FiUser size={14} /> Person</label>
                  <select className="addnote-input" value={personId} onChange={e => setPersonId(e.target.value)}>
                    <option value="">Select a person...</option>
                    {persons.map(p => <option key={p.person_id} value={p.person_id}>{p.name}</option>)}
                  </select>
                </div>

                {/* ── Location (schema: location_id) ── */}
                {(noteType === 'event' || noteType === 'memory') && (
                  <div className="addnote-input-group">
                    <label className="addnote-label"><FiMapPin size={14} /> Location</label>
                    <select className="addnote-input" value={locationId} onChange={e => setLocationId(e.target.value)}>
                      <option value="">Select a location...</option>
                      {locations.map(l => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
                    </select>
                  </div>
                )}

                {/* ── Category (schema: category_id) ── */}
                <div className="addnote-input-group">
                  <label className="addnote-label"><FiTag size={14} /> Category</label>
                  <div className="addnote-cat-grid">
                    {allCategories.map(c => (
                      <button key={c.value} type="button"
                        className={`addnote-cat-btn ${category === c.value ? 'addnote-cat-active' : ''}`}
                        style={{ '--cat-color': c.color }}
                        onClick={() => { setCategory(c.value); setShowCustomCategory(false); }}>
                        {c.label}
                      </button>
                    ))}
                    <button type="button"
                      className={`addnote-cat-btn addnote-custom-btn ${category === 'custom' ? 'addnote-cat-active' : ''}`}
                      style={{ '--cat-color': '#6b7280' }}
                      onClick={() => { setCategory('custom'); setShowCustomCategory(true); }}>
                      <FiPlus size={12} /> Custom
                    </button>
                  </div>
                  {errors.category && <span className="addnote-error">{errors.category}</span>}
                  {showCustomCategory && (
                    <div style={{ marginTop: 8 }}>
                      <input type="text" className={`addnote-input ${errors.customCategory ? 'addnote-input-error' : ''}`}
                        value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                        placeholder="Enter category name..." />
                      {errors.customCategory && <span className="addnote-error">{errors.customCategory}</span>}
                    </div>
                  )}
                </div>

                {/* ── Transaction Toggle (schema: has_transaction) ── */}
                <div className="addnote-input-group">
                  <label className="addnote-label"><FiDollarSign size={14} /> Transaction</label>
                  <button type="button" className={`addnote-toggle-btn ${hasTransaction ? 'addnote-toggle-on' : ''}`}
                    onClick={() => { setHasTransaction(!hasTransaction); if (hasTransaction) { setAmount(''); setDirection(''); } }}>
                    {hasTransaction ? <FiToggleRight size={22} /> : <FiToggleLeft size={22} />}
                    <span>{hasTransaction ? 'Transaction Involved' : 'No Transaction'}</span>
                  </button>
                </div>

                {/* ── Transaction Fields ── */}
                {hasTransaction && (
                  <div className="addnote-transaction-section">
                    <div className="addnote-row">
                      {/* Amount + Currency */}
                      <div className="addnote-input-group addnote-flex-2">
                        <label className="addnote-label">Amount</label>
                        <input type="number" className={`addnote-input ${errors.amount ? 'addnote-input-error' : ''}`}
                          value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="0" />
                        {errors.amount && <span className="addnote-error">{errors.amount}</span>}
                      </div>
                      <div className="addnote-input-group addnote-flex-1">
                        <label className="addnote-label">Currency</label>
                        <select className="addnote-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Direction: given / received (schema values) */}
                    <div className="addnote-input-group">
                      <label className="addnote-label">Direction</label>
                      <div className="addnote-dir-options">
                        <button type="button"
                          className={`addnote-dir-btn addnote-dir-given ${direction === 'given' ? 'addnote-dir-active-given' : ''}`}
                          onClick={() => setDirection('given')}>
                          <FiTrendingUp size={14} /> Given
                        </button>
                        <button type="button"
                          className={`addnote-dir-btn addnote-dir-received ${direction === 'received' ? 'addnote-dir-active-received' : ''}`}
                          onClick={() => setDirection('received')}>
                          <FiTrendingDown size={14} /> Received
                        </button>
                      </div>
                      {errors.direction && <span className="addnote-error">{errors.direction}</span>}
                    </div>
                  </div>
                )}

                {/* ── Description ── */}
                <div className="addnote-input-group">
                  <label className="addnote-label"><FiFileText size={14} /> Description</label>
                  <textarea className="addnote-textarea" value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add details about this note..." rows={3} />
                </div>

                {/* ── Actions ── */}
                <div className="addnote-form-actions">
                  <button type="button" className="addnote-cancel-btn" onClick={handleCancelForm}>Cancel</button>
                  <button type="submit" className="addnote-submit-btn">
                    <FiSave size={16} /> {editingId ? 'Update' : 'Save Note'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Notes List ── */}
        {filteredNotes.length === 0 && !showForm ? (
          <div className="addnote-empty">
            <div className="addnote-empty-icon"><FiBookOpen size={32} /></div>
            <h3>{notes.length === 0 ? 'No Notes Yet' : 'No matching notes'}</h3>
            <p>{notes.length === 0 ? 'Tap + to add your first note' : 'Try changing the filter'}</p>
            {notes.length === 0 && (
              <button className="addnote-empty-btn btn-add" onClick={() => setShowForm(true)}><FiPlus /> Add Note</button>
            )}
          </div>
        ) : (
          <div className="addnote-list">
            {filteredNotes.map(note => {
              const catInfo = getCategoryInfo(note.category);
              const typeInfo = NOTE_TYPES.find(t => t.value === note.noteType) || NOTE_TYPES[4];
              const hasTrans = note.hasTransaction && note.amount > 0;

              return (
                <div key={note.id} className="addnote-card">
                  <div className="addnote-card-accent" style={{
                    background: hasTrans
                      ? note.direction === 'given'
                        ? 'linear-gradient(135deg, #10b981, #34d399)'
                        : 'linear-gradient(135deg, #3b82f6, #60a5fa)'
                      : 'linear-gradient(135deg, #94a3b8, #cbd5e1)',
                  }} />
                  <div className="addnote-card-body">
                    <div className="addnote-card-top">
                      <div className="addnote-card-info">
                        <div className="addnote-card-badges">
                          <span className="addnote-card-type-badge">{typeInfo.icon} {typeInfo.label}</span>
                          <span className="addnote-card-cat" style={{
                            background: `${catInfo.color}15`, color: catInfo.color,
                          }}>{catInfo.label}</span>
                        </div>
                        <h3 className="addnote-card-title">{note.title || note.description?.slice(0, 50)}</h3>
                        {note.description && note.title && (
                          <p className="addnote-card-desc">{note.description}</p>
                        )}
                        {note.personId && (
                          <p className="addnote-card-person"><FiUser size={11} /> {persons.find(p => String(p.person_id) === note.personId)?.name || 'Unknown'}</p>
                        )}
                      </div>
                      {hasTrans ? (
                        <div className="addnote-card-amount-wrap">
                          <p className={`addnote-card-amount ${note.direction === 'given' ? 'addnote-amount-given' : 'addnote-amount-received'}`}>
                            {formatAmount(note.amount)}
                          </p>
                          <span className="addnote-card-curr">{note.currency}</span>
                          <span className={`addnote-card-dir ${note.direction === 'given' ? 'addnote-dir-tag-given' : 'addnote-dir-tag-received'}`}>
                            {note.direction === 'given' ? <FiTrendingUp size={12} /> : <FiTrendingDown size={12} />}
                            {note.direction === 'given' ? 'Given' : 'Received'}
                          </span>
                        </div>
                      ) : (
                        <span className="addnote-no-trans-badge">No Trans</span>
                      )}
                    </div>
                    <div className="addnote-card-bottom">
                      <span className="addnote-card-date"><FiCalendar size={12} /> {formatDate(note.noteDate)}</span>
                      <div className="addnote-card-actions">
                        {/* <button className="addnote-edit-btn" onClick={() => handleEdit(note)}><FiEdit3 size={14} /></button>
                        <button className="addnote-delete-btn btn-delete" onClick={() => handleDelete(note.id)} aria-label="Delete note"><FiTrash2 size={14} /></button> */}
                        <button
                          className="addnote-edit-btn"
                          onClick={() => handleEdit(note)}
                          style={{
                            background: "transparent", // Transparent background for the button
                            border: "none", // Remove button border
                            cursor: "pointer", // Pointer cursor for clickability
                            padding: "8px", // Add padding inside the button for space around the icon
                            display: "flex",
                            justifyContent: "center", // Center the icon horizontally
                            alignItems: "center", // Center the icon vertically
                          }}
                        >
                          <FiEdit3 size={14} color="#475569" /> {/* Edit icon with size 14 and color */}
                        </button>

                        <button
                          className="addnote-delete-btn btn-delete"
                          onClick={() => handleDelete(note.id)}
                          aria-label="Delete note"
                          style={{
                            background: "#ff4444", // Red color for delete button
                            border: "none", // Remove button border
                            cursor: "pointer", // Pointer cursor for clickability
                            padding: "8px", // Add padding inside the button
                            display: "flex",
                            justifyContent: "center", // Center the icon horizontally
                            alignItems: "center", // Center the icon vertically
                            borderRadius: "50%", // Make the button circular
                          }}
                        >
                          <FiTrash2 size={14} color="white" /> {/* Trash icon with size 14 and white color */}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProtectedAddNote() { return <ProtectedRoute><AddNote /></ProtectedRoute>; }
