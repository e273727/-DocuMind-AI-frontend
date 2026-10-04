import React, { useState, useEffect } from 'react';
import { 
  Database, 
  FileText, 
  Sparkles, 
  ListOrdered, 
  Network, 
  X, 
  RefreshCw, 
  AlertTriangle,
  FileQuestion,
  Layers,
  BookOpen
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function DocumentInsights({ token, activeDoc }) {
  const [docSummary, setDocSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [loadingGraph, setLoadingGraph] = useState(false);

  useEffect(() => {
    if (activeDoc && activeDoc.status === 'processed') {
      fetchDocDetails(activeDoc.id);
    } else {
      setDocSummary(null);
    }
  }, [activeDoc?.id, activeDoc?.status]);

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
      alert(`Concept graph notice: ${err.message}`);
      setShowGraphModal(false);
    } finally {
      setLoadingGraph(false);
    }
  };

  return (
    <div className="insights-panel">
      <div className="glass-card insights-card">
        {/* Card Header */}
        <div className="card-header insights-card-header">
          <div className="insights-header-left">
            <BookOpen className="header-icon text-accent" size={18} />
            <div>
              <h3>Active Insights</h3>
              <p className="card-subtitle truncate" style={{ maxWidth: '170px' }}>
                {activeDoc ? activeDoc.filename : 'No active document'}
              </p>
            </div>
          </div>

          {activeDoc && activeDoc.status === 'processed' && (
            <button 
              type="button" 
              className="btn btn-secondary btn-xs btn-graph"
              onClick={() => fetchConceptGraph(activeDoc.id)}
              title="Explore Concept Knowledge Flow"
            >
              <Network size={14} className="text-accent" />
              <span>Concept Graph</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="insights-body">
          {!activeDoc ? (
            <div className="insights-empty-state">
              <FileQuestion className="empty-icon" size={36} />
              <h4>No Document Selected</h4>
              <p>Select or upload a PDF from the Document Hub to inspect its AI summary and key takeaways.</p>
            </div>
          ) : activeDoc.status === 'processing' ? (
            <div className="insights-processing-state">
              <RefreshCw className="spin icon-sm text-accent" />
              <h4>Synthesizing Document</h4>
              <p>Extracting tables, semantic chunks, and generating executive summary...</p>
            </div>
          ) : activeDoc.status === 'failed' ? (
            <div className="insights-error-state">
              <AlertTriangle className="icon-sm" style={{ color: 'var(--error-color)' }} />
              <h4>Ingestion Incomplete</h4>
              <p>This document encountered an extraction error. Please try re-uploading.</p>
            </div>
          ) : loadingSummary ? (
            <div className="insights-loading-state">
              <RefreshCw className="spin icon-sm text-accent" />
              <p>Loading document insights...</p>
            </div>
          ) : (
            <div className="insights-scroll-content">
              {/* Executive Summary */}
              {docSummary?.summary ? (
                <div className="insights-section-box">
                  <div className="insights-section-title">
                    <Sparkles size={14} className="text-accent" />
                    <span>Executive Summary</span>
                  </div>
                  <p className="insights-summary-text">{docSummary.summary}</p>
                </div>
              ) : (
                <div className="insights-section-box muted">
                  <p>No executive summary generated yet for this document.</p>
                </div>
              )}

              {/* Key Takeaways */}
              {docSummary?.keyTakeaways && docSummary.keyTakeaways.length > 0 && (
                <div className="insights-section-box">
                  <div className="insights-section-title">
                    <ListOrdered size={14} className="text-accent" />
                    <span>Key Takeaways</span>
                  </div>
                  <ul className="insights-takeaways-list">
                    {docSummary.keyTakeaways.map((takeaway, idx) => (
                      <li key={idx}>{takeaway}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
                <div style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <RefreshCw className="spin icon-sm text-accent" />
                  <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
                    Synthesizing knowledge graph entities and links...
                  </p>
                </div>
              ) : graphData && graphData.nodes && graphData.nodes.length > 0 ? (
                <div>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#ddd6fe' }}>
                    Key Extracted Entities & Concepts:
                  </h4>
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
                      <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#ddd6fe' }}>
                        Conceptual Relationships:
                      </h4>
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
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>
                  No concept entities found for this document.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
