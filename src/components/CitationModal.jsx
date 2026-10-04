import React from 'react';
import { FileText, X } from 'lucide-react';

export default function CitationModal({ citation, onClose }) {
  if (!citation) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container citation-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileText className="text-accent" size={18} />
            <span>Page {citation.pageNum} Source Evidence</span>
          </div>
          <button 
            type="button" 
            className="btn-icon-close" 
            onClick={onClose}
            aria-label="Close citation modal"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="modal-body">
          {citation.sources && citation.sources.length > 0 ? (
            citation.sources.map((src, idx) => (
              <div key={idx} className="citation-evidence-item">
                <div className="citation-evidence-meta">
                  <span className="section-tag">
                    <strong>Section:</strong> {src.heading || 'General Content'}
                  </span>
                  {src.score && (
                    <span className="relevance-tag">
                      Match: {(src.score * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="citation-evidence-text">
                  {src.content}
                </div>
              </div>
            ))
          ) : (
            <p className="text-secondary text-sm">
              Source passage from Page {citation.pageNum} used in this response.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
