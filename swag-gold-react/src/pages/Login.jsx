import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Login() {
  const { login, error, loading } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (_) {
      /* error already surfaced via context */
    }
  }

  return (
    <div id="loginScreen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-gem">
          <img src="/logo.png" alt="Swag Gold" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = '◆'; }} />
        </div>
        <div className="login-title">{t('login.title')}</div>
        <div className="login-sub">{t('login.sub')}</div>

        <div className="lfield">
          <label>{t('login.username')}</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
          />
        </div>
        <div className="lfield">
          <label>{t('login.password')}</label>
          <div className="lfield-pass-wrap">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="lfield-eye"
              tabIndex={-1}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              onClick={() => setShowPass(s => !s)}
            >
              {showPass ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? '…' : t('login.btn')}
        </button>

        {error && (
          <div className="login-err" style={{ display: 'block' }}>
            ⚠ {error}
          </div>
        )}
      </form>
    </div>
  );
}
