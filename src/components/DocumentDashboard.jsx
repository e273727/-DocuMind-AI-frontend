import React, { useState, useEffect, useRef } from 'react';
import { 
  FileUp, 
  CloudLightning, 
  Database, 
  FileQuestion, 
  FileText, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  Info, 
  XCircle 
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function DocumentDashboard({ token, activeDoc, setActiveDoc, onCancelCleanup }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // Status Polling Effect
  useEffect(() => {
    if (activeDoc && activeDoc.status === 'processing') {
      startStatusPolling(activeDoc.id);
    } else {
      clearInterval(pollingRef.current);
    }

    return () => clearInterval(pollingRef.current);
  }, [activeDoc?.id, activeDoc?.status]);

  const startStatusPolling = (docId) => {
    clearInterval(pollingRef.current);
    
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/documents/${docId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const doc = await res.json();
        
        if (!res.ok) throw new Error(doc.error || 'Failed to poll status');

        // Update active document state
        setActiveDoc(doc);
        localStorage.setItem('activeDoc', JSON.stringify(doc));
        
        if (doc.status === 'processed') {
          clearInterval(pollingRef.current);
        } else if (doc.status === 'failed') {
          clearInterval(pollingRef.current);
          alert('Document vector embedding extraction failed. Please try a different PDF.');
        }
      } catch (err) {
        console.error('Error polling document status:', err);
        clearInterval(pollingRef.current);
      }
    }, 3000);
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const uploadFile = (file) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }

    setUploading(true);
    setProgress(20);
    setProgressText('Uploading PDF...');

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/documents/upload`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 80) + 10;
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 202) {
        const response = JSON.parse(xhr.responseText);
        const doc = response.document;
        
        setProgress(100);
        setProgressText('Upload complete!');
        
        setTimeout(() => {
          setUploading(false);
          setActiveDoc(doc);
          localStorage.setItem('activeDoc', JSON.stringify(doc));
        }, 800);
      } else {
        const errorMsg = JSON.parse(xhr.responseText).error || 'Upload failed';
        alert(`Error: ${errorMsg}`);
        setUploading(false);
      }
    };

    xhr.onerror = () => {
      alert('Network error occurred during upload.');
      setUploading(false);
    };

    xhr.send(formData);
  };

  const handleCancelProcessing = async () => {
    if (!activeDoc) return;
    
    const confirmCancel = confirm("Are you sure you want to cancel the processing of this document? This will remove all data.");
    if (!confirmCancel) return;
    
    setCancelling(true);
    
    try {
      const res = await fetch(`${API_BASE}/documents/${activeDoc.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel document');
      
      clearInterval(pollingRef.current);
      onCancelCleanup();
      alert('Document processing cancelled.');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  const renderStatusBadge = (status) => {
    if (status === 'processing') {
      return (
        <span className="badge badge-pending">
          <RefreshCw className="spin icon-xs" />
          <span>Processing</span>
        </span>
      );
    } else if (status === 'processed') {
      return (
        <span className="badge badge-processed">
          <Check className="icon-xs" />
          <span>Ready</span>
        </span>
      );
    } else {
      return (
        <span className="badge badge-failed">
          <AlertTriangle className="icon-xs" />
          <span>Failed</span>
        </span>
      );
    }
  };

  return (
    <div className="left-panel">
      {/* Upload Card */}
      <div className="glass-card upload-card">
        <div className="card-header">
          <FileUp className="header-icon text-accent" />
          <div>
            <h3>Ingest Document</h3>
            <p className="card-subtitle">Upload a PDF to parse and embed</p>
          </div>
        </div>
        
        <div 
          className={`uploader-container ${isDragOver ? 'dragover' : ''}`}
          onClick={triggerFileSelect}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".pdf" 
            className="hidden-file-input"
            onChange={handleFileChange}
          />
          <div className="uploader-prompt">
            <CloudLightning className="upload-cloud-icon" />
            <p className="primary-text">Drag & drop your PDF here</p>
            <p className="secondary-text">or click to browse files</p>
          </div>
        </div>

        {/* Uploading Progress */}
        {uploading && (
          <div id="upload-progress-box" className="progress-box">
            <div className="progress-info">
              <span>{progressText}</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Active Document Status Card */}
      <div className="glass-card doc-status-card">
        <div className="card-header">
          <Database className="header-icon" />
          <h3>Active Intelligence Source</h3>
        </div>
        
        {!activeDoc ? (
          <div className="doc-status-empty">
            <FileQuestion className="empty-icon" />
            <p>No document active. Upload a PDF above to begin.</p>
          </div>
        ) : (
          <div className="doc-status-active">
            <div className="doc-meta-info">
              <div className="doc-icon-wrapper">
                <FileText className="text-accent" />
              </div>
              <div className="doc-details">
                <h4 className="truncate">{activeDoc.filename}</h4>
                <p className="doc-id-label">ID: {activeDoc.id}</p>
              </div>
            </div>
            
            <div className="status-indicator-row">
              <span className="indicator-label">Ingestion Status:</span>
              <div className="status-actions">
                {renderStatusBadge(activeDoc.status)}
                
                {(activeDoc.status === 'processing' || activeDoc.status === 'failed') && (
                  <button 
                    type="button"
                    className="btn btn-danger btn-xs"
                    onClick={handleCancelProcessing}
                    disabled={cancelling}
                    title="Cancel processing and delete document"
                  >
                    {cancelling ? (
                      <RefreshCw className="spin icon-xs" />
                    ) : (
                      <XCircle className="icon-xs" />
                    )}
                    <span>{cancelling ? 'Cancelling...' : 'Cancel'}</span>
                  </button>
                )}
              </div>
            </div>

            {activeDoc.status === 'processing' && (
              <div className="processing-warning">
                <Info className="icon-sm" style={{ flexShrink: 0 }} />
                <span>Document is being chunked & vectorized. Chat will unlock automatically once done.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
