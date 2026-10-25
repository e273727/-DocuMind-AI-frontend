import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ExternalLink, 
  Download, 
  X, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { API_BASE } from '../config/api';
import { authFetch } from '../utils/auth';

export default function PdfViewer({ 
  doc, 
  token, 
  targetPage, 
  onClose,
  selectedDocs = [],
  onSelectDoc,
  isExpanded = false,
  onToggleExpand
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(targetPage || 1);
  const [pageInput, setPageInput] = useState(String(targetPage || 1));
  const [zoom, setZoom] = useState(100);
  const currentBlobRef = useRef(null);
  const iframeRef = useRef(null);

  const totalPages = doc?.page_count || 1;

  // Sync when targetPage changes (e.g. user clicked a citation in chat)
  useEffect(() => {
    if (targetPage && targetPage > 0) {
      setCurrentPage(targetPage);
      setPageInput(String(targetPage));
    }
  }, [targetPage]);

  // Fetch PDF blob when active document changes
  const loadPdf = async () => {
    if (!doc?.id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch(`${API_BASE}/documents/${doc.id}/pdf`, {}, token);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load PDF (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Clean up previous blob URL
      if (currentBlobRef.current) {
        URL.revokeObjectURL(currentBlobRef.current);
      }

      currentBlobRef.current = url;
      setBlobUrl(url);
    } catch (err) {
      console.error('Error fetching document PDF:', err);
      setError(err.message || 'Unable to load PDF file');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPdf();

    return () => {
      if (currentBlobRef.current) {
        URL.revokeObjectURL(currentBlobRef.current);
        currentBlobRef.current = null;
      }
    };
  }, [doc?.id]);

  // Navigation handlers
  const handlePageChange = (newPage) => {
    const pageNum = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(pageNum);
    setPageInput(String(pageNum));
  };

  const handlePageInputSubmit = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(pageInput, 10);
      if (!isNaN(val)) {
        handlePageChange(val);
      } else {
        setPageInput(String(currentPage));
      }
    }
  };

  const handlePageInputBlur = () => {
    const val = parseInt(pageInput, 10);
    if (!isNaN(val)) {
      handlePageChange(val);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleZoom = (delta) => {
    setZoom(prev => Math.min(200, Math.max(50, prev + delta)));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleDownload = () => {
    if (!blobUrl || !doc) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = doc.filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenExternal = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // URL hash for standard browser PDF viewer
  const iframeSrc = blobUrl ? `${blobUrl}#page=${currentPage}&zoom=${zoom}` : '';

  return (
    <div className="pdf-viewer-container">
      {/* Sleek Top Toolbar */}
      <div className="pdf-viewer-toolbar">
        {/* Left: Document info */}
        <div className="pdf-toolbar-left">
          <FileText size={16} className="text-accent flex-shrink-0" />
          <span className="pdf-filename truncate" title={doc?.filename}>
            {doc?.filename || 'Document Preview'}
          </span>
          <span className="pdf-page-badge">
            {totalPages} {totalPages === 1 ? 'page' : 'pages'}
          </span>
        </div>

        {/* Center: Pagination navigation */}
        <div className="pdf-toolbar-center">
          <button
            type="button"
            className="btn-pdf-tool"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            title="Previous Page"
            aria-label="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="pdf-page-counter">
            <span className="pdf-page-label">Page</span>
            <input
              type="text"
              className="pdf-page-input"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={handlePageInputSubmit}
              onBlur={handlePageInputBlur}
              disabled={loading}
              aria-label="Current Page"
            />
            <span className="pdf-page-total">of {totalPages}</span>
          </div>

          <button
            type="button"
            className="btn-pdf-tool"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            title="Next Page"
            aria-label="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Right: Zoom, Download, External, Close */}
        <div className="pdf-toolbar-right">
          <div className="pdf-zoom-group">
            <button
              type="button"
              className="btn-pdf-tool"
              onClick={() => handleZoom(-15)}
              disabled={zoom <= 50 || loading}
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="pdf-zoom-label" title="Current Zoom">{zoom}%</span>
            <button
              type="button"
              className="btn-pdf-tool"
              onClick={() => handleZoom(15)}
              disabled={zoom >= 200 || loading}
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              className="btn-pdf-tool"
              onClick={handleResetZoom}
              title="Reset Zoom to 100%"
              aria-label="Reset Zoom"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <div className="pdf-toolbar-divider" />

          <button
            type="button"
            className="btn-pdf-tool"
            onClick={handleDownload}
            disabled={!blobUrl || loading}
            title="Download PDF"
            aria-label="Download PDF"
          >
            <Download size={15} />
          </button>

          <button
            type="button"
            className="btn-pdf-tool"
            onClick={handleOpenExternal}
            disabled={!blobUrl || loading}
            title="Open in new window"
            aria-label="Open in new window"
          >
            <ExternalLink size={15} />
          </button>

          {onToggleExpand && (
            <button
              type="button"
              className={`btn-pdf-tool ${isExpanded ? 'active' : ''}`}
              onClick={onToggleExpand}
              title={isExpanded ? "Restore PDF width (50/50)" : "Expand PDF width (75%)"}
              aria-label="Toggle Expand PDF"
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className="btn-pdf-tool btn-pdf-close"
              onClick={onClose}
              title="Close PDF side-by-side view"
              aria-label="Close PDF View"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Multi-Document Tabs (when multiple documents are selected) */}
      {selectedDocs && selectedDocs.length > 1 && (
        <div className="pdf-doc-tabs">
          <span className="pdf-tabs-label">Viewing:</span>
          <div className="pdf-tabs-scroll">
            {selectedDocs.map(d => (
              <button
                key={d.id}
                type="button"
                className={`pdf-doc-tab ${d.id === doc?.id ? 'active' : ''}`}
                onClick={() => onSelectDoc && onSelectDoc(d)}
                title={d.filename}
              >
                <FileText size={12} className="flex-shrink-0" />
                <span className="truncate">{d.filename}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main View Area */}
      <div className="pdf-content-area">
        {loading && (
          <div className="pdf-state-card">
            <Loader2 size={32} className="spin text-accent" />
            <p className="pdf-state-title">Loading PDF document...</p>
            <span className="pdf-state-sub">Rendering vector pages & citations</span>
          </div>
        )}

        {error && !loading && (
          <div className="pdf-state-card pdf-state-error">
            <AlertCircle size={32} className="text-error" />
            <p className="pdf-state-title">Failed to display PDF</p>
            <span className="pdf-state-sub">{error}</span>
            <button
              type="button"
              className="btn-pdf-retry"
              onClick={loadPdf}
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!loading && !error && blobUrl && (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title={`PDF Viewer - ${doc?.filename || 'Document'}`}
            className="pdf-iframe"
          />
        )}
      </div>
    </div>
  );
}
