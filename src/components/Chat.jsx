import React, { useState, useEffect, useRef } from 'react';
import { 
  MessagesSquare, 
  Trash2, 
  MessageSquareCode, 
  Send, 
  FileKey, 
  Sparkles, 
  X, 
  Compass, 
  HelpCircle,
  FileText
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

/**
 * Lightweight & secure Markdown / formatting parser for RAG chat responses.
 */
function MarkdownRenderer({ content, onCitationClick, sources }) {
  if (!content) return null;

  // Split into lines
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
        <div key={`table-${keyIndex++}`} style={{ overflowX: 'auto', margin: '0.75rem 0' }}>
          <table>
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
        <ul key={`list-${keyIndex++}`}>
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
      // Check if separator line (| --- | --- |)
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
      elements.push(<h4 key={`h4-${keyIndex++}`}>{parseInlineText(trimmed.slice(5), onCitationClick, sources)}</h4>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={`h3-${keyIndex++}`}>{parseInlineText(trimmed.slice(4), onCitationClick, sources)}</h3>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={`h2-${keyIndex++}`}>{parseInlineText(trimmed.slice(3), onCitationClick, sources)}</h2>);
    } else if (trimmed.length === 0) {
      // Empty line
      continue;
    } else {
      // Regular paragraph
      elements.push(
        <p key={`p-${keyIndex++}`}>
          {parseInlineText(trimmed, onCitationClick, sources)}
        </p>
      );
    }
  }

  flushTable();
  flushList();

  return <div className="chat-markdown">{elements}</div>;
}

/**
 * Parses bold, inline code, and clickable [Page X] citation tags.
 */
