import React from 'react';
import { 
  Menu, 
  MessageSquare, 
  Network, 
  Sparkles, 
  Layers, 
  FileText,
  Trash2,
  Columns
} from 'lucide-react';

export default function WorkspaceHeader({
  activeDoc,
  selectedDocs = [],
  activeView, // 'chat' | 'graph'
  onViewChange,
  isPdfSplitOpen,
  onTogglePdfSplit,
  isInsightsOpen,
  onToggleInsights,
  onToggleMobileSidebar,
  onClearChat,
  hasChatHistory
}) {
  const readyDocs = selectedDocs.filter(d => d.status === 'processed');
  const isMultiDoc = readyDocs.length > 1;

  return (
    <header className="workspace-header">
      {/* Left: Mobile hamburger & Document Info */}
      <div className="header-left">
        <button 
          type="button" 
          className="btn-mobile-menu" 
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        <div className="header-doc-meta">
          <div className="header-doc-title-row">
            {isMultiDoc ? (
              <>
                <Layers size={15} className="text-accent" />
                <span className="header-doc-title">
                  {readyDocs.length} Documents Selected
                </span>
              </>
            ) : activeDoc ? (
              <>
                <FileText size={15} className="text-accent" />
                <span className="header-doc-title truncate" title={activeDoc.filename}>
                  {activeDoc.filename}
                </span>
              </>
            ) : (
              <span className="header-doc-title text-muted">
                No Document Selected
              </span>
            )}
          </div>

          <div className="header-doc-sub">
            {isMultiDoc ? (
              <span>Cross-document intelligence active ({readyDocs.map(d => d.filename).join(', ')})</span>
            ) : activeDoc ? (
              <span>
                {activeDoc.status === 'processed' ? 'Ready for queries' : activeDoc.status === 'processing' ? 'Processing...' : 'Failed'}
                {activeDoc.page_count ? ` · ${activeDoc.page_count} pages` : ''}
              </span>
            ) : (
              <span>Upload or select a PDF to begin</span>
            )}
          </div>
        </div>
      </div>

      {/* Center: View Switcher (Chat vs Concept Graph) */}
      <div className="header-center">
        <div className="view-switcher">
          <button 
            type="button" 
            className={`view-tab ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => onViewChange('chat')}
          >
            <MessageSquare size={14} />
            <span>Chat</span>
          </button>
          <button 
            type="button" 
            className={`view-tab ${activeView === 'graph' ? 'active' : ''}`}
            onClick={() => onViewChange('graph')}
            disabled={!activeDoc || activeDoc.status !== 'processed'}
            title={(!activeDoc || activeDoc.status !== 'processed') ? 'Process a document to view concept graph' : 'View concept knowledge graph'}
          >
            <Network size={14} />
            <span>Concept Graph</span>
          </button>
        </div>
      </div>

      {/* Right: Actions (Clear Chat & Insights Drawer Button) */}
      <div className="header-right">
        {activeView === 'chat' && hasChatHistory && (
          <button 
            type="button" 
            className="btn-header-ghost" 
            onClick={onClearChat}
            title="Clear chat messages"
          >
            <Trash2 size={14} />
            <span className="hide-mobile">Clear</span>
          </button>
        )}

        {activeView === 'chat' && activeDoc && (
          <button 
            type="button" 
            className={`btn-header-ghost ${isPdfSplitOpen ? 'active' : ''}`}
            onClick={onTogglePdfSplit}
            title={isPdfSplitOpen ? "Hide PDF side-by-side view" : "View PDF side-by-side with chat"}
          >
            <Columns size={14} />
            <span className="hide-mobile">{isPdfSplitOpen ? "Hide PDF" : "Split PDF"}</span>
          </button>
        )}

        <button 
          type="button" 
          className={`btn-insights-toggle ${isInsightsOpen ? 'open' : ''}`}
          onClick={onToggleInsights}
          title={isInsightsOpen ? 'Close document insights' : 'Open document insights'}
        >
          <Sparkles size={14} />
          <span>Insights</span>
        </button>
      </div>
    </header>
  );
}
