"use client";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from 'react';
import { FiArrowLeft, FiPlus, FiEdit3, FiTrash2, FiSave, FiX, FiMapPin, FiSearch } from 'react-icons/fi';
import { locationsApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

function LocationManager() {
  const router = useRouter();
  const timeoutRef = useRef(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [locType, setLocType] = useState('');
  const [notes, setNotes] = useState('');

  const [locations, setLocations] = useState([]);
  const [isInit, setIsInit] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    locationsApi.list().then(d => {
      setLocations((d || []).map(l => ({ id: l.location_id, name: l.name, address: l.address, type: l.location_type, notes: l.notes })));
    }).catch(console.error).finally(() => setIsInit(true));
  }, []);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const showToast = (m) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setSuccessMsg(m); setShowSuccess(true); timeoutRef.current = setTimeout(() => setShowSuccess(false), 3000); };
  const resetForm = () => { setName(''); setAddress(''); setLocType(''); setNotes(''); setEditingId(null); setErrors({}); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!name.trim()) er.name = 'Name is required';
    setErrors(er);
    if (Object.keys(er).length) return;
    const payload = { name: name.trim(), address: address.trim() || null, location_type: locType || null, notes: notes.trim() || null };
    try {
      if (editingId) {
        const u = await locationsApi.update(editingId, payload);
        setLocations(p => p.map(l => l.id === editingId ? { id: u.location_id, name: u.name, address: u.address, type: u.location_type, notes: u.notes } : l));
        showToast('Location updated');
      } else {
        const c = await locationsApi.create(payload);
        setLocations(p => [{ id: c.location_id, name: c.name, address: c.address, type: c.location_type, notes: c.notes }, ...p]);
        showToast('Location added');
      }
      resetForm(); setShowForm(false);
    } catch (err) { setErrors({ name: err.message || 'Failed to save' }); }
  };

  const handleEdit = (l) => { setName(l.name); setAddress(l.address || ''); setLocType(l.type || ''); setNotes(l.notes || ''); setEditingId(l.id); setShowForm(true); };

  const handleDelete = async (id) => {
    try { await locationsApi.remove(id); setLocations(p => p.filter(l => l.id !== id)); setDeleteConfirm(null); showToast('Location deleted'); }
    catch (err) { console.error(err); showToast('Failed to delete'); }
  };

  const filtered = locations.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || (l.address || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const getColor = (n) => { const c = ['#4a6cf7','#10b981','#f97316','#a855f7','#ef4444','#06b6d4','#e11d48','#8b5cf6']; let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h); return c[Math.abs(h) % c.length]; };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <button className="btn-back" onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><FiArrowLeft size={20} /></button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Locations</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{locations.length} places</p>
        </div>
        <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }} style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><FiPlus size={20} /></button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ position: 'relative' }}>
          <FiSearch size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search locations..."
            style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none' }} />
        </div>
      </div>

      {/* Toast */}
      {showSuccess && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 1000 }}><FiMapPin size={14} style={{ marginRight: 6 }} />{successMsg}</div>}

      {/* List */}
      <div style={{ padding: '16px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <FiMapPin size={40} />
            <h3 style={{ margin: '12px 0 4px', color: '#475569' }}>{locations.length === 0 ? 'No Locations Yet' : 'No matches'}</h3>
            <p style={{ fontSize: 14 }}>{locations.length === 0 ? 'Add places you visit or reference' : 'Try a different search'}</p>
            {locations.length === 0 && <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiPlus /> Add Location</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(l => (
              <div key={l.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${getColor(l.name)}15`, color: getColor(l.name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 16 }}>
                  <FiMapPin size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{l.name}</p>
                  {l.address && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{l.address}</p>}
                  {l.type && <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 6 }}>{l.type}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleEdit(l)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><FiEdit3 size={14} /></button>
                  <button className="btn-delete" onClick={() => setDeleteConfirm(l.id)} style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><FiTrash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Delete Location?</h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>This location will be permanently removed.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => { resetForm(); setShowForm(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{editingId ? 'Edit Location' : 'Add Location'}</h2>
              <button onClick={() => { resetForm(); setShowForm(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><FiX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}><FiMapPin size={14} /> Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Location name"
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.name ? '#ef4444' : '#e2e8f0'}`, borderRadius: 10, fontSize: 14, outline: 'none' }} />
                {errors.name && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>{errors.name}</span>}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Type</label>
                <select value={locType} onChange={e => setLocType(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff' }}>
                  <option value="">Select type</option>
                  {['Home', 'Office', 'Shop', 'Bank', 'Hospital', 'School', 'Mosque', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional info..." rows={2}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4a6cf7, #6366f1)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><FiSave size={16} /> {editingId ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default function ProtectedLocationManager() { return <ProtectedRoute><LocationManager /></ProtectedRoute>; }
