import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../lib/api';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function ActivityLog() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiGet('/activity-logs')
      .then(setLogs)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const users = useMemo(() => [...new Set(logs.map(l => l.user_name))].filter(Boolean), [logs]);
  const types = useMemo(() => [...new Set(logs.map(l => l.action_type))].filter(Boolean), [logs]);

  const filtered = logs.filter(l => {
    if (typeFilter !== 'all' && l.action_type !== typeFilter) return false;
    if (userFilter !== 'all' && l.user_name !== userFilter) return false;
    if (search && !String(l.invoice_no || '').toLowerCase().includes(search.toLowerCase())
      && !String(l.note || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = useMemo(() => {
    const byType = {};
    filtered.forEach(l => { byType[l.action_type] = (byType[l.action_type] || 0) + 1; });
    return byType;
  }, [filtered]);

  if (loading) return <div className="page-subtitle">Loading…</div>;
  if (error) return <div className="login-err" style={{ display: 'block' }}>⚠ {error}</div>;

  return (
    <section className="view active">
      <div className="topbar">
        <div>
          <div className="page-title">{t('activity.title')}</div>
          <div className="page-subtitle">{t('activity.subtitle')}</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="filters-row">
          <div className="form-field">
            <label>Action Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {types.map(ty => <option key={ty} value={ty}>{ty}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>User</label>
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)}>
              <option value="all">All Users</option>
              {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
            <label>Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Invoice # or note..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          {Object.entries(stats).map(([ty, count]) => (
            <span key={ty} style={{ fontSize: 12.5, color: 'var(--cream-dim)' }}>
              <strong style={{ color: 'var(--gold-21)' }}>{count}</strong> {ty}
            </span>
          ))}
          <span style={{ fontSize: 12.5, color: 'var(--cream-faint)' }}>· {filtered.length} of {logs.length} entries</span>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('activity.when')}</th><th>{t('activity.user')}</th><th>{t('activity.action')}</th><th>{t('common.invoice')}</th><th>{t('common.category')}</th><th>{t('common.total')}</th><th>{t('activity.note')}</th></tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: l.user_avatar ? `url(${l.user_avatar}) center/cover` : 'var(--surface-3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--gold-24)',
                    }}>
                      {!l.user_avatar && (l.user_name || '?')[0]?.toUpperCase()}
                    </span>
                    {l.user_name} <span style={{ color: 'var(--cream-faint)' }}>({l.user_role})</span>
                  </td>
                  <td>{l.action_type}</td>
                  <td>{l.invoice_no || '—'}</td>
                  <td>{l.category || '—'}</td>
                  <td>{Number(l.amount || 0).toLocaleString()}</td>
                  <td>{l.note || ''}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--cream-faint)' }}>{t('activity.none')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
