"use client";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiUser, FiMail, FiSave, FiLogOut, FiSettings, FiEdit3, FiCheck } from 'react-icons/fi';
import { useAuth } from "../../contexts/AuthContext";
import { userApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

function Settings() {
  const router = useRouter();
  const { user, logout, setUser } = useAuth();

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    setProfileName(user?.name || '');
  }, [user]);

  useEffect(() => {
    userApi.getSettings()
      .then(s => setSettings(s))
      .catch(() => setSettings(null))
      .finally(() => setLoadingSettings(false));
  }, []);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const handleUpdateProfile = async () => {
    if (!profileName.trim()) return;
    setSaving(true);
    try {
      const updated = await userApi.updateMe({ name: profileName.trim() });
      if (setUser) setUser(prev => ({ ...prev, name: updated.name || profileName.trim() }));
      setEditingProfile(false);
      showToast('Profile updated');
    } catch (err) {
      showToast(err.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleUpdateSetting = async (key, value) => {
    try {
      const updated = await userApi.updateSettings({ [key]: value });
      setSettings(prev => ({ ...prev, ...updated }));
      showToast('Setting saved');
    } catch (err) { showToast(err.message || 'Failed'); }
  };

  const handleLogout = () => { logout(); router.replace("/login"); };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <button className="btn-back" onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><FiArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Settings</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Manage your account</p>
        </div>
        <FiSettings size={22} style={{ color: '#94a3b8' }} />
      </div>

      {/* Toast */}
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 1000 }}>{toast}</div>}

      <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>
        {/* Profile Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#334155' }}>Profile</h3>
            {!editingProfile && <button onClick={() => setEditingProfile(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a6cf7', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}><FiEdit3 size={14} /> Edit</button>}
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #4a6cf7, #6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              {editingProfile ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 180, outline: 'none' }} />
                  <button onClick={handleUpdateProfile} disabled={saving}
                    style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <FiCheck size={16} />
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#1e293b' }}>{user?.name || 'User'}</p>
              )}
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}><FiMail size={12} /> {user?.email || ''}</p>
            </div>
          </div>
        </div>

        {/* Preferences Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#334155' }}>Preferences</h3>
          {loadingSettings ? (
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading settings...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SettingToggle label="Default Currency" value={settings?.default_currency || 'PKR'}
                options={['PKR', 'USD', 'GBP', 'EUR', 'SAR', 'AED']}
                onChange={v => handleUpdateSetting('default_currency', v)} />
              <SettingToggle label="Language" value={settings?.language || 'en'}
                options={['en', 'ur']} labels={['English', 'Urdu']}
                onChange={v => handleUpdateSetting('language', v)} />
            </div>
          )}
        </div>

        {/* Logout */}
        <button onClick={handleLogout}
          style={{ width: '100%', padding: '14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <FiLogOut size={18} /> Log Out
        </button>
      </div>
    </div>
  );
}

function SettingToggle({ label, value, options, labels, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#475569' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', color: '#334155', outline: 'none' }}>
        {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
      </select>
    </div>
  );
}

export default function ProtectedSettings() { return <ProtectedRoute><Settings /></ProtectedRoute>; }
