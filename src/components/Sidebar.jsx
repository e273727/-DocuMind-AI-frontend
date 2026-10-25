import React, { useState, useRef } from 'react';
import { 
  BrainCircuit, 
  Plus, 
  Search, 
  FileText, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  Trash2, 
  CheckSquare, 
  Square, 
  LogOut, 
  User, 
  X,
  Layers
} from 'lucide-react';

export default function Sidebar({
  user,
  documents = [],
  loadingDocs,
  activeDoc,
  selectedDocs = [],
  onSelectDoc,
  onToggleSelectDoc,
  onDeleteDoc,
  onRefreshDocs,
  onUploadFile,
  uploading,
  uploadProgress,
  uploadProgressText,
  onLogout,
  isMobileOpen,
  onCloseMobile
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTriggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFile(e.target.files[0]);
      e.target.value = ''; // reset so same file can be re-selected if needed
    }
  };

  const renderStatus = (status) => {
    if (status === 'processing') {
      return (
        <span className="doc-status-indicator processing" title="Processing embeddings & summary">
          <RefreshCw size={11} className="spin" />
        </span>
      );
    }
    if (status === 'processed') {
      return (
        <span className="doc-status-indicator ready" title="Ready for AI query">
          <Check size={11} />
        </span>
      );
    }
    return (
      <span className="doc-status-indicator failed" title="Ingestion failed">
        <AlertTriangle size={11} />
      </span>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={onCloseMobile} 
          aria-hidden="true" 
        />
      )}

      <aside className={`app-sidebar ${isMobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Sidebar Header / Logo */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon-wrapper">
              <BrainCircuit className="sidebar-brand-icon" size={20} />
            </div>
            <div className="sidebar-brand-text">
              <span className="brand-name">DocuMind</span>
              <span className="brand-badge">AI</span>
            </div>
          </div>
          {isMobileOpen && (
            <button 
              type="button" 
              className="btn-icon-close mobile-close-btn" 
              onClick={onCloseMobile}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* New Document / Upload Action */}
        <div className="sidebar-actions">
          <button 
            type="button" 
            className="btn-new-doc" 
            onClick={handleTriggerUpload}
            disabled={uploading}
          >
            <Plus size={16} />
            <span>Upload document</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".pdf" 
            className="hidden-file-input" 
            onChange={handleFileChange}
          />
        </div>

        {/* Upload Progress Indicator */}
        {uploading && (
          <div className="sidebar-upload-progress">
            <div className="upload-progress-info">
              <span className="progress-text">{uploadProgressText || 'Uploading...'}</span>
              <span className="progress-percent">{uploadProgress}%</span>
            </div>
            <div className="progress-track">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Document Search */}
        <div className="sidebar-search">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search documents..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              type="button" 
              className="search-clear-btn" 
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Documents Section Header */}
        <div className="sidebar-section-header">
          <span className="section-title">
            Documents ({documents.length})
          </span>
          <button 
            type="button" 
            className="btn-refresh-docs" 
            onClick={onRefreshDocs} 
            disabled={loadingDocs}
            title="Refresh documents"
          >
            <RefreshCw size={12} className={loadingDocs ? 'spin' : ''} />
          </button>
        </div>

        {/* Multi-Document Selection Banner (if >1 selected) */}
        {selectedDocs.length > 1 && (
          <div className="multi-doc-active-banner">
            <Layers size={13} />
            <span>{selectedDocs.length} docs selected for cross-query</span>
          </div>
        )}

        {/* Document List */}
        <div className="sidebar-doc-list">
          {documents.length === 0 ? (
            <div className="sidebar-empty-state">
              <FileText size={28} className="empty-icon" />
              <p className="empty-title">No documents yet</p>
              <p className="empty-desc">Upload a PDF to begin conversational QA and extraction.</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="sidebar-empty-state">
              <p className="empty-desc">No documents match "{searchQuery}"</p>
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isActive = activeDoc && activeDoc.id === doc.id;
              const isSelected = selectedDocs.some(d => d.id === doc.id);

              return (
                <div 
                  key={doc.id}
                  className={`doc-row ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectDoc(doc);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  title={doc.filename}
                >
                  {/* Multi-doc checkbox */}
                  <button 
                    type="button"
                    className="doc-checkbox-btn"
                    title={isSelected ? "Remove from cross-doc query" : "Include in cross-doc query"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelectDoc(doc);
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare size={14} className="checkbox-active" />
                    ) : (
                      <Square size={14} className="checkbox-inactive" />
                    )}
                  </button>

                  <FileText size={15} className={`doc-icon ${isActive ? 'active' : ''}`} />

                  <div className="doc-info">
                    <span className="doc-name truncate">{doc.filename}</span>
                    <span className="doc-meta">
                      {doc.status === 'processed' ? 'Ready' : doc.status === 'processing' ? 'Processing...' : 'Failed'}
                    </span>
                  </div>

                  <div className="doc-trailing">
                    {renderStatus(doc.status)}
                    <button 
                      type="button"
                      className="doc-delete-btn"
                      title="Delete document"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDoc(doc.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer / User Account */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.email ? user.email.charAt(0).toUpperCase() : <User size={14} />}
            </div>
            <div className="user-info">
              <span className="user-name truncate">{user?.name || user?.email?.split('@')[0] || 'User'}</span>
              <span className="user-email truncate">{user?.email || 'Logged in'}</span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-logout" 
            title="Log out" 
            onClick={onLogout}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
