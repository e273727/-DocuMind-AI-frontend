import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import WorkspaceHeader from './components/WorkspaceHeader';
import Conversation from './components/Conversation';
import Composer from './components/Composer';
import InsightsDrawer from './components/InsightsDrawer';
import ConceptGraphWorkspace from './components/ConceptGraphWorkspace';
import CitationModal from './components/CitationModal';
import { UploadCloud } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  
  // Documents state
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [activeDoc, setActiveDoc] = useState(JSON.parse(localStorage.getItem('activeDoc')) || null);
  const [selectedDocs, setSelectedDocs] = useState(
    JSON.parse(localStorage.getItem('selectedDocs')) || (activeDoc ? [activeDoc] : [])
  );

  // View state
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'graph'
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null);

  // Chat state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Insights state
  const [docSummary, setDocSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

  const pollingRef = useRef(null);

  // Fetch documents on initial auth
  useEffect(() => {
    if (token) {
      fetchDocuments();
    }
  }, [token]);

  // Global polling for processing documents
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing') || (activeDoc && activeDoc.status === 'processing');
    if (hasProcessing && token) {
      startGlobalPolling();
    } else {
      clearInterval(pollingRef.current);
    }
    return () => clearInterval(pollingRef.current);
  }, [documents, activeDoc?.status, token]);

  // Load chat history when selected/active documents change
  const readyDocs = selectedDocs.filter(d => d.status === 'processed');
  const docKey = readyDocs.map(d => d.id).sort((a, b) => a - b).join(',');

  useEffect(() => {
    if (token && readyDocs.length > 0 && docKey) {
      loadChatHistory(docKey);
    } else {
      setChatHistory([]);
    }
  }, [docKey, token]);

  // Load active document insights when activeDoc changes
  useEffect(() => {
    if (token && activeDoc && activeDoc.status === 'processed') {
      fetchDocInsights(activeDoc.id);
    } else {
      setDocSummary(null);
    }
  }, [activeDoc?.id, activeDoc?.status, token]);

  // Document Fetching
  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');

      setDocuments(data);

      // Auto-select latest ready document if none currently active
      if (!activeDoc && data.length > 0) {
        const firstReady = data.find(d => d.status === 'processed') || data[0];
        handleSelectDoc(firstReady);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoadingDocs(false);
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

  // Selection handlers
  const handleSelectDoc = (doc) => {
    setActiveDoc(doc);
    setSelectedDocs([doc]);
    localStorage.setItem('activeDoc', JSON.stringify(doc));
    localStorage.setItem('selectedDocs', JSON.stringify([doc]));
  };

  const handleToggleSelectDoc = (doc) => {
    setSelectedDocs(prev => {
      const exists = prev.some(d => d.id === doc.id);
      let updated;
      if (exists) {
        updated = prev.filter(d => d.id !== doc.id);
      } else {
        if (prev.length >= 5) {
          alert("You can select up to 5 documents simultaneously for cross-document query.");
          return prev;
        }
        updated = [...prev, doc];
      }

      if (updated.length > 0) {
        setActiveDoc(updated[0]);
        localStorage.setItem('activeDoc', JSON.stringify(updated[0]));
      } else {
        setActiveDoc(null);
        localStorage.removeItem('activeDoc');
      }
      localStorage.setItem('selectedDocs', JSON.stringify(updated));
      return updated;
    });
  };

  // Upload handler
  const handleUploadFile = (file) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a valid PDF file.');
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    setUploadProgressText('Uploading PDF...');

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/documents/upload`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 80) + 10;
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 202) {
        const response = JSON.parse(xhr.responseText);
        const doc = response.document;

        setUploadProgress(100);
        setUploadProgressText('Upload complete!');

        setTimeout(() => {
          setUploading(false);
          handleSelectDoc(doc);
          fetchDocuments();
        }, 600);
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

  // Delete handler
  const handleDeleteDoc = async (docId) => {
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
        localStorage.removeItem('activeDoc');
        localStorage.removeItem('selectedDocs');
        setActiveDoc(null);
        setSelectedDocs([]);
      }
      fetchDocuments();
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Chat logic
  const loadChatHistory = async (docIdsStr) => {
    try {
      const res = await fetch(`${API_BASE}/chat/${docIdsStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load chat history');
      setChatHistory(data);
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  };

  const handleSendQuery = async (queryText = chatInput) => {
    const query = queryText.trim();
    if (!query || readyDocs.length === 0 || loadingChat) return;

    setChatInput('');
    const userMsg = { id: `user-${Date.now()}`, question: query, sender: 'user' };
    setChatHistory(prev => [...prev, userMsg]);
    setLoadingChat(true);

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

      const aiMsg = {
        id: data.chatId || `ai-${Date.now()}`,
        question: query,
        answer: data.answer,
        sources: data.sources || [],
        followUpQuestions: data.followUpQuestions || [],
        sender: 'ai'
      };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (err) {
      const errorAiMsg = {
        id: `err-${Date.now()}`,
        answer: `Sorry, an error occurred while processing your request: ${err.message}`,
        sender: 'ai'
      };
      setChatHistory(prev => [...prev, errorAiMsg]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Insights logic
  const fetchDocInsights = async (docId) => {
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
      console.error('Error fetching document insights:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Auth handlers
  const handleAuthSuccess = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeDoc');
    localStorage.removeItem('selectedDocs');
    setToken(null);
    setUser(null);
    setActiveDoc(null);
    setSelectedDocs([]);
    setChatHistory([]);
  };

  // Citation click handler
  const handleCitationClick = (pageNum, sources) => {
    const matched = (sources || []).filter(s => s.page_number === pageNum);
    setSelectedCitation({
      pageNum,
      sources: matched.length > 0 ? matched : sources
    });
  };

  // Drag and drop overlay handlers for whole window
  const handleWindowDragOver = (e) => {
    e.preventDefault();
    if (!isWindowDragOver) setIsWindowDragOver(true);
  };

  const handleWindowDragLeave = (e) => {
    e.preventDefault();
    // Only turn off if leaving window bounds
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      setIsWindowDragOver(false);
    }
  };

  const handleWindowDrop = (e) => {
    e.preventDefault();
    setIsWindowDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  if (!token) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div 
      className="app-shell"
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
    >
      {/* Global Drag and Drop Dropzone Overlay */}
      {isWindowDragOver && (
        <div className="global-dropzone-overlay">
          <div className="global-dropzone-card">
            <UploadCloud size={48} className="text-accent spin-slow" />
            <h3>Drop PDF Here</h3>
            <p>Upload and extract semantic embeddings with DocuMind AI</p>
          </div>
        </div>
      )}

      {/* Left Application Sidebar */}
      <Sidebar
        user={user}
        documents={documents}
        loadingDocs={loadingDocs}
        activeDoc={activeDoc}
        selectedDocs={selectedDocs}
        onSelectDoc={handleSelectDoc}
        onToggleSelectDoc={handleToggleSelectDoc}
        onDeleteDoc={handleDeleteDoc}
        onRefreshDocs={fetchDocuments}
        onUploadFile={handleUploadFile}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadProgressText={uploadProgressText}
        onLogout={handleLogout}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="workspace-main">
        {/* Workspace Top Header */}
        <WorkspaceHeader
          activeDoc={activeDoc}
          selectedDocs={selectedDocs}
          activeView={activeView}
          onViewChange={setActiveView}
          isInsightsOpen={isInsightsOpen}
          onToggleInsights={() => setIsInsightsOpen(prev => !prev)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          onClearChat={() => setChatHistory([])}
          hasChatHistory={chatHistory.length > 0}
        />

        {/* View Content: Chat or Concept Graph */}
        {activeView === 'graph' ? (
          <ConceptGraphWorkspace
            token={token}
            activeDoc={activeDoc}
            onSwitchToChat={() => setActiveView('chat')}
            onAskAboutRelationship={(query) => {
              setActiveView('chat');
              handleSendQuery(query);
            }}
            onCitationClick={handleCitationClick}
          />
        ) : (
          <div className="chat-workspace-wrapper">
            {/* Independently scrolling conversation stream */}
            <Conversation
              history={chatHistory}
              loading={loadingChat}
              activeDoc={activeDoc}
              selectedDocs={selectedDocs}
              onCitationClick={handleCitationClick}
              onQuickPrompt={handleSendQuery}
              onSendQuery={handleSendQuery}
            />

            {/* Structurally fixed composer at bottom */}
            <Composer
              value={chatInput}
              onChange={setChatInput}
              onSend={() => handleSendQuery()}
              disabled={readyDocs.length === 0}
              loading={loadingChat}
              placeholder={
                readyDocs.length > 1
                  ? `Ask anything across ${readyDocs.length} selected documents...`
                  : activeDoc && activeDoc.status === 'processed'
                    ? `Ask anything about "${activeDoc.filename}"...`
                    : "Select or upload a PDF to begin querying..."
              }
              onAttachClick={() => {
                const fileInput = document.querySelector('.hidden-file-input');
                if (fileInput) fileInput.click();
              }}
            />
          </div>
        )}

        {/* Slide-out Insights Drawer */}
        <InsightsDrawer
          isOpen={isInsightsOpen}
          onClose={() => setIsInsightsOpen(false)}
          activeDoc={activeDoc}
          docSummary={docSummary}
          loadingSummary={loadingSummary}
          onOpenGraph={() => setActiveView('graph')}
        />
      </div>

      {/* Citation Modal for inspecting exact source chunk */}
      <CitationModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}
