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
  XCircle,
  Trash2,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  Network,
  X,
  ListOrdered
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
  const [cancelling, setCancelling] = useState(false);
  
  // Executive summary & graph state
  const [docSummary, setDocSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // Fetch all documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // When activeDoc changes, fetch its detailed executive summary
  useEffect(() => {
    if (activeDoc && activeDoc.status === 'processed') {
      fetchDocDetails(activeDoc.id);
    } else {
      setDocSummary(null);
    }
  }, [activeDoc?.id, activeDoc?.status]);

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

  const fetchDocDetails = async (docId) => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDocSummary({
          summary: data.summary,
          keyTakeaways: data.key_takeaways || []
        });
      }
    } catch (err) {
      console.error('Error fetching document details:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchConceptGraph = async (docId) => {
    setLoadingGraph(true);
    setShowGraphModal(true);
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}/graph`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch concept graph');
      setGraphData(data.graph);
    } catch (err) {
      alert(`Concept graph error: ${err.message}`);
      setShowGraphModal(false);
    } finally {
      setLoadingGraph(false);
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
              <h3>Document Library</h3>
              <p className="card-subtitle">
                {documents.length} document{documents.length === 1 ? '' : 's'} &bull; Select up to 5 for multi-doc synthesis
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
          <div className="doc-status-empty" style={{ padding: '1.5rem 1rem' }}>
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
                      title={isSelected ? "Deselect for multi-doc chat" : "Select for multi-doc chat"}
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

      {/* Active Document Insights & Concept Graph Card */}
      {activeDoc && (
        <div className="glass-card active-insights-card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Database className="header-icon" size={18} />
              <div>
                <h3 className="truncate" style={{ maxWidth: '200px' }}>{activeDoc.filename}</h3>
                <p className="card-subtitle">Active Document Insights</p>
              </div>
            </div>

            {activeDoc.status === 'processed' && (
              <button 
                type="button" 
                className="btn btn-secondary btn-xs"
                onClick={() => fetchConceptGraph(activeDoc.id)}
                title="View Concept Knowledge Flow"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Network size={14} className="text-accent" />
                <span>Concept Graph</span>
              </button>
            )}
          </div>

          {activeDoc.status === 'processing' && (
            <div className="processing-warning">
              <RefreshCw className="spin icon-xs" />
              <span>Extracting tables, semantic chunks, and vector embeddings...</span>
            </div>
          )}

          {activeDoc.status === 'failed' && (
            <div className="processing-warning" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}>
              <AlertTriangle className="icon-xs" />
              <span>Extraction failed. Please try a different PDF or re-upload.</span>
            </div>
          )}

          {activeDoc.status === 'processed' && docSummary && (
            <div className="executive-summary-block">
              {docSummary.summary && (
                <div className="summary-paragraph">
                  <div className="summary-header">
                    <Sparkles size={14} className="text-accent" />
                    <strong>Executive Summary</strong>
                  </div>
                  <p>{docSummary.summary}</p>
                </div>
              )}

              {docSummary.keyTakeaways && docSummary.keyTakeaways.length > 0 && (
                <div className="takeaways-list">
                  <div className="summary-header">
                    <ListOrdered size={14} className="text-accent" />
                    <strong>Key Takeaways</strong>
                  </div>
                  <ul>
                    {docSummary.keyTakeaways.map((point, idx) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Concept Graph Modal */}
      {showGraphModal && (
        <div className="citation-modal-overlay" onClick={() => setShowGraphModal(false)}>
          <div className="citation-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="citation-modal-header">
              <div className="citation-modal-title">
                <Network className="text-accent" size={20} />
                <span>Concept Knowledge Graph &bull; {activeDoc?.filename}</span>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                onClick={() => setShowGraphModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="citation-modal-body">
              {loadingGraph ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <RefreshCw className="spin icon-sm text-accent" />
                  <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>Synthesizing knowledge graph entities and links...</p>
                </div>
              ) : graphData && graphData.nodes && graphData.nodes.length > 0 ? (
                <div>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#ddd6fe' }}>Key Extracted Entities & Concepts:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {graphData.nodes.map((node, i) => (
                      <span 
                        key={i} 
                        className="citation-chip" 
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                      >
                        <strong>{node.id}</strong> ({node.group || 'Concept'})
                      </span>
                    ))}
                  </div>

                  {graphData.links && graphData.links.length > 0 && (
                    <div>
                      <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#ddd6fe' }}>Conceptual Relationships:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {graphData.links.map((link, j) => (
                          <div key={j} className="citation-snippet-card" style={{ padding: '0.6rem 0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                              <span style={{ color: '#a78bfa', fontWeight: 600 }}>{link.source}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>──[{link.relationship || 'relates to'}]──▶</span>
                              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{link.target}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>No concept entities found for this document.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
