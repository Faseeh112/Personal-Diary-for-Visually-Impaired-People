"use client";
import { useRouter, usePathname } from "next/navigation";
import React, { useState, useEffect } from 'react';
import "./ItemLocation.css";
import { storedItemsApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

const CATEGORIES = ['document', 'electronics', 'personal'];

const CAT_CONFIG = {
  Document:    { color: '#5b6ef5', bg: '#eceeff' },
  Electronics: { color: '#F5A623', bg: '#fff8ec' },
  Personal:    { color: '#4CAF82', bg: '#edfbf4' },
};

/* ── SVG Icons ── */
const BackIcon     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>;
const MapPinIcon   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const BoxIcon      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>;
const TagIcon      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const PinIcon      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const NoteIcon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const SaveIcon     = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const TrashIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const HomeIcon     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const TaskIcon     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
const SettingsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;

function ItemLocation() {
  const router = useRouter();

  const [item,        setItem]        = useState('');
  const [category,    setCategory]    = useState('');
  const [location,    setLocation]    = useState('');
  const [description, setDescription] = useState('');
  const [items,       setItems]       = useState([]);
  const [deletingId,  setDeletingId]  = useState(null);
  const [filterCat,   setFilterCat]   = useState('All');

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const data = await storedItemsApi.list();
        const mapped = data.map(i => ({
          id: i.stored_item_id,
          item: i.item_name,
          category: i.category || 'Personal', // map default
          location: i.location_text || 'Unknown',
          description: i.description || '',
        }));
        setItems(mapped);
      } catch (err) {
        console.error("Failed to load stored items", err);
      }
    };
    fetchItems();
  }, []);

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
    
  //   const payload = {
  //     item_name: item.trim(),
  //     category: category,
  //     location_text: location.trim(),
  //     description: description.trim() || undefined,
  //   };

  //   try {
  //     const created = await storedItemsApi.create(payload);
  //     const newItem = { 
  //       id: created.stored_item_id, 
  //       item: created.item_name, 
  //       category: created.category, 
  //       location: created.location_text, 
  //       description: created.description || '' 
  //     };
  //     setItems([...items, newItem]);
  //     setItem(''); setCategory(''); setLocation(''); setDescription('');
  //   } catch (err) {
  //     console.error("Failed to save item", err);
  //   }
  // };
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Normalize the category to lowercase
  const normalizedCategory = category.toLowerCase();

  // Ensure the category is valid
  if (!CATEGORIES.includes(normalizedCategory)) {
    console.error("Invalid category:", category);
    return;
  }

  const payload = {
    item_name: item.trim(),
    category: normalizedCategory, // Send the lowercase category
    location_text: location.trim(),
    description: description.trim() || undefined,
  };

  try {
    const created = await storedItemsApi.create(payload);
    const newItem = { 
      id: created.stored_item_id, 
      item: created.item_name, 
      category: created.category, 
      location: created.location_text, 
      description: created.description || '' 
    };
    setItems([...items, newItem]);
    setItem(''); setCategory(''); setLocation(''); setDescription('');
  } catch (err) {
    console.error("Failed to save item", err);
  }
};
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await storedItemsApi.remove(id);
      setTimeout(() => {
        setItems(items.filter(i => i.id !== id));
        setDeletingId(null);
      }, 300);
    } catch (err) {
      console.error("Failed to delete item", err);
      setDeletingId(null);
    }
  };

  const displayed = filterCat === 'All' ? items : items.filter(i => i.category === filterCat);
  const counts = {
    All: items.length,
    ...Object.fromEntries(CATEGORIES.map(c => [c, items.filter(i => i.category === c).length])),
  };

  return (
    <div className="il-wrapper">

      {/* ── Header ── */}
      <div className="il-header">
        {/* <button className="il-back-btn btn-back" onClick={() => router.back()} aria-label="Go back">
          <BackIcon />
        </button> */}
        <button
  className="il-back-btn btn-back"
  onClick={() => router.back()}
  aria-label="Go back"
  style={{
    background: "#0066ff", // Blue background for the back button
    border: "none", // Remove the default button border
    borderRadius: "50%", // Circular button shape
    padding: "10px", // Adds padding around the icon to give it more space
    cursor: "pointer", // Pointer cursor to indicate the button is clickable
    display: "flex", // Use flexbox for centering the icon
    justifyContent: "center", // Center the icon horizontally
    alignItems: "center", // Center the icon vertically
  }}
>
  <BackIcon size={20} color="white" /> {/* BackIcon with size 20 and white color */}
</button>
        <div className="il-header-text">
          <h1>Item Locations</h1>
          <p>Track where you keep things</p>
        </div>
        <div className="il-header-icon">
          <MapPinIcon />
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="il-form-card">
        <form onSubmit={handleSubmit}>

          {/* Item + Category */}
          <div className="il-row">
            <div className="il-field">
              <label className="il-label">
                <span className="il-label-icon"><BoxIcon /></span>
                Item
              </label>
              <div className="il-input-wrap">
                <span className="il-input-icon"><BoxIcon /></span>
                <input
                  className="il-input"
                  type="text"
                  value={item}
                  onChange={e => setItem(e.target.value)}
                  placeholder="Item name"
                  required
                />
              </div>
            </div>

            <div className="il-field">
              <label className="il-label">
                <span className="il-label-icon"><TagIcon /></span>
                Category
              </label>
              <div className="il-input-wrap">
                <span className="il-input-icon"><TagIcon /></span>
                <select
                  className="il-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  required
                >
                  <option value="">Select</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="il-field">
            <label className="il-label">
              <span className="il-label-icon"><PinIcon /></span>
              Location
            </label>
            <div className="il-input-wrap">
              <span className="il-input-icon"><PinIcon /></span>
              <input
                className="il-input"
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Where did you keep it?"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="il-field">
            <label className="il-label">
              <span className="il-label-icon"><NoteIcon /></span>
              Description
              <span className="il-label-optional">(optional)</span>
            </label>
            <div className="il-input-wrap il-textarea-wrap">
              <span className="il-input-icon il-textarea-icon"><NoteIcon /></span>
              <textarea
                className="il-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Additional notes…"
              />
            </div>
          </div>

          <button type="submit" className="il-save-btn">
            <SaveIcon /> Save Item
          </button>

        </form>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="il-filters">
        {['All', ...CATEGORIES].map(cat => {
          const cfg = CAT_CONFIG[cat];
          const isActive = filterCat === cat;
          return (
            <button
              key={cat}
              className={`il-filter-tab ${isActive ? 'active' : ''}`}
              style={isActive && cfg ? { color: cfg.color, borderColor: cfg.color, background: cfg.bg } : {}}
              onClick={() => setFilterCat(cat)}
            >
              {cat}
              <span
                className="il-filter-count"
                style={isActive ? { background: cfg?.color || '#5b6ef5', color: '#fff' } : {}}
              >
                {counts[cat]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Section Header ── */}
      <div className="il-section-header">
        <span className="il-section-title">Saved Items</span>
        <span className="il-section-count">
          {displayed.length} item{displayed.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Item List ── */}
      <div className="il-list">
        {displayed.length === 0 ? (
          <div className="il-empty">
            <div className="il-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <p>No items saved yet</p>
            <span>Add an item using the form above</span>
          </div>
        ) : (
          displayed.map(i => {
            const cfg = CAT_CONFIG[i.category] || { color: '#5b6ef5', bg: '#eceeff' };
            return (
              <div key={i.id} className={`il-item-wrap ${deletingId === i.id ? 'deleting' : ''}`}>
                <div className="il-item-card">
                  <div className="il-item-bar" style={{ background: cfg.color }} />
                  <div className="il-item-body">
                    <div className="il-item-top">
                      <p className="il-item-name">{i.item}</p>
                      {/* <button className="il-item-delete btn-delete" onClick={() => handleDelete(i.id)} aria-label="Delete item">
                        <TrashIcon />
                      </button> */}
                      <button
                        className="il-item-delete btn-delete"
                        onClick={() => handleDelete(i.id)}
                        aria-label="Delete item"
                        style={{
                          background: "#ff4444", // Red background for the delete button
                          border: "none", // No border for a cleaner look
                          cursor: "pointer", // Pointer cursor to indicate it's clickable
                          padding: "8px", // Padding around the icon
                          display: "flex", // Use flexbox to center the icon
                          justifyContent: "center", // Center the icon horizontally
                          alignItems: "center", // Center the icon vertically
                          borderRadius: "50%", // Circular button shape
                        }}
                      >
                        <TrashIcon size={14} color="white" /> {/* Trash icon with size 14 and white color */}
                      </button>
                    </div>
                    <div className="il-item-location">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      {i.location}
                    </div>
                    {i.description && <p className="il-item-desc">{i.description}</p>}
                    <span className="il-item-badge" style={{ color: cfg.color, background: cfg.bg }}>
                      {i.category}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

export default function ProtectedItemLocation() { return <ProtectedRoute><ItemLocation /></ProtectedRoute>; }