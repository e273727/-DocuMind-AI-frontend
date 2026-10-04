import React, { useState, useEffect, useRef } from 'react';
import { 
  FileUp, 
  CloudLightning, 
  FileQuestion, 
  FileText, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  Trash2,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function DocumentDashboard({ 
  token, 
  activeDoc, 
  setActiveDoc, 
  selectedDocs = [], 
  onSelectDoc, 
  onToggleSelectDoc,
  onCancelCleanup 
}) {
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // Fetch all documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Polling for processing documents
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing') || (activeDoc && activeDoc.status === 'processing');
    if (hasProcessing) {
      startGlobalPolling();
    } else {
      clearInterval(pollingRef.current);
    }

    return () => clearInterval(pollingRef.current);
  }, [documents, activeDoc?.status]);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');
      
      setDocuments(data);
      
      // Auto-select latest processed document if none active
      if (!activeDoc && data.length > 0) {
        const firstReady = data.find(d => d.status === 'processed') || data[0];
        if (onSelectDoc) {
          onSelectDoc(firstReady);
        }
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const startGlobalPolling = () => {
    clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/documents`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const updatedList = await res.json();
        if (res.ok) {
          setDocuments(updatedList);
          
          if (activeDoc) {
            const updatedActive = updatedList.find(d => d.id === activeDoc.id);
            if (updatedActive && updatedActive.status !== activeDoc.status) {
              setActiveDoc(updatedActive);
              localStorage.setItem('activeDoc', JSON.stringify(updatedActive));
            }
          }

          const stillProcessing = updatedList.some(d => d.status === 'processing');
          if (!stillProcessing) {
            clearInterval(pollingRef.current);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
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
          if (onSelectDoc) {
            onSelectDoc(doc);
          } else {
            setActiveDoc(doc);
            localStorage.setItem('activeDoc', JSON.stringify(doc));
          }
          fetchDocuments();
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

  const handleDeleteDocument = async (e, docId) => {
    e.stopPropagation();
    const confirmDel = confirm('Are you sure you want to permanently delete this document and its embeddings?');
    if (!confirmDel) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      if (activeDoc && activeDoc.id === docId) {
        onCancelCleanup();
      }
      fetchDocuments();
    } catch (err) {
      alert(`Delete error: ${err.message}`);
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
            <p className="card-subtitle">Upload a PDF to parse, embed, and analyze</p>
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

      {/* Document Library Card */}
      <div className="glass-card doc-library-card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers className="header-icon text-accent" size={18} />
            <div>
              <h3>Document Hub</h3>
              <p className="card-subtitle">
                {documents.length} document{documents.length === 1 ? '' : 's'} &bull; Pick up to 5
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-ghost btn-xs" 
            onClick={fetchDocuments}
            disabled={loadingDocs}
            title="Refresh documents list"
          >
            <RefreshCw size={14} className={loadingDocs ? 'spin' : ''} />
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="doc-status-empty" style={{ padding: '2rem 1rem' }}>
            <FileQuestion className="empty-icon" />
            <p>No documents found. Upload a PDF above to begin.</p>
          </div>
        ) : (
          <div className="doc-list-container">
            {documents.map((doc) => {
              const isSelected = selectedDocs.some(d => d.id === doc.id);
              const isActive = activeDoc && activeDoc.id === doc.id;

              return (
                <div 
                  key={doc.id} 
                  className={`doc-item-row ${isActive ? 'active-row' : ''} ${isSelected ? 'selected-row' : ''}`}
                  onClick={() => onSelectDoc ? onSelectDoc(doc) : setActiveDoc(doc)}
                >
                  <div className="doc-item-left">
                    <button
                      type="button"
                      className="btn-select-checkbox"
                      title={isSelected ? "Deselect from query" : "Select for multi-doc query"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleSelectDoc) onToggleSelectDoc(doc);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="text-accent" />
                      ) : (
                        <Square size={16} className="text-muted" />
                      )}
                    </button>
                    <FileText size={18} className={isActive ? 'text-accent' : 'text-muted'} />
                    <div className="doc-item-text">
                      <span className="doc-name truncate" title={doc.filename}>{doc.filename}</span>
                      <span className="doc-date">
                        {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="doc-item-actions">
                    {renderStatusBadge(doc.status)}
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-del"
                      title="Delete document"
                      onClick={(e) => handleDeleteDocument(e, doc.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
