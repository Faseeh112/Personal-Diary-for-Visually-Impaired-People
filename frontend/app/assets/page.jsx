"use client";
import { useRouter, usePathname } from "next/navigation";
import React, { useState, useEffect, useRef } from 'react';
import {
  FiArrowLeft, FiPlus, FiEdit3, FiTrash2, FiHome, FiCheckSquare,
  FiSettings, FiDollarSign, FiSave, FiX, FiTrendingUp,
  FiPackage, FiCalendar, FiMapPin, FiUser, FiFileText,
} from 'react-icons/fi';
import "./AssetManager.css";
import { assetsApi, categoriesApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

/* ── Schema-aligned categories (is_zakatable assets) ── */
const ASSET_CATEGORIES = [
  { value: 'Gold',       label: 'Gold',       color: '#F5A623', zakatable: true  },
  { value: 'Silver',     label: 'Silver',     color: '#94a3b8', zakatable: true  },
  { value: 'Cash',       label: 'Cash',       color: '#10b981', zakatable: true  },
  { value: 'Vehicle',    label: 'Vehicle',    color: '#3b82f6', zakatable: false },
  { value: 'Property',   label: 'Property',   color: '#8b5cf6', zakatable: false },
  { value: 'Investment', label: 'Investment', color: '#6366f1', zakatable: true  },
  { value: 'General',    label: 'General',    color: '#64748b', zakatable: false },
];

const ACQUISITION_TYPES = [
  { value: 'purchased',      label: 'Purchased' },
  { value: 'gift_received',  label: 'Gift Received' },
  { value: 'inherited',      label: 'Inherited' },
  { value: 'other',          label: 'Other' },
];

const PURPOSE_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'resale',   label: 'Resale' },
];

const CURRENCIES = ['PKR','USD','GBP','EUR','SAR','AED'];

