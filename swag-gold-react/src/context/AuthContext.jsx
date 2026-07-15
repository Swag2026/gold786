import { createContext, useContext, useState, useCallback } from 'react';
import { API_BASE } from '../lib/api';
import { useLanguage } from './LanguageContext.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { t, tf } = useLanguage();
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('sg_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username, password) => {
    setError('');
    setLoading(true);
    let res;
    try {
      res = await fetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
    } catch (networkErr) {
      // fetch() itself threw — this means the request never reached the
      // server at all (CORS block, DNS/offline, or a browser extension
      // interfering with fetch). This is NOT the same as wrong credentials,
      // so don't show the generic "wrong password" text for it.
      console.error('Login request failed before reaching the server:', networkErr);
      setLoading(false);
      const msg = tf('msg.loginnetworkfail', { err: networkErr.message });
      setError(msg);
      throw networkErr;
    }
    try {
      if (!res.ok) {
        throw new Error(t('msg.loginfail'));
      }
      const data = await res.json();
      // Matches backend/app/schemas/auth.py TokenResponse exactly — it's a
      // flat object (no nested "user" key), so we build our own user object.
      const loggedInUser = {
        id: data.user_id,
        username: data.username,
        name: data.full_name,
        role: data.role,
        avatar: data.avatar,
        mustChangePassword: data.must_change_password,
      };
      localStorage.setItem('sg_token', data.access_token);
      localStorage.setItem('sg_user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sg_token');
    localStorage.removeItem('sg_user');
    setUser(null);
  }, []);

  const setUserLocal = useCallback((partial) => {
    setUser(prev => {
      const merged = { ...prev, ...partial };
      localStorage.setItem('sg_user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, setUserLocal, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
