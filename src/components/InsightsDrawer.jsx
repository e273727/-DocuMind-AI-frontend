import React from 'react';
import { 
  X, 
  Sparkles, 
  ListOrdered, 
  Network, 
  RefreshCw, 
  AlertTriangle, 
  FileText,
  Calendar,
  Layers
} from 'lucide-react';

export default function InsightsDrawer({
  isOpen,
  onClose,
  activeDoc,
  docSummary,
  loadingSummary,
  onOpenGraph
}) {
  return (
    <>
      {/* Backdrop for mobile / tablet screens */}
      {isOpen && (
        <div 
          className="drawer-backdrop" 
          onClick={onClose} 
          aria-hidden="true" 
        />
      )}

      <aside className={`insights-drawer ${isOpen ? 'drawer-open' : ''}`}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="drawer-title-row">
              <Sparkles size={16} className="text-accent" />
              <h3>Document Insights</h3>
            </div>
            <p className="drawer-subtitle truncate" title={activeDoc?.filename || 'No document'}>
              {activeDoc ? activeDoc.filename : 'Select a document to inspect insights'}
            </p>
          </div>
          <button 
            type="button" 
            className="btn-icon-close" 
            onClick={onClose}
            aria-label="Close insights drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="drawer-content">
          {!activeDoc ? (
            <div className="drawer-empty-state">
              <FileText size={32} className="empty-icon text-muted" />
              <h4>No Document Selected</h4>
              <p>Select or upload a PDF document from the sidebar to inspect its synthesized executive summary and takeaways.</p>
            </div>
          ) : activeDoc.status === 'processing' ? (
            <div className="drawer-empty-state">
              <RefreshCw size={24} className="spin text-accent" />
              <h4>Analyzing Document</h4>
              <p>DocuMind is reading pages, generating chunks, and computing vector embeddings...</p>
            </div>
          ) : activeDoc.status === 'failed' ? (
            <div className="drawer-empty-state">
              <AlertTriangle size={24} className="text-error" />
              <h4>Ingestion Error</h4>
              <p>This document could not be processed. Please try re-uploading.</p>
            </div>
          ) : loadingSummary ? (
            <div className="drawer-loading-state">
              <RefreshCw size={20} className="spin text-accent" />
              <p>Loading document insights...</p>
            </div>
          ) : (
            <div className="drawer-sections-wrapper">
              {/* Document Overview Metadata */}
              <div className="drawer-meta-card">
                <div className="meta-item">
                  <FileText size={13} className="text-secondary" />
                  <span>{activeDoc.page_count ? `${activeDoc.page_count} pages` : 'PDF Document'}</span>
                </div>
                {activeDoc.created_at && (
                  <div className="meta-item">
                    <Calendar size={13} className="text-secondary" />
                    <span>{new Date(activeDoc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
                <div className="meta-item">
                  <span className="doc-status-indicator ready" />
                  <span style={{ color: 'var(--success-color)' }}>Ready for QA</span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="drawer-section">
                <div className="drawer-section-heading">
                  <Sparkles size={14} className="text-accent" />
                  <span>Executive Summary</span>
                </div>
                {docSummary?.summary ? (
                  <p className="drawer-summary-paragraph">
                    {docSummary.summary}
                  </p>
                ) : (
                  <p className="drawer-empty-text">No summary generated yet.</p>
                )}
              </div>

              {/* Key Takeaways */}
              {docSummary?.keyTakeaways && docSummary.keyTakeaways.length > 0 && (
                <div className="drawer-section">
                  <div className="drawer-section-heading">
                    <ListOrdered size={14} className="text-accent" />
                    <span>Key Takeaways</span>
                  </div>
                  <ul className="drawer-takeaways-list">
                    {docSummary.keyTakeaways.map((takeaway, idx) => (
                      <li key={idx}>
                        <span className="takeaway-bullet">{idx + 1}</span>
                        <span className="takeaway-text">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concept Graph Shortcut */}
              <div className="drawer-section">
                <button
                  type="button"
                  className="btn-drawer-graph"
                  onClick={() => {
                    onOpenGraph();
                    onClose();
                  }}
                >
                  <Network size={16} className="text-accent" />
                  <div>
                    <span className="btn-graph-title">Explore Concept Graph</span>
                    <span className="btn-graph-sub">View extracted entities & conceptual flow</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
