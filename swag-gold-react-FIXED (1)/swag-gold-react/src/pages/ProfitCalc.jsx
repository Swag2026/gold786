import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../lib/api';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function ProfitCalc() {
  const { t } = useLanguage();
  const [rates, setRates] = useState({ '21': 0, '18': 0, '24': 0, 'silver': 0 });
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiGet('/cost-rates'),
      apiGet('/invoices?limit=2000'),
    ]).then(([rateData, invData]) => {
      const map = { '21': 0, '18': 0, '24': 0, 'silver': 0 };
      (rateData || []).forEach(r => { map[String(r.purity)] = r.cost_per_gram; });
      setRates(map);
      const list = Array.isArray(invData) ? invData : invData?.items || [];
      setSales(list.filter(e => e.category === 'sale' && e.status !== 'canceled'));
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const hasAnyRate = rates['21'] || rates['18'] || rates['24'] || rates['silver'];

  const rows = useMemo(() => {
    return sales.map(e => {
      const revenue = Number(e.total_amount || 0);
      const cost = (Number(e.weight_21k) || 0) * rates['21']
        + (Number(e.weight_18k) || 0) * rates['18']
        + (Number(e.weight_24k) || 0) * rates['24']
        + (Number(e.weight_silver) || 0) * rates['silver'];
      const profit = revenue - cost;
      const hasCalc = (e.weight_21k && rates['21']) || (e.weight_18k && rates['18']) || (e.weight_24k && rates['24']) || (e.weight_silver && rates['silver']);
      const margin = revenue > 0 && hasCalc ? (profit / revenue) * 100 : null;
      return { e, revenue, cost, profit, margin, hasCalc };
    }).sort((a, b) => (b.margin || -Infinity) - (a.margin || -Infinity));
  }, [sales, rates]);

  const totRev = rows.reduce((s, r) => s + r.revenue, 0);
  const totCost = rows.reduce((s, r) => s + r.cost, 0);
  const totProfit = totRev - totCost;
  const avgMargin = totRev > 0 && hasAnyRate ? (totProfit / totRev) * 100 : null;

  if (loading) return <div className="page-subtitle">Loading…</div>;
  if (error) return <div className="login-err" style={{ display: 'block' }}>⚠ {error}</div>;

  return (
    <section className="view active">
      <div className="topbar">
        <div>
          <div className="page-title">{t('profit.title')}</div>
          <div className="page-subtitle">Profit per sale, using your Settings → Cost Rates</div>
        </div>
      </div>

      {!hasAnyRate && (
        <div className="alert info" style={{ padding: 10, borderRadius: 8, marginBottom: 16 }}>
          ℹ No cost rates are set yet — go to Settings to enter cost per gram for 21K/18K/24K/Silver, then profit and margin will calculate automatically.
        </div>
      )}

      <div className="cards-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-label">{t('profit.revenue')}</div>
          <div className="card-value">{totRev.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 12, color: 'var(--cream-faint)', marginTop: 4 }}>{sales.length} sale invoices</div>
        </div>
        <div className="card">
          <div className="card-label">{t('profit.cost')}</div>
          <div className="card-value">{hasAnyRate ? totCost.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</div>
        </div>
        <div className="card">
          <div className="card-label">{t('profit.profit')}</div>
          <div className="card-value" style={{ color: hasAnyRate ? (totProfit >= 0 ? 'var(--emerald)' : 'var(--red)') : undefined }}>
            {hasAnyRate ? totProfit.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
          </div>
        </div>
        <div className="card">
          <div className="card-label">{t('profit.margin')}</div>
          <div className="card-value" style={{ color: avgMargin !== null ? (avgMargin >= 0 ? 'var(--emerald)' : 'var(--red)') : undefined }}>
            {avgMargin !== null ? avgMargin.toFixed(1) + '%' : '—'}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('common.invoice')}</th><th>{t('common.date')}</th>
                <th>21K (g)</th><th>18K (g)</th><th>24K (g)</th><th>Silver (g)</th>
                <th>{t('profit.revenue')}</th><th>{t('profit.cost')}</th><th>{t('profit.profit')}</th><th>{t('profit.margin')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, revenue, cost, profit, margin, hasCalc }) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 700, color: 'var(--gold-21)' }}>#{e.invoice_no}</td>
                  <td>{e.invoice_date}</td>
                  <td>{e.weight_21k ? Number(e.weight_21k).toFixed(2) : '—'}</td>
                  <td>{e.weight_18k ? Number(e.weight_18k).toFixed(2) : '—'}</td>
                  <td>{e.weight_24k ? Number(e.weight_24k).toFixed(2) : '—'}</td>
                  <td>{e.weight_silver ? Number(e.weight_silver).toFixed(2) : '—'}</td>
                  <td style={{ fontWeight: 700 }}>{revenue.toLocaleString()}</td>
                  <td style={{ color: 'var(--cream-dim)' }}>{hasCalc ? cost.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
                  <td style={{ fontWeight: 700, color: hasCalc ? (profit >= 0 ? 'var(--emerald)' : 'var(--red)') : undefined }}>
                    {hasCalc ? profit.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td style={{ color: margin !== null ? (margin >= 0 ? 'var(--emerald)' : 'var(--red)') : undefined }}>
                    {margin !== null ? margin.toFixed(1) + '%' : '—'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--cream-faint)' }}>No sale invoices yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
