import { useState } from 'react';
import Modal from './Modal.jsx';
import { apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function ForcePasswordModal() {
  const { t } = useLanguage();
  const { setUserLocal, logout } = useAuth();
  const { showToast } = useToast();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 8) { setError('New password must be at least 8 characters long'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      await apiPost('/auth/change-password', { current_password: currentPw, new_password: newPw });
      setUserLocal({ mustChangePassword: false });
      showToast('Password updated — welcome in!', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Set a New Password" onClose={logout} width={420}>
      <p style={{ color: 'var(--cream-dim)', fontSize: 13.5, marginBottom: 16 }}>
        An admin set a temporary password for your account. Enter it below along with
        a new password of your own before continuing.
      </p>
      <form onSubmit={submit}>
        <div className="form-field" style={{ marginBottom: 14 }}>
          <label>Temporary Password</label>
          <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoFocus />
        </div>
        <div className="form-field" style={{ marginBottom: 14 }}>
          <label>{t('pw.new')} (min 8 characters)</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
        </div>
        <div className="form-field" style={{ marginBottom: 14 }}>
          <label>{t('pw.confirm')}</label>
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
        </div>
        {error && <div className="login-err" style={{ display: 'block' }}>⚠ {error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn gold" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Set Password & Continue'}</button>
          <button className="btn ghost" type="button" onClick={logout}>Sign out instead</button>
        </div>
      </form>
    </Modal>
  );
}
