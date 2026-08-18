"use client";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from 'react';
import "./AudioAction.css";
import { audioActionsApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

function AudioAction() {
  const router = useRouter();
  const [audioName, setAudioName] = useState('');
  const [playDate, setPlayDate] = useState('');
  const [playTime, setPlayTime] = useState('');
  const [repeatTime, setRepeatTime] = useState(false);
  const [audioContent, setAudioContent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    audioActionsApi.list().then(d => setActions(d || [])).catch(console.error);
  }, []);

  const showToast = (m) => { setSuccessMsg(m); setShowSuccess(true); setTimeout(() => setShowSuccess(false), 3000); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!audioName.trim()) err.name = 'Required';
    if (!playDate) err.date = 'Required';
    if (!playTime) err.time = 'Required';
    setErrors(err);
    if (Object.keys(err).length) return;
    setLoading(true);
    try {
      const created = await audioActionsApi.create({
        audio_name: audioName.trim(),
        playback_mode: 'custom',
        file_path: audioContent ? audioContent.name : 'default.mp3',
        play_datetime: `${playDate}T${playTime}:00`,
        repeat_type: repeatTime ? 'Daily' : 'None',
      });
      setActions(p => [created, ...p]);
      setAudioName(''); setPlayDate(''); setPlayTime(''); setRepeatTime(false); setAudioContent(null);
      showToast('Audio action created!');
    } catch (er) { setErrors({ name: er.message || 'Failed' }); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try { await audioActionsApi.remove(id); setActions(p => p.filter(a => a.audio_action_id !== id)); showToast('Deleted'); }
    catch (er) { console.error(er); }
  };

  const fmtDt = (dt) => { try { return new Date(dt).toLocaleString('en-PK', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit', hour12:true }); } catch { return dt || ''; } };

  return (
    <div className="aa-wrapper">
      <div className="aa-header">
        {/* <button type="button" className="aa-back-btn btn-back" onClick={() => router.back()} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button> */}
        <button
          type="button"
          className="aa-back-btn btn-back"
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            background: "#0066ff", // Background color of the button (blue)
            border: "none", // Remove the border for a clean look
            borderRadius: "50%", // Circular button
            padding: "10px", // Adds padding around the icon for better spacing
            cursor: "pointer", // Pointer cursor when hovered over the button
            display: "flex", // Flexbox for centering the icon
            justifyContent: "center", // Center the icon horizontally
            alignItems: "center", // Center the icon vertically
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white" // White color for the icon
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="aa-header-text"><h1>Audio Action</h1><p>Schedule your audio playback</p></div>
        <div className="aa-header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
      </div>
      {showSuccess && <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:'#10b981', color:'#fff', padding:'10px 20px', borderRadius:10, fontSize:14, fontWeight:600, zIndex:1000 }}>{successMsg}</div>}
      <div className="aa-card">
        <form onSubmit={handleSubmit} className="aa-form">
          <div className="aa-field">
            <label className="aa-label">Audio Name</label>
            <div className="aa-input-wrap">
              <input type="text" className={`aa-input ${errors.name?'aa-input-error':''}`} value={audioName} onChange={e=>setAudioName(e.target.value)} placeholder="Enter audio name"/>
            </div>
            {errors.name && <span style={{color:'#ef4444',fontSize:12}}>{errors.name}</span>}
          </div>
          <div className="aa-row">
            <div className="aa-field">
              <label className="aa-label">Play Date</label>
              <div className="aa-input-wrap"><input type="date" className={`aa-input ${errors.date?'aa-input-error':''}`} value={playDate} onChange={e=>setPlayDate(e.target.value)}/></div>
              {errors.date && <span style={{color:'#ef4444',fontSize:12}}>{errors.date}</span>}
            </div>
            <div className="aa-field">
              <label className="aa-label">Play Time</label>
              <div className="aa-input-wrap"><input type="time" className={`aa-input ${errors.time?'aa-input-error':''}`} value={playTime} onChange={e=>setPlayTime(e.target.value)}/></div>
              {errors.time && <span style={{color:'#ef4444',fontSize:12}}>{errors.time}</span>}
            </div>
          </div>
          <div className="aa-field">
            <label className="aa-label">Repeat</label>
            <div className="aa-toggle-group">
              <button type="button" className={`aa-toggle-btn ${repeatTime?'active':''}`} onClick={()=>setRepeatTime(true)}>On</button>
              <button type="button" className={`aa-toggle-btn ${!repeatTime?'active':''}`} onClick={()=>setRepeatTime(false)}>Off</button>
            </div>
          </div>
          <div className="aa-field">
            <label className="aa-label">Upload Audio</label>
            <div className={`aa-upload-zone ${isDragging?'dragging':''} ${audioContent?'has-file':''}`}
              onDrop={e=>{e.preventDefault();setIsDragging(false);const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('audio/'))setAudioContent(f);}}
              onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)}
              onClick={()=>fileInputRef.current.click()}>
              <input ref={fileInputRef} type="file" accept="audio/*" onChange={e=>{if(e.target.files[0])setAudioContent(e.target.files[0]);}} style={{display:'none'}}/>
              {audioContent?(
                <div className="aa-file-info">
                  <div className="aa-file-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                  <div><p className="aa-file-name">{audioContent.name}</p><p className="aa-file-size">{(audioContent.size/1024).toFixed(1)} KB</p></div>
                  <button type="button" className="aa-file-remove btn-delete" onClick={e=>{e.stopPropagation();setAudioContent(null);}} aria-label="Remove">×</button>
                </div>
              ):(
                <div className="aa-upload-placeholder">
                  <p className="aa-upload-text">Drop audio file or <span>browse</span></p>
                  <p className="aa-upload-hint">MP3, WAV, AAC</p>
                </div>
              )}
            </div>
          </div>
          <button type="submit" className="aa-submit-btn" disabled={loading}>{loading?'Saving…':'Set Audio Action'}</button>
        </form>
      </div>
      {actions.length > 0 && (
        <div style={{padding:'0 16px 24px'}}>
          <h3 style={{fontSize:16,fontWeight:600,color:'#334155',margin:'0 0 12px'}}>Saved Actions ({actions.length})</h3>
          {actions.map(a=>(
            <div key={a.audio_action_id} style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,boxShadow:'0 1px 3px rgba(0,0,0,0.08)',border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:8,background:'#faf5ff',color:'#a855f7',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>♪</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontWeight:600,fontSize:14,color:'#1e293b'}}>{a.audio_name}</p>
                <p style={{margin:'2px 0 0',fontSize:12,color:'#64748b'}}>{fmtDt(a.play_datetime)} · {a.repeat_type||'None'}</p>
              </div>
              <button onClick={()=>handleDelete(a.audio_action_id)} className="btn-delete" style={{width:30,height:30,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default function ProtectedAudioAction() { return <ProtectedRoute><AudioAction /></ProtectedRoute>; }
