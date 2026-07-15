import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { apiGet } from '../lib/api';
import { useLanguage } from '../context/LanguageContext.jsx';

const CATEGORY_LABELS = {
  sale: 'Sale',
  purchase_jewelry: 'Purchase Jewelry',
  purchase_scrap: 'Purchase Scrap',
  supplier_payment: 'Supplier Payment',
  expense: 'Expense',
};

export default function Analytics() {
  const { t } = useLanguage();
  const categoryCanvasRef = useRef(null);
  const categoryChartRef = useRef(null);
  const purityCanvasRef = useRef(null);
  const purityChartRef = useRef(null);
  const trendCanvasRef = useRef(null);
  const trendChartRef = useRef(null);
  const stackedCanvasRef = useRef(null);
  const stackedChartRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/invoices?limit=2000')
      .then(data => setEntries(Array.isArray(data) ? data : data.items || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const active = entries.filter(e => e.status !== 'canceled');

    // Chart 1 — totals by category
    const byCategory = {};
    Object.keys(CATEGORY_LABELS).forEach(k => { byCategory[k] = 0; });
    active.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.total_amount || 0); });

    if (categoryChartRef.current) categoryChartRef.current.destroy();
    if (categoryCanvasRef.current) {
      categoryChartRef.current = new Chart(categoryCanvasRef.current, {
        type: 'bar',
        data: {
          labels: Object.keys(byCategory).map(k => CATEGORY_LABELS[k]),
          datasets: [{
            label: 'Total (SAR)',
            data: Object.values(byCategory),
            backgroundColor: 'rgba(212,170,48,.55)',
            borderColor: 'rgba(212,170,48,1)',
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#8A95B0' }, grid: { color: 'rgba(255,255,255,.05)' } },
            y: { ticks: { color: '#8A95B0' }, grid: { color: 'rgba(255,255,255,.05)' } },
          },
        },
      });
    }

    // Chart 2 — weight sold by purity (all-time)
    const sales = active.filter(e => e.category === 'sale');
    const purityWeights = {
      '21K': sales.reduce((s, e) => s + Number(e.weight_21k || 0), 0),
      '18K': sales.reduce((s, e) => s + Number(e.weight_18k || 0), 0),
      '24K': sales.reduce((s, e) => s + Number(e.weight_24k || 0), 0),
      'Silver': sales.reduce((s, e) => s + Number(e.weight_silver || 0), 0),
    };
    if (purityChartRef.current) purityChartRef.current.destroy();
    if (purityCanvasRef.current) {
      purityChartRef.current = new Chart(purityCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: Object.keys(purityWeights),
          datasets: [{
            data: Object.values(purityWeights),
            backgroundColor: ['#D4AA30', '#AF8C28', '#F2CA4C', '#BCC6CE'],
            borderColor: '#0B0E17',
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom', labels: { color: '#8A95B0' } } },
        },
      });
    }

    // Chart 3 — sales trend over time (by day)
    const byDay = {};
    sales.forEach(e => { byDay[e.invoice_date] = (byDay[e.invoice_date] || 0) + Number(e.total_amount || 0); });
    const sortedDays = Object.keys(byDay).sort();
    if (trendChartRef.current) trendChartRef.current.destroy();
    if (trendCanvasRef.current && sortedDays.length > 0) {
      trendChartRef.current = new Chart(trendCanvasRef.current, {
        type: 'line',
        data: {
          labels: sortedDays,
          datasets: [{
            label: 'Sales (SAR)',
            data: sortedDays.map(d => byDay[d]),
            borderColor: 'rgba(212,170,48,1)',
            backgroundColor: 'rgba(212,170,48,.15)',
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#8A95B0' }, grid: { display: false } },
            y: { ticks: { color: '#8A95B0' }, grid: { color: 'rgba(255,255,255,.05)' } },
          },
        },
      });
    }

    // Chart 4 — stacked karat weight by day
    const byDayKarat = {};
    sales.forEach(e => {
      const d = e.invoice_date;
      byDayKarat[d] = byDayKarat[d] || { '21K': 0, '18K': 0, '24K': 0, Silver: 0 };
      byDayKarat[d]['21K'] += Number(e.weight_21k || 0);
      byDayKarat[d]['18K'] += Number(e.weight_18k || 0);
      byDayKarat[d]['24K'] += Number(e.weight_24k || 0);
      byDayKarat[d].Silver += Number(e.weight_silver || 0);
    });
    const stackedDays = Object.keys(byDayKarat).sort();
    if (stackedChartRef.current) stackedChartRef.current.destroy();
    if (stackedCanvasRef.current && stackedDays.length > 0) {
      const colors = { '21K': '#D4AA30', '18K': '#AF8C28', '24K': '#F2CA4C', Silver: '#BCC6CE' };
      stackedChartRef.current = new Chart(stackedCanvasRef.current, {
        type: 'bar',
        data: {
          labels: stackedDays,
          datasets: Object.keys(colors).map(k => ({
            label: k,
            data: stackedDays.map(d => byDayKarat[d][k]),
            backgroundColor: colors[k],
          })),
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom', labels: { color: '#8A95B0' } } },
          scales: {
            x: { stacked: true, ticks: { color: '#8A95B0' }, grid: { display: false } },
            y: { stacked: true, ticks: { color: '#8A95B0' }, grid: { color: 'rgba(255,255,255,.05)' } },
          },
        },
      });
    }

    return () => {
      if (categoryChartRef.current) categoryChartRef.current.destroy();
      if (purityChartRef.current) purityChartRef.current.destroy();
      if (trendChartRef.current) trendChartRef.current.destroy();
      if (stackedChartRef.current) stackedChartRef.current.destroy();
    };
  }, [entries, loading]);

  if (loading) return <div className="page-subtitle">Loading…</div>;
  if (error) return <div className="login-err" style={{ display: 'block' }}>⚠ {error}</div>;

  return (
    <section className="view active">
      <div className="topbar">
        <div>
          <div className="page-title">{t('analytics.title')}</div>
          <div className="page-subtitle">{t('analytics.subtitle')}</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: 15, marginBottom: 12 }}>Totals by Category</div>
        <canvas ref={categoryCanvasRef} height={100} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <div className="panel">
          <div className="page-title" style={{ fontSize: 15, marginBottom: 12 }}>Weight Sold by Purity</div>
          <canvas ref={purityCanvasRef} height={200} />
        </div>
        <div className="panel">
          <div className="page-title" style={{ fontSize: 15, marginBottom: 12 }}>Sales Trend Over Time</div>
          <canvas ref={trendCanvasRef} height={200} />
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="page-title" style={{ fontSize: 15, marginBottom: 12 }}>Karat Weight by Day (stacked)</div>
        <canvas ref={stackedCanvasRef} height={90} />
      </div>
    </section>
  );
}