function AssetManager() {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef(null);

  /* ── Form state (maps to asset table columns) ── */
  const [name, setName]                       = useState('');
  const [categoryId, setCategoryId]           = useState('');
  const [acquiredFrom, setAcquiredFrom]       = useState('');
  const [acquiredDate, setAcquiredDate]       = useState('');
  const [acquisitionType, setAcquisitionType] = useState('purchased');
  const [weightGrams, setWeightGrams]         = useState('');
  const [purchaseValue, setPurchaseValue]     = useState('');
  const [currentValue, setCurrentValue]       = useState('');
  const [currency, setCurrency]               = useState('PKR');
  const [purpose, setPurpose]                 = useState('personal');
  const [locationText, setLocationText]       = useState('');
  const [notes, setNotes]                     = useState('');

  /* ── UI state ── */
  const [assets, setAssets]             = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [filterCat, setFilterCat]       = useState('all');
  const [viewMode, setViewMode]         = useState('list'); // list | zakat | tax
  const [errors, setErrors]             = useState({});
  const [showSuccess, setShowSuccess]   = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const [dbCategories, setDbCategories] = useState([]);

  /* ── Load Data ── */
  useEffect(() => {
    const loadData = async () => {
      try {
        const [cats, assts] = await Promise.all([
          categoriesApi.list(),
          assetsApi.list()
        ]);
        setDbCategories(cats || []);
        
        // Map backend assets to frontend format
        const mappedAssets = (assts || []).map(a => {
          const cat = (cats || []).find(c => c.category_id === a.category_id);
          return {
            ...a,
            id: a.asset_id,
            categoryId: cat ? cat.name : 'General', // map to frontend string
            purchaseValue: a.purchase_value,
            currentValue: a.current_value,
            acquiredFrom: a.acquired_from,
            acquiredDate: a.acquired_date,
            acquisitionType: a.acquisition_type,
            weightGrams: a.weight_grams,
            isZakatable: a.is_zakatable,
            isTaxAsset: a.is_tax_asset,
            depreciationRate: a.depreciation_rate,
            locationText: a.location_text || a.notes, // simple fallback
          };
        });
        setAssets(mappedAssets);
      } catch (err) {
        console.error("Failed to load assets data", err);
      } finally {
        setIsInitialized(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  /* ── Helpers ── */
  const isActive = (path) => pathname === path;

  const getCatInfo = (val) => ASSET_CATEGORIES.find(c => c.value === val);

  const formatAmount = (num) => {
    if (!num) return '—';
    return new Intl.NumberFormat('en-PK').format(num);
  };

  const showToast = (msg) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSuccessMessage(msg);
    setShowSuccess(true);
    timeoutRef.current = setTimeout(() => setShowSuccess(false), 3000);
  };

  /* ── Zakat calculation (354+ days, 2.5%) ── */
  const calculateZakat = (asset) => {
    if (!asset.isZakatable || !asset.currentValue || !asset.acquiredDate) return null;
    const daysOwned = Math.floor((Date.now() - new Date(asset.acquiredDate)) / 86400000);
    if (daysOwned < 354) return null;
    return {
      due: Math.round(asset.currentValue * 0.025 * 100) / 100,
      daysOwned,
    };
  };

  /* ── Depreciation ── */
  const calculateDepreciation = (asset) => {
    if (!asset.depreciationRate || !asset.currentValue) return null;
    return {
      thisYear: Math.round(asset.currentValue * asset.depreciationRate * 100) / 100,
      nextYearValue: Math.round(asset.currentValue * (1 - asset.depreciationRate) * 100) / 100,
    };
  };

  /* ── Validation ── */
  const validateForm = () => {
    const e = {};
    if (!name.trim()) e.name = 'Asset name is required';
    if (!categoryId) e.categoryId = 'Select a category';
    if (!purchaseValue || parseFloat(purchaseValue) <= 0) e.purchaseValue = 'Enter valid purchase value';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Reset form ── */
  const resetForm = () => {
    setName(''); setCategoryId(''); setAcquiredFrom(''); setAcquiredDate('');
    setAcquisitionType('purchased'); setWeightGrams(''); setPurchaseValue('');
    setCurrentValue(''); setCurrency('PKR'); setPurpose('personal');
    setLocationText(''); setNotes(''); setEditingId(null); setErrors({});
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const catInfo = getCatInfo(categoryId);
    const isZakatable = catInfo?.zakatable || (categoryId === 'Vehicle' && purpose === 'resale');
    const depRate = categoryId === 'Vehicle' ? 0.20 : categoryId === 'Property' ? 0.05 : 0;

    const dbCat = dbCategories.find(c => c.name === categoryId);

    const payload = {
      name: name.trim(),
      category_id: dbCat ? dbCat.category_id : null,
      acquired_from: acquiredFrom.trim() || undefined,
      acquired_date: acquiredDate || new Date().toISOString().split('T')[0],
      acquisition_type: acquisitionType,
      weight_grams: weightGrams ? parseFloat(weightGrams) : undefined,
      purchase_value: parseFloat(purchaseValue),
      current_value: currentValue ? parseFloat(currentValue) : parseFloat(purchaseValue),
      currency: currency,
      is_zakatable: isZakatable,
      purpose: purpose,
      is_tax_asset: true,
      depreciation_rate: depRate,
      notes: notes.trim() || undefined,
    };

    try {
      if (editingId) {
        const updated = await assetsApi.update(editingId, payload);
        setAssets(prev => prev.map(a => a.id === editingId ? {
          ...updated,
          id: updated.asset_id,
          categoryId: categoryId,
          purchaseValue: updated.purchase_value,
          currentValue: updated.current_value,
          acquiredFrom: updated.acquired_from,
          acquiredDate: updated.acquired_date,
          acquisitionType: updated.acquisition_type,
          weightGrams: updated.weight_grams,
          isZakatable: updated.is_zakatable,
        } : a));
        showToast('Asset updated successfully');
      } else {
        const created = await assetsApi.create(payload);
        setAssets(prev => [{
          ...created,
          id: created.asset_id,
          categoryId: categoryId,
          purchaseValue: created.purchase_value,
          currentValue: created.current_value,
          acquiredFrom: created.acquired_from,
          acquiredDate: created.acquired_date,
          acquisitionType: created.acquisition_type,
          weightGrams: created.weight_grams,
          isZakatable: created.is_zakatable,
        }, ...prev]);
        showToast('Asset added successfully');
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setErrors({ name: err.message || 'Failed to save' });
    }
  };

  /* ── Edit ── */
  const handleEdit = (asset) => {
    setName(asset.name);
    setCategoryId(asset.categoryId);
    setAcquiredFrom(asset.acquiredFrom || '');
    setAcquiredDate(asset.acquiredDate || '');
    setAcquisitionType(asset.acquisitionType || 'purchased');
    setWeightGrams(asset.weightGrams || '');
    setPurchaseValue(asset.purchaseValue);
    setCurrentValue(asset.currentValue);
    setCurrency(asset.currency || 'PKR');
    setPurpose(asset.purpose || 'personal');
    setLocationText(asset.locationText || '');
    setNotes(asset.notes || '');
    setEditingId(asset.id);
    setShowForm(true);
  };

  /* ── Delete ── */
  const handleDelete = async (id) => {
    try {
      await assetsApi.remove(id);
      setAssets(prev => prev.filter(a => a.id !== id));
      setShowDeleteConfirm(null);
      showToast('Asset deleted');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete asset');
    }
  };

  /* ── Filtered + summary ── */
  const filtered = filterCat === 'all' ? assets : assets.filter(a => a.categoryId === filterCat);

  const totalNetWorth = assets.reduce((s, a) => s + (a.currentValue || 0), 0);
  const totalZakatDue = assets.reduce((s, a) => {
    const z = calculateZakat(a);
    return s + (z ? z.due : 0);
  }, 0);

  return (
    <div className="asset-wrapper">
      {/* ── Header ── */}
      <div className="asset-header">
        {/* <button className="asset-back-btn btn-back" onClick={() => router.back()} aria-label="Go back">
          <FiArrowLeft size={20} />
        </button> */}
        <button
          className="asset-back-btn btn-back"
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            background: "#0066ff", // Background color of the button (blue, customizable)
            border: "none", // Remove the border for a clean look
            borderRadius: "50%", // Circular button
            padding: "10px", // Padding around the icon for better spacing
            cursor: "pointer", // Pointer cursor to indicate clickability
            display: "flex", // Enable flexbox to align the icon
            justifyContent: "center", // Center the icon horizontally
            alignItems: "center", // Center the icon vertically
          }}
        >
          <FiArrowLeft size={20} color="white" /> {/* Arrow icon with size 20 and white color */}
        </button>
        <div>
          <h1 className="asset-title">Assets</h1>
          <p className="asset-subtitle">Track & manage your wealth</p>
        </div>
        {/* <button className="asset-add-btn btn-add" onClick={() => { resetForm(); setShowForm(true); }} aria-label="Add new asset">
          <FiPlus size={20} />
        </button> */}
        <button
  className="asset-add-btn btn-add"
  onClick={() => { resetForm(); setShowForm(true); }}
  aria-label="Add new asset"
  style={{
    background: "#28a745", // Green background for the button (indicating "Add")
    border: "none", // Remove the default border
    borderRadius: "50%", // Circular button
    padding: "10px", // Add padding to make the button larger and more clickable
    cursor: "pointer", // Pointer cursor to indicate it’s clickable
    display: "flex", // Use flexbox to center the icon
    justifyContent: "center", // Center the icon horizontally
    alignItems: "center", // Center the icon vertically
  }}
>
  <FiPlus size={20} color="white" /> {/* Plus icon with size 20 and white color */}
</button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="asset-summary-row">
        <div className="asset-summary-card asset-summary-worth">
          <span className="asset-summary-label">Net Worth</span>
          <span className="asset-summary-value">{formatAmount(totalNetWorth)}</span>
          <span className="asset-summary-currency">PKR</span>
        </div>
        <div className="asset-summary-card asset-summary-zakat">
          <span className="asset-summary-label">Zakat Due</span>
          <span className="asset-summary-value">{formatAmount(totalZakatDue)}</span>
          <span className="asset-summary-currency">2.5% of eligible</span>
        </div>
      </div>

      {/* ── View Tabs ── */}
      <div className="asset-view-tabs">
        {['list', 'zakat', 'tax'].map(v => (
          <button
            key={v}
            className={`asset-view-tab ${viewMode === v ? 'asset-view-tab-active' : ''}`}
            onClick={() => setViewMode(v)}
          >
            {v === 'list' ? 'All Assets' : v === 'zakat' ? 'Zakat View' : 'Tax View'}
          </button>
        ))}
      </div>

      {/* ── Filter Pills ── */}
      {viewMode === 'list' && (
        <div className="asset-filter-row">
          <button
            className={`asset-filter-pill ${filterCat === 'all' ? 'asset-filter-active' : ''}`}
            onClick={() => setFilterCat('all')}
          >All</button>
          {ASSET_CATEGORIES.map(c => (
            <button
              key={c.value}
              className={`asset-filter-pill ${filterCat === c.value ? 'asset-filter-active' : ''}`}
              style={filterCat === c.value ? { background: `${c.color}15`, color: c.color, borderColor: c.color } : {}}
              onClick={() => setFilterCat(c.value)}
            >{c.icon} {c.label}</button>
          ))}
        </div>
      )}

      {/* ── Toast ── */}
      {showSuccess && (
        <div className="asset-toast">
          <FiTrendingUp size={16} />
          {successMessage}
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="asset-main">

        {/* ── LIST VIEW ── */}
        {viewMode === 'list' && (
          filtered.length === 0 ? (
            <div className="asset-empty">
              <FiPackage size={40} />
              <h3>No Assets Yet</h3>
              <p>Add your first asset to start tracking your wealth</p>
              <button className="asset-empty-btn btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
                <FiPlus /> Add Asset
              </button>
            </div>
          ) : (
            <div className="asset-list">
              {filtered.map(asset => {
                const catInfo = getCatInfo(asset.categoryId);
                const zakat = calculateZakat(asset);
                return (
                  <div key={asset.id} className="asset-card">
                    <div className="asset-card-accent" style={{ background: catInfo?.color || '#94a3b8' }} />
                    <div className="asset-card-body">
                      <div className="asset-card-top">
                        <div className="asset-card-info">
                          <span className="asset-card-cat" style={{
                            background: `${catInfo?.color || '#64748b'}15`,
                            color: catInfo?.color || '#64748b',
                          }}>
                            {catInfo?.icon} {catInfo?.label || asset.categoryId}
                          </span>
                          <h3 className="asset-card-name">{asset.name}</h3>
                          {asset.acquiredFrom && (
                            <p className="asset-card-from">
                              <FiUser size={11} /> {asset.acquisitionType === 'gift_received' ? 'From' : 'Bought from'} {asset.acquiredFrom}
                            </p>
                          )}
                        </div>
                        <div className="asset-card-value-wrap">
                          <p className="asset-card-value">{formatAmount(asset.currentValue)}</p>
                          <span className="asset-card-curr">{asset.currency}</span>
                          {zakat && <span className="asset-card-zakat-badge">Zakat: {formatAmount(zakat.due)}</span>}
                        </div>
                      </div>
                      <div className="asset-card-bottom">
                        <span className="asset-card-date">
                          <FiCalendar size={12} />
                          {asset.acquiredDate ? new Date(asset.acquiredDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                        <span className="asset-card-purpose">{asset.purpose}</span>
                        <div className="asset-card-actions">
                          {/* <button className="asset-edit-btn" onClick={() => handleEdit(asset)}><FiEdit3 size={14} /></button>
                          <button className="asset-delete-btn btn-delete" onClick={() => setShowDeleteConfirm(asset.id)} aria-label="Delete asset"><FiTrash2 size={14} /></button> */}
                          <button
                            className="asset-edit-btn"
                            onClick={() => handleEdit(asset)}
                            style={{
                              background: "transparent", // Transparent background for the button
                              border: "none", // Remove button border
                              cursor: "pointer", // Pointer cursor for clickability
                              padding: "8px", // Add padding for space around the icon
                              display: "flex",
                              justifyContent: "center", // Center the icon horizontally
                              alignItems: "center", // Center the icon vertically
                            }}
                          >
                            <FiEdit3 size={14} color="#475569" /> {/* Edit icon with size 14 and dark grey color */}
                          </button>

                          <button
                            className="asset-delete-btn btn-delete"
                            onClick={() => setShowDeleteConfirm(asset.id)}
                            aria-label="Delete asset"
                            style={{
                              background: "#ff4444", // Red background for delete button
                              border: "none", // Remove border
                              cursor: "pointer", // Pointer cursor for clickability
                              padding: "8px", // Add padding for spacing
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
          )
        )}

        {/* ── ZAKAT VIEW ── */}
        {viewMode === 'zakat' && (
          <div className="asset-zakat-view">
            <div className="asset-zakat-header">
              <h3>Zakat Eligible Assets</h3>
              <p>Assets held 354+ days (Islamic lunar year) with 2.5% rate</p>
            </div>
            {assets.filter(a => a.isZakatable).length === 0 ? (
              <div className="asset-empty"><FiDollarSign size={40} /><h3>No Zakatable Assets</h3></div>
            ) : (
              <div className="asset-zakat-table">
                <div className="asset-table-head">
                  <span>Asset</span><span>Value</span><span>Days Owned</span><span>Zakat Due</span><span>Status</span>
                </div>
                {assets.filter(a => a.isZakatable).map(asset => {
                  const z = calculateZakat(asset);
                  return (
                    <div key={asset.id} className="asset-table-row">
                      <span className="asset-table-name">{asset.name}</span>
                      <span>{formatAmount(asset.currentValue)} {asset.currency}</span>
                      <span>{asset.acquiredDate ? Math.floor((Date.now() - new Date(asset.acquiredDate)) / 86400000) : '—'}</span>
                      <span className="asset-table-zakat">{z ? formatAmount(z.due) : '—'}</span>
                      <span className={`asset-table-status ${z ? 'asset-status-due' : 'asset-status-pending'}`}>
                        {z ? 'Due' : 'Not Yet'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAX VIEW ── */}
        {viewMode === 'tax' && (
          <div className="asset-tax-view">
            <div className="asset-zakat-header">
              <h3>Tax Assets & Depreciation</h3>
              <p>Annual depreciation schedule for tax reporting</p>
            </div>
            {assets.filter(a => a.isTaxAsset).length === 0 ? (
              <div className="asset-empty"><FiFileText size={40} /><h3>No Tax Assets</h3></div>
            ) : (
              <div className="asset-zakat-table">
                <div className="asset-table-head">
                  <span>Asset</span><span>Purchase</span><span>Current</span><span>Depr. Rate</span><span>This Year</span><span>Next Year</span>
                </div>
                {assets.filter(a => a.isTaxAsset).map(asset => {
                  const dep = calculateDepreciation(asset);
                  return (
                    <div key={asset.id} className="asset-table-row">
                      <span className="asset-table-name">{asset.name}</span>
                      <span>{formatAmount(asset.purchaseValue)}</span>
                      <span>{formatAmount(asset.currentValue)}</span>
                      <span>{asset.depreciationRate ? `${(asset.depreciationRate * 100).toFixed(0)}%` : '0%'}</span>
                      <span className="asset-table-depr">{dep ? formatAmount(dep.thisYear) : '—'}</span>
                      <span>{dep ? formatAmount(dep.nextYearValue) : formatAmount(asset.currentValue)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="asset-modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="asset-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Asset?</h3>
            <p>This action cannot be undone.</p>
            <div className="asset-modal-actions">
              <button className="asset-modal-cancel" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="asset-modal-delete" onClick={() => handleDelete(showDeleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Form Modal ── */}
      {showForm && (
        <div className="asset-modal-overlay" onClick={() => { resetForm(); setShowForm(false); }}>
          <div className="asset-form-modal" onClick={e => e.stopPropagation()}>
            <div className="asset-form-header">
              <h2>{editingId ? 'Edit Asset' : 'Add Asset'}</h2>
              {/* <button className="asset-form-close" onClick={() => { resetForm(); setShowForm(false); }}>
                <FiX size={20} />
              </button> */}
              <button
                className="asset-form-close"
                onClick={() => { resetForm(); setShowForm(false); }}
                style={{
                  background: "#ff4444", // Red background for close button (indicating "Close" or "Cancel")
                  border: "none", // Remove the default button border
                  borderRadius: "50%", // Circular button for the close icon
                  padding: "10px", // Add padding to make the button larger
                  cursor: "pointer", // Pointer cursor to indicate it's clickable
                  display: "flex", // Use flexbox to center the icon
                  justifyContent: "center", // Center the icon horizontally
                  alignItems: "center", // Center the icon vertically
                }}
              >
                <FiX size={20} color="white" /> {/* Close icon with size 20 and white color */}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="asset-form">
              {/* Name */}
              <div className="asset-input-group">
                <label><FiPackage size={14} /> Asset Name *</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g., Gold Ring, Honda Civic"
                  className={errors.name ? 'asset-input-error' : ''}
                />
                {errors.name && <span className="asset-error">{errors.name}</span>}
              </div>

              {/* Category */}
              <div className="asset-input-group">
                <label><FiFileText size={14} /> Category *</label>
                <div className="asset-cat-grid">
                  {ASSET_CATEGORIES.map(c => (
                    <button
                      key={c.value} type="button"
                      className={`asset-cat-btn ${categoryId === c.value ? 'asset-cat-active' : ''}`}
                      style={categoryId === c.value ? { background: `${c.color}20`, borderColor: c.color, color: c.color } : {}}
                      onClick={() => setCategoryId(c.value)}
                    >
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
                {errors.categoryId && <span className="asset-error">{errors.categoryId}</span>}
              </div>

              {/* Value + Currency row */}
              <div className="asset-row">
                <div className="asset-input-group asset-flex-2">
                  <label><FiDollarSign size={14} /> Purchase Value *</label>
                  <input
                    type="number" value={purchaseValue} onChange={e => setPurchaseValue(e.target.value)}
                    placeholder="Amount" min="0"
                    className={errors.purchaseValue ? 'asset-input-error' : ''}
                  />
                  {errors.purchaseValue && <span className="asset-error">{errors.purchaseValue}</span>}
                </div>
                <div className="asset-input-group asset-flex-1">
                  <label>Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Current Value */}
              <div className="asset-input-group">
                <label><FiTrendingUp size={14} /> Current Value</label>
                <input
                  type="number" value={currentValue} onChange={e => setCurrentValue(e.target.value)}
                  placeholder="Leave blank to use purchase value" min="0"
                />
              </div>

              {/* Acquisition row */}
              <div className="asset-row">
                <div className="asset-input-group asset-flex-1">
                  <label>Acquisition Type</label>
                  <select value={acquisitionType} onChange={e => setAcquisitionType(e.target.value)}>
                    {ACQUISITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="asset-input-group asset-flex-1">
                  <label>Purpose</label>
                  <select value={purpose} onChange={e => setPurpose(e.target.value)}>
                    {PURPOSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Acquired from + date */}
              <div className="asset-row">
                <div className="asset-input-group asset-flex-1">
                  <label><FiUser size={14} /> Acquired From</label>
                  <input type="text" value={acquiredFrom} onChange={e => setAcquiredFrom(e.target.value)} placeholder="Person or place" />
                </div>
                <div className="asset-input-group asset-flex-1">
                  <label><FiCalendar size={14} /> Acquired Date</label>
                  <input type="date" value={acquiredDate} onChange={e => setAcquiredDate(e.target.value)} />
                </div>
              </div>

              {/* Weight (for gold/silver) */}
              {(categoryId === 'Gold' || categoryId === 'Silver') && (
                <div className="asset-input-group">
                  <label>Weight (grams)</label>
                  <input type="number" step="0.01" value={weightGrams} onChange={e => setWeightGrams(e.target.value)} placeholder="e.g., 10.50" min="0" />
                </div>
              )}

              {/* Location + Notes */}
              <div className="asset-input-group">
                <label><FiMapPin size={14} /> Storage Location</label>
                <input type="text" value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="e.g., Bank locker, Home safe" />
              </div>

              <div className="asset-input-group">
                <label><FiFileText size={14} /> Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details..." rows={2} />
              </div>

              {/* Actions */}
              <div className="asset-form-actions">
                <button type="button" className="asset-cancel-btn" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</button>
                <button type="submit" className="asset-submit-btn">
                  <FiSave size={16} /> {editingId ? 'Update' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProtectedAssetManager() { return <ProtectedRoute><AssetManager /></ProtectedRoute>; }
