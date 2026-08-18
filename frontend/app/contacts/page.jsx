"use client";
import { useRouter, usePathname } from "next/navigation";
import React, { useState, useEffect, useRef } from 'react';
import {
  FiArrowLeft, FiPlus, FiEdit3, FiTrash2, FiHome, FiCheckSquare,
  FiSettings, FiSave, FiX, FiUser, FiPhone, FiFileText, FiSearch, FiUsers,
} from 'react-icons/fi';
import "./PersonManager.css";
import { personsApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

const RELATIONS = [
  'Father','Mother','Brother','Sister','Son','Daughter','Uncle','Aunt',
  'Cousin','Friend','Colleague','Neighbor','Business Partner','Other',
];

function PersonManager() {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef(null);

  /* ── Form state (maps to person table) ── */
  const [name, setName]         = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone]       = useState('');
  const [notes, setNotes]       = useState('');

  /* ── UI state ── */
  const [persons, setPersons]             = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [errors, setErrors]               = useState({});
  const [showSuccess, setShowSuccess]     = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    const fetchPersons = async () => {
      try {
        const data = await personsApi.list();
        const mapped = data.map(p => ({
          id: p.person_id,
          name: p.name,
          relation: p.relation,
          phone: p.phone,
          notes: p.notes,
        }));
        setPersons(mapped);
      } catch (err) {
        console.error("Failed to load persons", err);
      } finally {
        setIsInitialized(true);
      }
    };
    fetchPersons();
  }, []);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const isActive = (path) => pathname === path;

  const showToast = (msg) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSuccessMessage(msg); setShowSuccess(true);
    timeoutRef.current = setTimeout(() => setShowSuccess(false), 3000);
  };

  const resetForm = () => {
    setName(''); setRelation(''); setPhone(''); setNotes('');
    setEditingId(null); setErrors({});
  };

  const validateForm = () => {
    const e = {};
    if (!name.trim()) e.name = 'Name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name: name.trim(),
      relation: relation || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (editingId) {
        const updated = await personsApi.update(editingId, payload);
        const mapped = {
          id: updated.person_id, name: updated.name,
          relation: updated.relation, phone: updated.phone, notes: updated.notes
        };
        setPersons(prev => prev.map(p => p.id === editingId ? mapped : p));
        showToast('Contact updated');
      } else {
        const created = await personsApi.create(payload);
        const mapped = {
          id: created.person_id, name: created.name,
          relation: created.relation, phone: created.phone, notes: created.notes
        };
        setPersons(prev => [mapped, ...prev]);
        showToast('Contact added');
      }
      resetForm(); setShowForm(false);
    } catch (err) {
      console.error(err);
      setErrors({ name: err.message || 'Failed to save contact' });
    }
  };

  const handleEdit = (p) => {
    setName(p.name); setRelation(p.relation || ''); setPhone(p.phone || '');
    setNotes(p.notes || ''); setEditingId(p.id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await personsApi.remove(id);
      setPersons(prev => prev.filter(p => p.id !== id));
      setShowDeleteConfirm(null); showToast('Contact deleted');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete contact');
    }
  };

  const filtered = persons.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.relation || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (n) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const getAvatarColor = (n) => {
    const colors = ['#4a6cf7','#10b981','#f97316','#a855f7','#ef4444','#06b6d4','#e11d48','#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="person-wrapper">
      {/* Header */}
      <div className="person-header">
        {/* <button className="person-back-btn btn-back" onClick={() => router.back()} aria-label="Go back">
          <FiArrowLeft size={20} />
        </button> */}
        <button
          className="person-back-btn btn-back"
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            background: "#0066ff", // Set the button's background color (blue)
            border: "none", // Remove the default border
            borderRadius: "50%", // Circular button shape
            padding: "10px", // Adds space around the icon for better clickability
            cursor: "pointer", // Ensures the button is clickable
            display: "flex", // Use flexbox to center the icon
            justifyContent: "center", // Center the icon horizontally
            alignItems: "center", // Center the icon vertically
          }}
        >
          <FiArrowLeft size={20} color="white" /> {/* Set icon size to 20px and color to white */}
        </button>
        <div>
          <h1 className="person-title">Contacts</h1>
          <p className="person-subtitle">{persons.length} people</p>
        </div>
        {/* <button className="person-add-btn btn-add" onClick={() => { resetForm(); setShowForm(true); }} aria-label="Add new contact">
          <FiPlus size={20} />
        </button> */}
        <button
          className="person-add-btn btn-add"
          onClick={() => { resetForm(); setShowForm(true); }}
          aria-label="Add new contact"
          style={{
            background: "#28a745", // Green background for the "Add" button
            border: "none", // Remove the default border for a cleaner look
            borderRadius: "50%", // Circular button
            padding: "10px", // Add padding inside the button around the icon
            cursor: "pointer", // Pointer cursor to indicate clickability
            display: "flex", // Use flexbox to center the icon
            justifyContent: "center", // Center the icon horizontally
            alignItems: "center", // Center the icon vertically
          }}
        >
          <FiPlus size={20} color="white" /> {/* Plus icon with size 20 and white color */}
        </button>
      </div>

      {/* Search */}
      <div className="person-search-wrap">
        <FiSearch size={16} className="person-search-icon" />
        <input
          type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search contacts..." className="person-search"
        />
      </div>

      {/* Toast */}
      {showSuccess && (
        <div className="person-toast"><FiUser size={16} />{successMessage}</div>
      )}

      {/* List */}
      <main className="person-main">
        {filtered.length === 0 ? (
          <div className="person-empty">
            <FiUsers size={40} />
            <h3>{persons.length === 0 ? 'No Contacts Yet' : 'No matches found'}</h3>
            <p>{persons.length === 0 ? 'Add people you interact with' : 'Try a different search'}</p>
            {persons.length === 0 && (
              <button className="person-empty-btn btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
                <FiPlus /> Add Contact
              </button>
            )}
          </div>
        ) : (
          <div className="person-list">
            {filtered.map(p => (
              <div key={p.id} className="person-card">
                <div className="person-avatar" style={{ background: getAvatarColor(p.name) }}>
                  {getInitials(p.name)}
                </div>
                <div className="person-card-info">
                  <h3 className="person-card-name">{p.name}</h3>
                  {p.relation && <span className="person-card-relation">{p.relation}</span>}
                  {p.phone && <span className="person-card-phone"><FiPhone size={11} /> {p.phone}</span>}
                </div>
                <div className="person-card-actions">
                  {/* <button className="person-edit-btn" onClick={() => handleEdit(p)}><FiEdit3 size={14} /></button>
                  <button className="person-delete-btn btn-delete" onClick={() => setShowDeleteConfirm(p.id)} aria-label="Delete contact"><FiTrash2 size={14} /></button> */}
                  <button
                    className="person-edit-btn"
                    onClick={() => handleEdit(p)}
                    style={{
                      background: "transparent", // Transparent background for the edit button
                      border: "none", // No border for a cleaner look
                      cursor: "pointer", // Pointer cursor to indicate clickability
                      padding: "8px", // Padding inside the button for better spacing around the icon
                      display: "flex", // Flexbox for centering the icon
                      justifyContent: "center", // Center the icon horizontally
                      alignItems: "center", // Center the icon vertically
                    }}
                  >
                    <FiEdit3 size={14} color="#475569" /> {/* Edit icon with size 14 and dark grey color */}
                  </button>

                  <button
                    className="person-delete-btn btn-delete"
                    onClick={() => setShowDeleteConfirm(p.id)}
                    aria-label="Delete contact"
                    style={{
                      background: "#ff4444", // Red background for the delete button
                      border: "none", // No border for a cleaner look
                      cursor: "pointer", // Pointer cursor to indicate clickability
                      padding: "8px", // Padding inside the button for better spacing
                      display: "flex", // Flexbox for centering the icon
                      justifyContent: "center", // Center the icon horizontally
                      alignItems: "center", // Center the icon vertically
                      borderRadius: "50%", // Make the button circular
                    }}
                  >
                    <FiTrash2 size={14} color="white" /> {/* Trash icon with size 14 and white color */}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div className="person-modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="person-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Contact?</h3>
            <p>This person will be removed from your contacts.</p>
            <div className="person-modal-actions">
              <button className="person-modal-cancel" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="person-modal-delete" onClick={() => handleDelete(showDeleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="person-modal-overlay" onClick={() => { resetForm(); setShowForm(false); }}>
          <div className="person-form-modal" onClick={e => e.stopPropagation()}>
            <div className="person-form-header">
              <h2>{editingId ? 'Edit Contact' : 'Add Contact'}</h2>
              {/* <button className="person-form-close" onClick={() => { resetForm(); setShowForm(false); }}><FiX size={20} /></button> */}
              <button
                className="person-form-close"
                onClick={() => { resetForm(); setShowForm(false); }}
                style={{
                  background: "#ff4444", // Red background for the close button
                  border: "none", // Remove the default border for a cleaner look
                  borderRadius: "50%", // Circular button shape
                  padding: "10px", // Padding around the icon for better spacing
                  cursor: "pointer", // Pointer cursor to indicate it’s clickable
                  display: "flex", // Flexbox for centering the icon
                  justifyContent: "center", // Center the icon horizontally
                  alignItems: "center", // Center the icon vertically
                }}
              >
                <FiX size={20} color="white" /> {/* Close icon with size 20 and white color */}
              </button>
            </div>
            <form onSubmit={handleSubmit} className="person-form">
              <div className="person-input-group">
                <label><FiUser size={14} /> Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Full name" className={errors.name ? 'person-input-error' : ''} />
                {errors.name && <span className="person-error">{errors.name}</span>}
              </div>
              <div className="person-input-group">
                <label><FiUsers size={14} /> Relation</label>
                <select value={relation} onChange={e => setRelation(e.target.value)}>
                  <option value="">Select relation</option>
                  {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="person-input-group">
                <label><FiPhone size={14} /> Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
              </div>
              <div className="person-input-group">
                <label><FiFileText size={14} /> Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
              </div>
              <div className="person-form-actions">
                <button type="button" className="person-cancel-btn" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</button>
                <button type="submit" className="person-submit-btn"><FiSave size={16} /> {editingId ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProtectedPersonManager() { return <ProtectedRoute><PersonManager /></ProtectedRoute>; }
