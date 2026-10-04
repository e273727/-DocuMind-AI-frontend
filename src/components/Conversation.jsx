import React, { useEffect, useRef } from 'react';
import { 
  Sparkles, 
  FileKey, 
  Compass, 
  HelpCircle, 
  Layers, 
  MessageSquareCode,
  FileText,
  User,
  Bot
} from 'lucide-react';

/**
 * Lightweight & secure Markdown / formatting parser for RAG chat responses.
 */
function MarkdownRenderer({ content, onCitationClick, sources }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let tableRows = [];
  let listItems = [];
  let keyIndex = 0;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const bodyRows = tableRows.slice(1);

      elements.push(
        <div key={`table-${keyIndex++}`} className="markdown-table-wrapper">
          <table className="markdown-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{parseInlineText(h, onCitationClick, sources)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{parseInlineText(cell, onCitationClick, sources)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${keyIndex++}`} className="markdown-list">
          {listItems.map((item, idx) => (
            <li key={idx}>{parseInlineText(item, onCitationClick, sources)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table line
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      if (/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(trimmed)) {
        continue;
      }
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    // List line
    if (/^[-*•]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*•]\s+/, ''));
      continue;
    } else {
      flushList();
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      elements.push(<h4 key={`h4-${keyIndex++}`} className="markdown-h4">{parseInlineText(trimmed.slice(5), onCitationClick, sources)}</h4>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={`h3-${keyIndex++}`} className="markdown-h3">{parseInlineText(trimmed.slice(4), onCitationClick, sources)}</h3>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={`h2-${keyIndex++}`} className="markdown-h2">{parseInlineText(trimmed.slice(3), onCitationClick, sources)}</h2>);
    } else if (trimmed.length === 0) {
      continue;
    } else {
      elements.push(
        <p key={`p-${keyIndex++}`} className="markdown-p">
          {parseInlineText(trimmed, onCitationClick, sources)}
        </p>
      );
    }
  }

  flushTable();
  flushList();

  return <div className="chat-markdown-body">{elements}</div>;
}

/**
 * Parses bold, inline code, and clickable [Page X] citation tags.
 */
function parseInlineText(text, onCitationClick, sources) {
  if (!text) return "";

  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[Page\s+\d+(?:[^\]]*)\])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="inline-code">{token.slice(1, -1)}</code>);
    } else if (/^\[Page\s+(\d+)/i.test(token)) {
      const pageNumMatch = token.match(/\[Page\s+(\d+)/i);
      const pageNum = pageNumMatch ? parseInt(pageNumMatch[1], 10) : null;
      parts.push(
        <button
          key={match.index}
          type="button"
          className="citation-inline-pill"
          onClick={() => onCitationClick && pageNum && onCitationClick(pageNum, sources)}
          title={`Inspect source evidence on Page ${pageNum}`}
        >
          <FileKey size={10} />
          <span>{token.replace(/^\[|\]$/g, '')}</span>
        </button>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export default function Conversation({
  history = [],
  loading,
  activeDoc,
  selectedDocs = [],
  onCitationClick,
  onQuickPrompt,
  onSendQuery
}) {
  const messagesEndRef = useRef(null);
  const readyDocs = selectedDocs.filter(d => d.status === 'processed');
  const chatEnabled = readyDocs.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  return (
    <div className="conversation-scroll-area">
      <div className="conversation-thread">
        {history.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-icon-box">
              <Sparkles size={24} className="welcome-sparkle" />
            </div>
            
            <h2 className="welcome-heading">
              How can I assist your document research?
            </h2>
            
            <p className="welcome-description">
              {readyDocs.length > 1
                ? `Ready to cross-query across ${readyDocs.length} selected documents with grounded citations.`
                : activeDoc && activeDoc.status === 'processed'
                  ? `Ready to answer questions, extract tables, and summarize "${activeDoc.filename}".`
                  : 'Select or upload a PDF document from the sidebar to begin intelligent QA.'}
            </p>

            {chatEnabled && (
              <div className="quick-prompts-row">
                <button 
                  type="button" 
                  className="quick-prompt-card"
                  onClick={() => onQuickPrompt("What are the key findings and executive summary of this document?")}
                >
                  <Sparkles size={14} className="prompt-icon" />
                  <div className="prompt-text">
                    <span className="prompt-title">Executive Summary</span>
                    <span className="prompt-sub">Synthesize core findings and goals</span>
                  </div>
                </button>

                <button 
                  type="button" 
                  className="quick-prompt-card"
                  onClick={() => onQuickPrompt("Extract all key figures, metrics, and quantitative data into a summary table.")}
                >
                  <Compass size={14} className="prompt-icon" />
                  <div className="prompt-text">
                    <span className="prompt-title">Metrics & Tables</span>
                    <span className="prompt-sub">Pull structured tabular data</span>
                  </div>
                </button>

                <button 
                  type="button" 
                  className="quick-prompt-card"
                  onClick={() => onQuickPrompt("What is the core methodology, scope, or technical approach described?")}
                >
                  <HelpCircle size={14} className="prompt-icon" />
                  <div className="prompt-text">
                    <span className="prompt-title">Technical Scope</span>
                    <span className="prompt-sub">Understand architecture & methods</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        ) : (
          history.map((msg) => (
            <div key={msg.id} className={`message-row ${msg.sender === 'user' ? 'message-user' : 'message-ai'}`}>
              {msg.sender === 'user' ? (
                <div className="user-message-bubble">
                  <div className="user-message-text">{msg.question}</div>
                </div>
              ) : (
                <div className="ai-message-content">
                  <div className="ai-author-header">
                    <div className="ai-avatar-badge">
                      <Bot size={13} />
                    </div>
                    <span className="ai-author-label">DocuMind AI</span>
                  </div>

                  <MarkdownRenderer 
                    content={msg.answer} 
                    onCitationClick={onCitationClick}
                    sources={msg.sources}
                  />

                  {/* Sources Citation Bar */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources-bar">
                      <span className="sources-label">Sources:</span>
                      <div className="sources-pills-list">
                        {[...new Set(msg.sources.map(s => s.page_number))]
                          .sort((a, b) => a - b)
                          .map((pageNum) => (
                            <button 
                              key={pageNum}
                              type="button"
                              className="source-evidence-pill"
                              onClick={() => onCitationClick(pageNum, msg.sources)}
                              title={`Inspect context from Page ${pageNum}`}
                            >
                              <FileKey size={11} />
                              <span>Page {pageNum}</span>
                            </button>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  {/* Follow-up Question Chips */}
                  {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                    <div className="message-followups-bar">
                      <div className="followups-title">
                        <Sparkles size={11} className="text-accent" />
                        <span>Suggested follow-ups</span>
                      </div>
                      <div className="followups-list">
                        {msg.followUpQuestions.map((fQ, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="followup-chip"
                            onClick={() => onSendQuery(fQ)}
                            disabled={loading}
                          >
                            {fQ}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="message-row message-ai">
            <div className="ai-message-content">
              <div className="ai-author-header">
                <div className="ai-avatar-badge">
                  <Bot size={13} />
                </div>
                <span className="ai-author-label">DocuMind AI is thinking...</span>
              </div>
              <div className="typing-indicator-wave">
                <span className="wave-dot"></span>
                <span className="wave-dot"></span>
                <span className="wave-dot"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>
    </div>
  );
}
