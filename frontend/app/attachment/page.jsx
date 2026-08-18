"use client";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from 'react';
import "./Attachment.css";
import { attachmentsApi } from "../../api/endpoints";
import ProtectedRoute from "../../components/ProtectedRoute";

const FILE_COLORS = { pdf:'#ef4444', docx:'#3b82f6', xlsx:'#22c55e', txt:'#8b5cf6' };

function Attachment() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [actionType, setActionType] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState('');
  const fileInputRef = useRef();

  useEffect(() => {
    attachmentsApi.list().then(d => setAttachments(d || [])).catch(console.error);
  }, []);

  const getExt = (name) => name?.split('.').pop().toLowerCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !actionType) return;
    setIsProcessing(true);
    setFileContent('');
    setErrors('');
    try {
      const created = await attachmentsApi.create({
        file_name: file.name,
        file_type: getExt(file.name),
        file_size: file.size,
        action_type: actionType,
      });
      setAttachments(prev => [created, ...prev]);
      setFileContent(
        actionType === 'calculate'
          ? `Calculation complete for "${file.name}".\n\n• File registered with ID: ${created.attachment_id}\n• Type: ${getExt(file.name)?.toUpperCase()}\n• Size: ${(file.size/1024).toFixed(1)} KB\n• Status: Ready for processing`
          : `Extraction complete for "${file.name}".\n\n• File registered with ID: ${created.attachment_id}\n• Type: ${getExt(file.name)?.toUpperCase()}\n• Size: ${(file.size/1024).toFixed(1)} KB\n• Status: Ready for extraction`
      );
    } catch (err) {
      setErrors(err.message || 'Failed to process attachment');
      setFileContent('');
    } finally {
      setIsProcessing(false);
    }
  };

  const ext = file ? getExt(file.name) : null;
  const fileColor = ext ? (FILE_COLORS[ext] || '#5b6ef5') : '#5b6ef5';

  return (
    <div className="at-wrapper">
      <div className="at-header">
        {/* <button type="button" className="at-back-btn btn-back" onClick={() => router.back()} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button> */}
        <button
          type="button"
          className="at-back-btn btn-back"
          onClick={() => router.back()}
          aria-label="Back"
          style={{
            background: "#0066ff", // Background color (blue for back button)
            border: "none", // No border for cleaner look
            borderRadius: "50%", // Circular button
            padding: "10px", // Adds padding inside the button around the icon
            cursor: "pointer", // Pointer cursor on hover to indicate clickability
            display: "flex", // Use flexbox to center the icon
            justifyContent: "center", // Center the icon horizontally
            alignItems: "center", // Center the icon vertically
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white" // White color for the arrow
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="at-header-text"><h1>Attachment</h1><p>Upload &amp; process your files</p></div>
        <div className="at-header-icon">📎</div>
      </div>
      <div className="at-card">
        <form onSubmit={handleSubmit} className="at-form">
          <div className="at-field">
            <label className="at-label">Select File</label>
            <div className={`at-upload-zone ${isDragging?'dragging':''} ${file?'has-file':''}`}
              onDrop={e=>{e.preventDefault();setIsDragging(false);if(e.dataTransfer.files[0])setFile(e.dataTransfer.files[0]);}}
              onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)}
              onClick={()=>!file&&fileInputRef.current.click()}>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.txt" onChange={e=>setFile(e.target.files[0])} style={{display:'none'}}/>
              {file?(
                <div className="at-file-info">
                  <div className="at-file-icon" style={{background:`${fileColor}18`,color:fileColor}}>📄</div>
                  <div className="at-file-meta">
                    <p className="at-file-name">{file.name}</p>
                    <p className="at-file-size">{(file.size/1024).toFixed(1)} KB · <span style={{color:fileColor,fontWeight:700}}>.{ext?.toUpperCase()}</span></p>
                  </div>
                  <button type="button" className="at-file-remove btn-delete" onClick={e=>{e.stopPropagation();setFile(null);setFileContent('');}} aria-label="Remove">✕</button>
                </div>
              ):(
                <div className="at-upload-placeholder">
                  <p className="at-upload-text">Drop a file or <span onClick={()=>fileInputRef.current.click()}>browse</span></p>
                  <div className="at-badge-row">{['PDF','DOCX','XLSX','TXT'].map(t=><span key={t} className="at-badge">{t}</span>)}</div>
                </div>
              )}
            </div>
          </div>
          <div className="at-field">
            <label className="at-label">Action Type</label>
            <div className="at-action-group">
              {[{value:'calculate',label:'Data Calculation',desc:'Run numerical analysis'},{value:'extract',label:'Extract Data',desc:'Pull structured content'}].map(opt=>(
                <button key={opt.value} type="button" className={`at-action-card ${actionType===opt.value?'active':''}`} onClick={()=>setActionType(opt.value)}>
                  <div><p className="at-action-label">{opt.label}</p><p className="at-action-desc">{opt.desc}</p></div>
                  {actionType===opt.value&&<span className="at-action-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
          {(fileContent||isProcessing||errors)&&(
            <div className="at-field">
              <label className="at-label">Result</label>
              <div className="at-result-box">
                {isProcessing?(<div className="at-processing"><div className="at-spinner"/><span>Processing file…</span></div>)
                :errors?(<pre className="at-result-text" style={{color:'#ef4444'}}>{errors}</pre>)
                :(<pre className="at-result-text">{fileContent}</pre>)}
              </div>
            </div>
          )}
          <button type="submit" className={`at-submit-btn ${(!file||!actionType)?'disabled':''}`} disabled={!file||!actionType||isProcessing}>
            {isProcessing?'Processing…':'Confirm & Process'}
          </button>
        </form>
      </div>
      {attachments.length>0&&(
        <div style={{padding:'0 16px 24px'}}>
          <h3 style={{fontSize:16,fontWeight:600,color:'#334155',margin:'0 0 12px'}}>Previous Attachments ({attachments.length})</h3>
          {attachments.map(a=>(
            <div key={a.attachment_id} style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,boxShadow:'0 1px 3px rgba(0,0,0,0.08)',border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:8,background:'#ecfeff',color:'#06b6d4',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>📎</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontWeight:600,fontSize:14,color:'#1e293b'}}>{a.file_name||'Attachment'}</p>
                <p style={{margin:'2px 0 0',fontSize:12,color:'#64748b'}}>{a.file_type?.toUpperCase()||'FILE'} · {a.action_type||''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default function ProtectedAttachment() { return <ProtectedRoute><Attachment /></ProtectedRoute>; }