function parseInlineText(text, onCitationClick, sources) {
  if (!text) return "";

  // Split by bold (**text**) or citation tags ([Page N] / [Page N, Section: ...])
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
      parts.push(<code key={match.index}>{token.slice(1, -1)}</code>);
    } else if (/^\[Page\s+(\d+)/i.test(token)) {
      const pageNumMatch = token.match(/\[Page\s+(\d+)/i);
      const pageNum = pageNumMatch ? parseInt(pageNumMatch[1], 10) : null;
      parts.push(
        <span
          key={match.index}
          className="citation-chip"
          style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', margin: '0 0.2rem', verticalAlign: 'baseline' }}
          onClick={() => onCitationClick && pageNum && onCitationClick(pageNum, sources)}
          title={`Click to inspect Page ${pageNum} context`}
        >
          <FileKey size={10} />
          {token.replace(/^\[|\]$/g, '')}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export default function Chat({ token, activeDoc, selectedDocs = [] }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const effectiveDocs = selectedDocs && selectedDocs.length > 0 
    ? selectedDocs 
    : (activeDoc ? [activeDoc] : []);
  const readyDocs = effectiveDocs.filter(d => d.status === 'processed');
  const chatEnabled = readyDocs.length > 0;

  // Key to identify active document combination
  const docKey = readyDocs.map(d => d.id).sort((a, b) => a - b).join(',');

  // Load chat history when active document selection changes
  useEffect(() => {
    if (chatEnabled && docKey) {
      loadChatHistory(docKey);
    } else {
      setHistory([]);
    }
  }, [docKey, chatEnabled]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [history, loading]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadChatHistory = async (docIdsStr) => {
    try {
      const res = await fetch(`${API_BASE}/chat/${docIdsStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load chat history');
      setHistory(data);
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  };

  const sendQuery = async (queryText) => {
    const query = queryText.trim();
    if (!query || !chatEnabled) return;

    setQuestion('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '3rem';
    }

    const newUserMsg = { id: `user-${Date.now()}`, question: query, sender: 'user' };
    setHistory(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const docIds = readyDocs.map(d => d.id);
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentIds: docIds,
          question: query
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to generate answer');

      const newAiMsg = { 
        id: data.chatId || `ai-${Date.now()}`, 
        question: query,
        answer: data.answer, 
        sources: data.sources || [],
        followUpQuestions: data.followUpQuestions || [],
        sender: 'ai' 
      };
      
      setHistory(prev => [...prev, newAiMsg]);
    } catch (err) {
      const errorMsgMsg = {
        id: `err-${Date.now()}`,
        answer: `Sorry, an error occurred: ${err.message}. Please try again.`,
        sender: 'ai'
      };
      setHistory(prev => [...prev, errorMsgMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    sendQuery(question);
  };

  const handleQuickPrompt = (promptText) => {
    sendQuery(promptText);
  };

  const clearChatView = () => {
    setHistory([]);
  };

  const handleTextareaInput = (e) => {
    const el = e.target;
    el.style.height = '3rem';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleCitationClick = (pageNum, sources) => {
    const matchedSources = (sources || []).filter(s => s.page_number === pageNum);
    setSelectedCitation({
      pageNum,
      sources: matchedSources.length > 0 ? matchedSources : sources
    });
  };

  return (
    <div className="right-panel">
      <div className="glass-card chat-card">
        <div className="chat-header">
          <div className="chat-title-info">
            <MessagesSquare className="header-icon text-accent" />
            <div>
              <h3>Semantic Intelligence Chat</h3>
              <p className="chat-status-desc">
                {readyDocs.length > 1 
                  ? `Multi-Doc Mode: Querying ${readyDocs.length} documents (${readyDocs.map(d => d.filename).join(', ')})`
                  : readyDocs.length === 1 
                    ? `Querying "${readyDocs[0].filename}"` 
                    : 'Connect or select a document to start querying'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="btn btn-ghost btn-sm" 
            title="Clear chat history" 
            disabled={history.length === 0}
            onClick={clearChatView}
          >
            <Trash2 size={16} />
            <span>Clear</span>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="chat-messages">
          {history.length === 0 ? (
            <div className="welcome-chat-msg">
              <MessageSquareCode className="welcome-icon" />
              <h4>Precision Document Intelligence</h4>
              <p>
                Ask detailed questions, extract numerical data, compare tables, or explore key findings. 
                Answers are strictly grounded with direct page citations and conversational context.
              </p>

              {chatEnabled && (
                <div className="quick-prompts-grid">
                  <button 
                    type="button" 
                    className="quick-prompt-btn"
                    onClick={() => handleQuickPrompt("What are the key findings and executive summary of this document?")}
                  >
                    <Sparkles size={14} className="text-accent" />
                    <span>Executive Summary</span>
                  </button>
                  <button 
                    type="button" 
                    className="quick-prompt-btn"
                    onClick={() => handleQuickPrompt("Extract all key figures, metrics, and quantitative data into a summary table.")}
                  >
                    <Compass size={14} className="text-accent" />
                    <span>Key Figures & Tables</span>
                  </button>
                  <button 
                    type="button" 
                    className="quick-prompt-btn"
                    onClick={() => handleQuickPrompt("What is the core methodology, scope, or technical approach described?")}
                  >
                    <HelpCircle size={14} className="text-accent" />
                    <span>Methodology & Scope</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            history.map((msg) => (
              <React.Fragment key={msg.id}>
                {msg.sender === 'user' ? (
                  <div className="chat-bubble user">
                    <div className="chat-bubble-content">{msg.question}</div>
                    <span className="chat-bubble-sender">You</span>
                  </div>
                ) : (
                  <div className="chat-bubble ai">
                    <div className="chat-bubble-content">
                      <MarkdownRenderer 
                        content={msg.answer} 
                        onCitationClick={handleCitationClick}
                        sources={msg.sources}
                      />

                      {/* Source Citation Chips */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="citations-box">
                          <span className="citations-label">Sources:</span>
                          {[...new Set(msg.sources.map(s => s.page_number))]
                            .sort((a, b) => a - b)
                            .map((pageNum) => (
                              <div 
                                key={pageNum}
                                className="citation-chip"
                                onClick={() => handleCitationClick(pageNum, msg.sources)}
                                title="Click to view extracted source context snippet"
                              >
                                <FileKey size={12} />
                                <span>Page {pageNum}</span>
                              </div>
                            ))
                          }
                        </div>
                      )}

                      {/* Follow-up Question Suggestions */}
                      {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                        <div className="follow-ups-container">
                          <div className="follow-ups-header">
                            <Sparkles size={12} className="text-accent" />
                            <span>Suggested follow-ups:</span>
                          </div>
                          <div className="follow-ups-list">
                            {msg.followUpQuestions.map((fQ, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="follow-up-chip"
                                onClick={() => sendQuery(fQ)}
                                disabled={loading}
                              >
                                {fQ}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="chat-bubble-sender">DocuMind AI</span>
                  </div>
                )}
              </React.Fragment>
            ))
          )}

          {/* Typing Indicator */}
          {loading && (
            <div className="typing-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form className="chat-input-bar" onSubmit={handleSendChat}>
          <textarea 
            ref={textareaRef}
            placeholder={chatEnabled ? `Ask a question about "${activeDoc.filename}"...` : "Connect a document to start querying..."} 
            required 
            disabled={!chatEnabled}
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onInput={handleTextareaInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendChat(e);
              }
            }}
          ></textarea>
          <button 
            type="submit" 
            className="btn btn-primary btn-square" 
            disabled={!chatEnabled || !question.trim() || loading} 
            title="Send Query (Enter)"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Citation Preview Modal */}
      {selectedCitation && (
        <div className="citation-modal-overlay" onClick={() => setSelectedCitation(null)}>
          <div className="citation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="citation-modal-header">
              <div className="citation-modal-title">
                <FileText className="text-accent" size={20} />
                <span>Page {selectedCitation.pageNum} Source Evidence</span>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost btn-square" 
                onClick={() => setSelectedCitation(null)}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="citation-modal-body">
              {selectedCitation.sources.map((src, sIdx) => (
                <div key={sIdx} className="citation-snippet-card">
                  <div className="citation-snippet-meta">
                    <span><strong>Section:</strong> {src.heading || 'General Overview'}</span>
                    <span>Relevance: {(src.score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="citation-snippet-text">{src.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
