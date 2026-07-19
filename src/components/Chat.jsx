import React, { useState, useEffect, useRef } from 'react';
import { MessagesSquare, Trash2, MessageSquareCode, Send, FileKey } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function Chat({ token, activeDoc }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Load chat history when active document changes
  useEffect(() => {
    if (activeDoc && activeDoc.status === 'processed') {
      loadChatHistory(activeDoc.id);
    } else {
      setHistory([]);
    }
  }, [activeDoc?.id, activeDoc?.status]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [history, loading]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadChatHistory = async (docId) => {
    try {
      const res = await fetch(`${API_BASE}/chat/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load chat history');
      setHistory(data);
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    const query = question.trim();
    if (!query || !activeDoc || activeDoc.status !== 'processed') return;

    // Reset input
    setQuestion('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '3rem';
    }

    // Add user message to UI
    const newUserMsg = { id: `user-${Date.now()}`, question: query, sender: 'user' };
    setHistory(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentId: activeDoc.id,
          question: query
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to generate answer');

      // Add AI response to UI
      const newAiMsg = { 
        id: data.chatId || `ai-${Date.now()}`, 
        question: query, // kept for history match
        answer: data.answer, 
        sources: data.sources,
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

  const clearChatView = () => {
    setHistory([]);
  };

  const handleTextareaInput = (e) => {
    const el = e.target;
    el.style.height = '3rem';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleCitationClick = (pageNum, sources) => {
    const pageSnippets = sources
      .filter(s => s.page_number === pageNum)
      .map((s, idx) => `[Source ${idx + 1} - Similarity: ${(s.score * 100).toFixed(1)}%]:\n${s.content}`)
      .join('\n\n');
      
    alert(`Page ${pageNum} Reference Context:\n\n${pageSnippets}`);
  };

  const chatEnabled = activeDoc && activeDoc.status === 'processed';

  return (
    <div className="right-panel">
      <div className="glass-card chat-card">
        <div className="chat-header">
          <div className="chat-title-info">
            <MessagesSquare className="header-icon text-accent" />
            <div>
              <h3>Semantic Intelligence Chat</h3>
              <p className="chat-status-desc">
                {chatEnabled ? `Querying "${activeDoc.filename}"` : 'Connect a document to start querying'}
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

        {/* Chat Area */}
        <div className="chat-messages">
          {history.length === 0 ? (
            <div className="welcome-chat-msg">
              <MessageSquareCode className="welcome-icon" />
              <h4>Interactive Grounded Querying</h4>
              <p>Once your document is indexed into the vector database, you can ask natural language questions. The AI will locate relevant context chunks and cite its source page numbers directly.</p>
            </div>
          ) : (
            history.map((msg) => (
              <React.Fragment key={msg.id}>
                {/* User Message Bubble */}
                {msg.sender === 'user' ? (
                  <div className="chat-bubble user">
                    <div className="chat-bubble-content">{msg.question}</div>
                    <span className="chat-bubble-sender">You</span>
                  </div>
                ) : (
                  /* AI Message Bubble */
                  <div className="chat-bubble ai">
                    <div className="chat-bubble-content">{msg.answer}</div>
                    
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="citations-box">
                        {[...new Set(msg.sources.map(s => s.page_number))]
                          .sort((a, b) => a - b)
                          .map((pageNum) => (
                            <div 
                              key={pageNum}
                              className="citation-chip"
                              onClick={() => handleCitationClick(pageNum, msg.sources)}
                              title={msg.sources
                                .filter(s => s.page_number === pageNum)
                                .map((s, idx) => `[Source ${idx + 1} - Similarity: ${(s.score * 100).toFixed(1)}%]:\n${s.content.substring(0, 150)}...`)
                                .join('\n\n')
                              }
                            >
                              <FileKey size={12} />
                              <span>Page {pageNum}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
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

        {/* Chat Input Form */}
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
          ></textarea>
          <button 
            type="submit" 
            className="btn btn-primary btn-square" 
            disabled={!chatEnabled || !question.trim() || loading} 
            title="Send Query"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
