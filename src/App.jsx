import React, { useState } from 'react';
import { BrainCircuit, User, LogOut } from 'lucide-react';
import './App.css';
import Auth from './components/Auth';
import DocumentDashboard from './components/DocumentDashboard';
import Chat from './components/Chat';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [activeDoc, setActiveDoc] = useState(JSON.parse(localStorage.getItem('activeDoc')) || null);
  const [selectedDocs, setSelectedDocs] = useState(
    JSON.parse(localStorage.getItem('selectedDocs')) || (activeDoc ? [activeDoc] : [])
  );

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
  };

  const handleCancelCleanup = () => {
    localStorage.removeItem('activeDoc');
    localStorage.removeItem('selectedDocs');
    setActiveDoc(null);
    setSelectedDocs([]);
  };

  return (
    <>
      {/* Background Glows */}
      <div className="glow-bg glow-1"></div>
      <div className="glow-bg glow-2"></div>

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="logo">
            <BrainCircuit className="logo-icon" />
            <h1>DocuMind <span className="accent-text">AI</span></h1>
          </div>
          {token && user && (
            <div className="header-user">
              <span className="user-badge">
                <User size={14} />
                <span>{user.email}</span>
              </span>
              <button 
                type="button" 
                className="btn btn-icon-only" 
                title="Log Out"
                onClick={handleLogout}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="app-main">
          {!token ? (
            <Auth onAuthSuccess={handleAuthSuccess} />
          ) : (
            <section id="section-dashboard" className="dashboard-section">
              <div className="dashboard-grid">
                <DocumentDashboard 
                  token={token} 
                  activeDoc={activeDoc} 
                  setActiveDoc={setActiveDoc}
                  selectedDocs={selectedDocs}
                  onSelectDoc={handleSelectDoc}
                  onToggleSelectDoc={handleToggleSelectDoc}
                  onCancelCleanup={handleCancelCleanup}
                />
                <Chat 
                  token={token} 
                  activeDoc={activeDoc} 
                  selectedDocs={selectedDocs}
                />
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <p>© 2026 DocuMind AI. Grounded QA powered by NVIDIA NIM & pgvector.</p>
        </footer>
      </div>
    </>
  );
}
