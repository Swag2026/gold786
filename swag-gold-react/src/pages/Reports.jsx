import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Reports() {
  const { t } = useLanguage();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState(null);
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadSummary() {
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('start_date', from);
      if (to) params.set('end_date', to);
      setSummary(await apiGet(`/reports/summary?${params.toString()}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadDaily(d) {
    try {
      setDaily(await apiGet(`/reports/daily?report_date=${d}`));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    Promise.all([loadSummary(), loadDaily(dailyDate)]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="page-subtitle">Loading…</div>;

  return (
    <section className="view active">
      <div className="topbar">
        <div>
          <div className="page-title">{t('reports.title')}</div>
          <div className="page-subtitle">{t('reports.subtitle')}</div>
        </div>
      </div>

      {error && <div className="login-err" style={{ display: 'block' }}>⚠ {error}</div>}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>{t('reports.summary')}</div>
        <div className="filters-row">
          <div className="form-field"><label>{t('hist.fromDate')}</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="form-field"><label>{t('hist.toDate')}</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="form-field" style={{ alignSelf: 'flex-end' }}>
            <button className="btn gold" type="button" onClick={loadSummary}>{t('common.apply')}</button>
          </div>
        </div>
        {summary && (
          <div className="cards-grid" style={{ marginTop: 16 }}>
            <div className="card"><div className="card-label">{t('reports.revenue')}</div><div className="card-value">{Number(summary.total_revenue).toLocaleString()}</div></div>
            <div className="card"><div className="card-label">{t('reports.purchases')}</div><div className="card-value">{Number(summary.total_purchases).toLocaleString()}</div></div>
            <div className="card"><div className="card-label">{t('reports.invoices')}</div><div className="card-value">{summary.total_invoices}</div></div>
            <div className="card"><div className="card-label">{t('reports.saleInvoices')}</div><div className="card-value">{summary.sale_invoices}</div></div>
            <div className="card"><div className="card-label">{t('reports.totalGold')}</div><div className="card-value">{Number(summary.total_gold_grams).toFixed(1)}</div></div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>{t('reports.daily')}</div>
        <div className="form-field" style={{ maxWidth: 220, marginBottom: 16 }}>
          <label>Date</label>
          <input type="date" value={dailyDate} onChange={e => { setDailyDate(e.target.value); loadDaily(e.target.value); }} />
        </div>
        {daily && (
          <>
            <div className="cards-grid">
              <div className="card"><div className="card-label">Revenue</div><div className="card-value">{Number(daily.summary.total_revenue).toLocaleString()}</div></div>
              <div className="card"><div className="card-label">Purchases</div><div className="card-value">{Number(daily.summary.total_purchases).toLocaleString()}</div></div>
              <div className="card"><div className="card-label">Expenses</div><div className="card-value">{Number(daily.summary.total_expenses).toLocaleString()}</div></div>
              <div className="card"><div className="card-label">Net Cash</div><div className="card-value">{Number(daily.summary.net_cash).toLocaleString()}</div></div>
            </div>
            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table>
                <thead><tr><th>{t('common.invoice')}</th><th>Contact</th><th>{t('common.total')}</th><th>{t('common.cash')}</th><th>{t('common.card')}</th></tr></thead>
                <tbody>
                  {daily.sales.map(s => (
                    <tr key={s.invoice_no}>
                      <td>{s.invoice_no}</td><td>{s.contact || '—'}</td>
                      <td>{Number(s.total).toLocaleString()}</td><td>{s.cash}</td><td>{s.card}</td>
                    </tr>
                  ))}
                  {daily.sales.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--cream-faint)' }}>No sales that day</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
