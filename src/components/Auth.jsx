import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, UserPlus } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function Auth({ onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  
  // Form fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  
  // Notifications
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const switchTab = (tab) => {
    setMessage('');
    setActiveTab(tab);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Invalid credentials');

      // Clear fields
      setLoginEmail('');
      setLoginPassword('');
      
      // Notify parent
      onAuthSuccess(data.token, data.user);
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: registerName, email: registerEmail, password: registerPassword })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Registration failed');

      // Clear fields
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      
      setIsError(false);
      setMessage('Account created successfully! Logging you in...');
      
      setTimeout(() => {
        onAuthSuccess(data.token, data.user);
      }, 1500);
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="section-auth" class="auth-section">
      <div className="glass-card auth-card">
        <div className="auth-tabs">
          <button 
            type="button"
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Log In
          </button>
          <button 
            type="button"
            className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Sign Up
          </button>
        </div>
        
        <div className="auth-forms">
          {activeTab === 'login' ? (
            <form id="form-login" className="auth-form active-form" onSubmit={handleLogin}>
              <h2>Welcome Back</h2>
              <p className="subtitle">Access your document intelligence suite</p>
              
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" />
                  <input 
                    type="email" 
                    id="login-email" 
                    required 
                    placeholder="name@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input 
                    type="password" 
                    id="login-password" 
                    required 
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                <span>{loading ? 'Logging in...' : 'Log In'}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <form id="form-register" className="auth-form active-form" onSubmit={handleRegister}>
              <h2>Create Account</h2>
              <p className="subtitle">Get started with AI-powered document search</p>
              
              <div className="form-group">
                <label htmlFor="register-name">Full Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" />
                  <input 
                    type="text" 
                    id="register-name" 
                    required 
                    placeholder="John Doe"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="register-email">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" />
                  <input 
                    type="email" 
                    id="register-email" 
                    required 
                    placeholder="name@example.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="register-password">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input 
                    type="password" 
                    id="register-password" 
                    required 
                    placeholder="At least 6 characters"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                <span>{loading ? 'Creating Account...' : 'Sign Up'}</span>
                <UserPlus size={18} />
              </button>
            </form>
          )}
        </div>
        
        {message && (
          <div className={`auth-message-box ${isError ? 'error' : 'success'}`}>
            {message}
          </div>
        )}
      </div>
    </section>
  );
}
