"use client";
import { useRouter, usePathname } from "next/navigation";
import React, { useState, useEffect, useRef } from 'react';
import {
  FiArrowLeft, FiPlus, FiEdit3, FiTrash2, FiHome, FiCheckSquare,
  FiSettings, FiSave, FiX, FiTag, FiGrid, FiLock, FiSearch,
} from 'react-icons/fi';
import "./CategoryManager.css";
import { categoriesApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

/* ── System default categories (user_id = NULL in DB, read-only in UI) ── */
const SYSTEM_CATEGORIES = [
  { id: 's1',  name: 'Gold',       icon: 'gold',       color: '#F5A623', isZakatable: true,  taxRelevant: true  },
  { id: 's2',  name: 'Silver',     icon: 'silver',     color: '#94a3b8', isZakatable: true,  taxRelevant: true  },
  { id: 's3',  name: 'Cash',       icon: 'cash',       color: '#10b981', isZakatable: true,  taxRelevant: true  },
  { id: 's4',  name: 'Vehicle',    icon: 'car',        color: '#3b82f6', isZakatable: false, taxRelevant: true  },
  { id: 's5',  name: 'Property',   icon: 'house',      color: '#8b5cf6', isZakatable: false, taxRelevant: true  },
  { id: 's6',  name: 'Expense',    icon: 'wallet',     color: '#ef4444', isZakatable: false, taxRelevant: false },
  { id: 's7',  name: 'Income',     icon: 'income',     color: '#22c55e', isZakatable: false, taxRelevant: false },
  { id: 's8',  name: 'Health',     icon: 'health',     color: '#06b6d4', isZakatable: false, taxRelevant: false },
  { id: 's9',  name: 'Education',  icon: 'book',       color: '#f59e0b', isZakatable: false, taxRelevant: false },
  { id: 's10', name: 'Legal',      icon: 'legal',      color: '#64748b', isZakatable: false, taxRelevant: false },
  { id: 's11', name: 'Gift',       icon: 'gift',       color: '#ec4899', isZakatable: false, taxRelevant: false },
  { id: 's12', name: 'Travel',     icon: 'travel',     color: '#a855f7', isZakatable: false, taxRelevant: false },
  { id: 's13', name: 'Function',   icon: 'function',   color: '#e11d48', isZakatable: false, taxRelevant: false },
  { id: 's14', name: 'Meeting',    icon: 'meeting',    color: '#14b8a6', isZakatable: false, taxRelevant: false },
  { id: 's15', name: 'Shopping',   icon: 'shopping',   color: '#ec4899', isZakatable: false, taxRelevant: false },
  { id: 's16', name: 'Bills',      icon: 'bills',      color: '#ef4444', isZakatable: false, taxRelevant: false },
  { id: 's17', name: 'Investment', icon: 'investment', color: '#6366f1', isZakatable: true,  taxRelevant: true  },
  { id: 's18', name: 'Zakat',      icon: 'zakat',      color: '#059669', isZakatable: false, taxRelevant: false },
  { id: 's19', name: 'General',    icon: 'misc',       color: '#64748b', isZakatable: false, taxRelevant: false },
];

const COLOR_OPTIONS = [
  '#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6',
  '#6366f1','#8b5cf6','#a855f7','#ec4899','#e11d48','#64748b',
];

function CategoryManager() {
  const router = useRouter();
  const pathname = usePathname(); // used by isActive()
  const timeoutRef = useRef(null);

  const [catName, setCatName]         = useState('');
  const [catDesc, setCatDesc]         = useState('');
  const [catColor, setCatColor]       = useState('#4a6cf7');
  const [isZakatable, setIsZakatable] = useState(false);
  const [taxRelevant, setTaxRelevant] = useState(false);

  const [allCats, setAllCats]             = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [viewTab, setViewTab]             = useState('all'); // all | system | custom
  const [searchQuery, setSearchQuery]     = useState('');
  const [errors, setErrors]               = useState({});
  const [showSuccess, setShowSuccess]     = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const data = await categoriesApi.list();
        const mapped = data.map(c => ({
          id: c.category_id,
          name: c.name,
          description: c.description || '',
          color: c.color || '#4a6cf7',
          isZakatable: c.is_zakatable,
          taxRelevant: c.tax_relevant,
          isSystem: c.user_id === null,
        }));
        setAllCats(mapped);
      } catch (err) {
        console.error("Failed to load categories", err);
      } finally {
        setIsInitialized(true);
      }
    };
    fetchCats();
  }, []);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const isActive = (path) => pathname === path;

  const showToast = (msg) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSuccessMessage(msg); setShowSuccess(true);
    timeoutRef.current = setTimeout(() => setShowSuccess(false), 3000);
  };

  const resetForm = () => {
    setCatName(''); setCatDesc(''); setCatColor('#4a6cf7');
    setIsZakatable(false); setTaxRelevant(false); setEditingId(null); setErrors({});
  };

  const validateForm = () => {
    const e = {};
    if (!catName.trim()) e.name = 'Category name is required';
    // Check duplicate
    const exists = allCats.find(
      c => c.name.toLowerCase() === catName.trim().toLowerCase() && c.id !== editingId
    );
    if (exists) e.name = 'Category name already exists';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name: catName.trim(),
      description: catDesc.trim() || undefined,
      color: catColor,
      is_zakatable: isZakatable,
      tax_relevant: taxRelevant,
    };

    try {
      if (editingId) {
        const updated = await categoriesApi.update(editingId, payload);
        const mapped = {
          id: updated.category_id, name: updated.name, description: updated.description || '',
          color: updated.color || '#4a6cf7', isZakatable: updated.is_zakatable,
          taxRelevant: updated.tax_relevant, isSystem: updated.user_id === null,
        };
        setAllCats(prev => prev.map(c => c.id === editingId ? mapped : c));
        showToast('Category updated');
      } else {
        const created = await categoriesApi.create(payload);
        const mapped = {
          id: created.category_id, name: created.name, description: created.description || '',
          color: created.color || '#4a6cf7', isZakatable: created.is_zakatable,
          taxRelevant: created.tax_relevant, isSystem: created.user_id === null,
        };
        setAllCats(prev => [...prev, mapped]);
        showToast('Category created');
      }
      resetForm(); setShowForm(false);
    } catch (err) {
      console.error(err);
      setErrors({ name: err.message || 'Failed to save category' });
    }
  };

  const handleEdit = (c) => {
    setCatName(c.name); setCatDesc(c.description || ''); setCatColor(c.color);
    setIsZakatable(c.isZakatable); setTaxRelevant(c.taxRelevant);
    setEditingId(c.id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await categoriesApi.remove(id);
      setAllCats(prev => prev.filter(c => c.id !== id));
      setShowDeleteConfirm(null); showToast('Category deleted');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete category');
    }
  };

  // We removed the allCats local definition since it's now state

  const displayCats = allCats
    .filter(c => {
      if (viewTab === 'system') return c.isSystem;
      if (viewTab === 'custom') return !c.isSystem;
      return true;
    })
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="catm-wrapper">
      {/* Header */}
      <div className="catm-header">
        <button className="catm-back-btn btn-back" onClick={() => router.back()} aria-label="Go back"><FiArrowLeft size={20} /></button>
        <div>
          <h1 className="catm-title">Categories</h1>
          <p className="catm-subtitle">{allCats.filter(c => c.isSystem).length} system + {allCats.filter(c => !c.isSystem).length} custom</p>
        </div>
        <button className="catm-add-btn btn-add" onClick={() => { resetForm(); setShowForm(true); }} aria-label="Add new category"><FiPlus size={20} /></button>
      </div>

      {/* Search */}
      <div className="catm-search-wrap">
        <FiSearch size={16} className="catm-search-icon" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search categories..." className="catm-search" />
      </div>

      {/* Tabs */}
      <div className="catm-tabs">
        {['all','system','custom'].map(t => (
          <button key={t} className={`catm-tab ${viewTab === t ? 'catm-tab-active' : ''}`}
            onClick={() => setViewTab(t)}>
            {t === 'all' ? 'All' : t === 'system' ? 'System' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Toast */}
      {showSuccess && (
        <div className="catm-toast"><FiTag size={16} />{successMessage}</div>
      )}

      {/* Category Grid */}
      <main className="catm-main">
        <div className="catm-grid">
          {displayCats.map(c => (
            <div key={c.id} className="catm-card">
              <div className="catm-card-color" style={{ background: c.color }} />
              <div className="catm-card-body">
                <div className="catm-card-top">
                  <span className="catm-card-name">{c.name}</span>
                  {c.isSystem && <FiLock size={12} className="catm-lock" title="System category" />}
                </div>
                {c.description && <p className="catm-card-desc">{c.description}</p>}
                <div className="catm-card-badges">
                  {c.isZakatable && <span className="catm-badge catm-badge-zakat">Zakatable</span>}
                  {c.taxRelevant && <span className="catm-badge catm-badge-tax">Tax</span>}
                </div>
                {!c.isSystem && (
                  <div className="catm-card-actions">
                    <button className="catm-edit-btn" onClick={() => handleEdit(c)}><FiEdit3 size={12} /></button>
                    <button className="catm-delete-btn btn-delete" onClick={() => setShowDeleteConfirm(c.id)} aria-label="Delete category"><FiTrash2 size={12} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div className="catm-modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="catm-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Category?</h3>
            <p>Custom category will be removed.</p>
            <div className="catm-modal-actions">
              <button className="catm-modal-cancel" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="catm-modal-delete" onClick={() => handleDelete(showDeleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="catm-modal-overlay" onClick={() => { resetForm(); setShowForm(false); }}>
          <div className="catm-form-modal" onClick={e => e.stopPropagation()}>
            <div className="catm-form-header">
              <h2>{editingId ? 'Edit Category' : 'New Category'}</h2>
              <button className="catm-form-close" onClick={() => { resetForm(); setShowForm(false); }}><FiX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="catm-form">
              <div className="catm-input-group">
                <label><FiTag size={14} /> Name *</label>
                <input type="text" value={catName} onChange={e => setCatName(e.target.value)}
                  placeholder="Category name" className={errors.name ? 'catm-input-error' : ''} />
                {errors.name && <span className="catm-error">{errors.name}</span>}
              </div>
              <div className="catm-input-group">
                <label>Description</label>
                <input type="text" value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Optional description" />
              </div>
              <div className="catm-input-group">
                <label>Color</label>
                <div className="catm-color-grid">
                  {COLOR_OPTIONS.map(col => (
                    <button key={col} type="button"
                      className={`catm-color-btn ${catColor === col ? 'catm-color-active' : ''}`}
                      style={{ background: col }}
                      onClick={() => setCatColor(col)} />
                  ))}
                </div>
              </div>
              <div className="catm-toggle-row">
                <label className="catm-toggle-label">
                  <input type="checkbox" checked={isZakatable} onChange={e => setIsZakatable(e.target.checked)} />
                  <span>Zakatable asset category</span>
                </label>
                <label className="catm-toggle-label">
                  <input type="checkbox" checked={taxRelevant} onChange={e => setTaxRelevant(e.target.checked)} />
                  <span>Tax relevant</span>
                </label>
              </div>
              <div className="catm-form-actions">
                <button type="button" className="catm-cancel-btn" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</button>
                <button type="submit" className="catm-submit-btn"><FiSave size={16} /> {editingId ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <nav className="footer-nav">
        <button className={`footer-btn ${isActive('/home') ? 'footer-btn-active' : ''}`} onClick={() => router.push('/home')}>
          <FiHome className="footer-icon" /><span>Home</span>
        </button>
        <button className={`footer-btn ${isActive('/task') ? 'footer-btn-active' : ''}`} onClick={() => router.push('/task')}>
          <FiCheckSquare className="footer-icon" /><span>Task</span>
        </button>
        <button className={`footer-btn ${isActive('/settings') ? 'footer-btn-active' : ''}`} onClick={() => router.push('/settings')}>
          <FiSettings className="footer-icon" /><span>Settings</span>
        </button>
      </nav>
    </div>
  );
}

export default function ProtectedCategoryManager() { return <ProtectedRoute><CategoryManager /></ProtectedRoute>; }
