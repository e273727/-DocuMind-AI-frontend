/**
 * Client-side JWT session validation and automatic expiration management.
 */

/**
 * Safely decodes the payload of a JWT token.
 * @param {string} token - The raw JWT token string.
 * @returns {object|null} - Decoded payload object or null if invalid.
 */
export function parseJwt(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (err) {
    console.warn('Failed to parse JWT token payload:', err);
    return null;
  }
}

/**
 * Checks whether a JWT token is expired or invalid.
 * @param {string} token - The JWT token string.
 * @param {number} [bufferSeconds=5] - Optional grace margin in seconds.
 * @returns {boolean} - True if expired, invalid, or missing; false if valid.
 */
export function isTokenExpired(token, bufferSeconds = 5) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) {
    return true; // No expiration claim or corrupt token -> treat as expired
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime >= payload.exp - bufferSeconds;
}

/**
 * Calculates remaining time in milliseconds until token expiration.
 * @param {string} token 
 * @returns {number} - Remaining milliseconds (0 if expired).
 */
export function getTokenRemainingTime(token) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return 0;

  const remainingMs = payload.exp * 1000 - Date.now();
  return Math.max(0, remainingMs);
}

/**
 * Clears all authentication and session data from localStorage.
 */
export function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('activeDoc');
  localStorage.removeItem('selectedDocs');
}

/**
 * Broadcasts a session expiration event across the application.
 * @param {string} message 
 */
export function dispatchSessionExpired(message = 'Your session has expired. Please log in again.') {
  clearStoredAuth();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('auth:session-expired', {
        detail: { message }
      })
    );
  }
}

/**
 * Sets up an active timer and heartbeat check to log out precisely when JWT expires.
 * @param {string} token 
 * @param {Function} onExpire - Callback executed when session expires.
 * @returns {Function} - Cleanup function to clear timers.
 */
export function setupSessionTimeout(token, onExpire) {
  if (!token) return () => {};

  // Check immediately
  if (isTokenExpired(token)) {
    onExpire();
    return () => {};
  }

  const remainingMs = getTokenRemainingTime(token);

  // 1. Direct timeout for exact expiry moment
  const timer = setTimeout(() => {
    onExpire();
  }, remainingMs);

  // 2. Periodic heartbeat check (every 10 seconds)
  // Handles system sleep/wake, clock drift, or background tab throttling
  const heartbeat = setInterval(() => {
    if (isTokenExpired(token)) {
      clearTimeout(timer);
      clearInterval(heartbeat);
      onExpire();
    }
  }, 10000);

  return () => {
    clearTimeout(timer);
    clearInterval(heartbeat);
  };
}

/**
 * Authenticated fetch wrapper that automatically:
 * 1. Checks token expiration BEFORE sending request.
 * 2. Adds Bearer authorization header.
 * 3. Catches 401/403 responses and triggers immediate session expiration logout.
 * 
 * @param {string} url 
 * @param {RequestInit} [options={}] 
 * @param {string} token 
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}, token) {
  const currentToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);

  // If token is already expired, fail fast and log out
  if (currentToken && isTokenExpired(currentToken)) {
    dispatchSessionExpired('Your session has expired. Please log in again.');
    throw new Error('Session expired');
  }

  const headers = new Headers(options.headers || {});
  if (currentToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle unauthorized or expired token from backend
  if (response.status === 401 || response.status === 403) {
    let errorMsg = 'Your session has expired. Please log in again.';
    try {
      const cloned = response.clone();
      const errorJson = await cloned.json();
      if (errorJson.error) {
        errorMsg = errorJson.error;
      }
    } catch {
      // Ignore json parsing error on 401/403
    }

    dispatchSessionExpired(errorMsg);
    throw new Error(errorMsg);
  }

  return response;
}
