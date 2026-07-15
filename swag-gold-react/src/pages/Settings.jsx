import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPut } from '../lib/api';
import { API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Settings() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [rates, setRates] = useState([]);
  const [loginAttempts, setLoginAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [backupError, setBackupError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [rateData, attemptsData] = await Promise.all([
        apiGet('/cost-rates'),
        apiGet('/auth/login-attempts?limit=20').catch(() => []),
      ]);
      setRates(rateData);
      setLoginAttempts(attemptsData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateRate(id, cost_per_gram) {
    setSaving(id);
    try {
      await apiPut(`/cost-rates/${id}`, { cost_per_gram: Number(cost_per_gram) });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(null);
    }
  }

  async function downloadBackup() {
    setBackupError('');
    try {
      const token = localStorage.getItem('sg_token');
      const res = await fetch(API_BASE + '/backup/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Backup export failed (' + res.status + ')');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'swag-gold-backup.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBackupError(err.message);
    }
  }

  if (loading) return <div className="page-subtitle">Loading…</div>;

  return (
    <section className="view active">
      <div className="topbar">
        <div>
          <div className="page-title">{t('settings.title')}</div>
          <div className="page-subtitle">Signed in as {user?.name} ({user?.role})</div>
        </div>
      </div>

      {error && <div className="login-err" style={{ display: 'block' }}>⚠ {error}</div>}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>{t('settings.costRates')}</div>
        <div className="form-grid">
          {rates.map(r => (
            <div className="form-field" key={r.id}>
              <label>{String(r.purity).toUpperCase()}</label>
              <input
                type="number" min="0" step="0.01"
                defaultValue={r.cost_per_gram}
                onBlur={e => updateRate(r.id, e.target.value)}
                disabled={saving === r.id}
              />
            </div>
          ))}
        </div>
        <p style={{ color: 'var(--cream-dim)', fontSize: 12.5, marginTop: 10 }}>
          Changes save automatically when you click out of a field.
        </p>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>{t('settings.teamAccess')}</div>
        <p style={{ color: 'var(--cream-dim)', fontSize: 13.5, marginBottom: 12 }}>
          Add staff accounts, change roles (cashier / supervisor / admin), or disable access.
        </p>
        <Link className="btn gold" to="/users">{t('settings.manageUsers')}</Link>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>{t('settings.backup')}</div>
        <p style={{ color: 'var(--cream-dim)', fontSize: 13.5, marginBottom: 12 }}>
          Download a full export (invoices, contacts, activity log) as a JSON file.
        </p>
        <button className="btn gold" onClick={downloadBackup}>{t('settings.downloadBackup')}</button>
        {backupError && <div className="login-err" style={{ display: 'block', marginTop: 10 }}>⚠ {backupError}</div>}
      </div>

      <div className="panel">
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>{t('settings.loginAttempts')}</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>{t('users.username')}</th><th>Result</th><th>IP</th><th>Reason</th></tr></thead>
            <tbody>
              {loginAttempts.map(a => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                  <td>{a.username}</td>
                  <td style={{ color: a.success ? 'var(--emerald)' : 'var(--red)' }}>{a.success ? 'Success' : 'Failed'}</td>
                  <td>{a.ip_address || '—'}</td>
                  <td>{a.reason || ''}</td>
                </tr>
              ))}
              {loginAttempts.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--cream-faint)' }}>No login attempts recorded, or you don't have permission to view this.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
