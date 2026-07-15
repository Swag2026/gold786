import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import jsPDF from 'jspdf';
import { apiGet, apiPut } from '../lib/api';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const isSale = (e) => e.category === 'sale';
const isPurchase = (e) => e.category === 'purchase_jewelry' || e.category === 'purchase_scrap';
const isCashOnly = (e) => e.category === 'supplier_payment' || e.category === 'expense';

export default function Dashboard() {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [dayOpenings, setDayOpenings] = useState({});
  const [reconciliations, setReconciliations] = useState({});
  const [activeDay, setActiveDay] = useState(new Date().toISOString().slice(0, 10));
  const [openingForm, setOpeningForm] = useState({ cash: '', gold: '', silver: '' });
  const [savingOpening, setSavingOpening] = useState(false);

  const [showReconcile, setShowReconcile] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [reconNote, setReconNote] = useState('');
  const [savingRecon, setSavingRecon] = useState(false);
  const [reconError, setReconError] = useState('');
  const cashCanvasRef = useRef(null);
  const cashChartRef = useRef(null);
  const karatCanvasRef = useRef(null);
  const karatChartRef = useRef(null);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [invoicesRes, contactsRes, openingsRes, reconRes] = await Promise.all([
        apiGet(`/invoices?limit=2000`),
        apiGet(`/contacts`),
        apiGet(`/day-openings`),
        apiGet(`/reconciliations`),
      ]);

      const list = Array.isArray(invoicesRes) ? invoicesRes : invoicesRes?.items || [];
      setEntries(list);
      setContacts(contactsRes || []);

      const openingsMap = {};
      (openingsRes || []).forEach(row => {
        openingsMap[row.opening_date] = {
          cash: row.opening_cash || 0,
          gold: row.opening_gold || 0,
          silver: row.opening_silver || 0,
        };
      });
      setDayOpenings(openingsMap);

      const reconMap = {};
      (reconRes || []).forEach(row => { reconMap[row.reconciliation_date] = row; });
      setReconciliations(reconMap);

      const days = [...new Set(list.map(e => e.invoice_date))].filter(Boolean).sort();
      setActiveDay(days[days.length - 1] || new Date().toISOString().slice(0, 10));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const opening = dayOpenings[activeDay] || { cash: 0, gold: 0, silver: 0 };
  const recon = reconciliations[activeDay];

  const allDays = useMemo(() => {
    const fromEntries = entries.map(e => e.invoice_date);
    const fromOpenings = Object.keys(dayOpenings);
    const set = new Set([...fromEntries, ...fromOpenings, activeDay]);
    return [...set].filter(Boolean).sort();
  }, [entries, dayOpenings, activeDay]);

  function addNewDay() {
    const last = allDays[allDays.length - 1] || activeDay;
    const next = new Date(last + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    const nStr = next.toISOString().slice(0, 10);
    setActiveDay(nStr);
    showToast('New day added', 'success');
  }

  const dayEntries = useMemo(
    () => entries.filter(e => e.invoice_date === activeDay && e.status !== 'canceled'),
    [entries, activeDay]
  );
  const sales = dayEntries.filter(isSale);
  const purchases = dayEntries.filter(isPurchase);
  const cashOnly = dayEntries.filter(isCashOnly);

  const salesTotal = sales.reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const purchaseTotal = purchases.reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const expenseTotal = cashOnly.reduce((s, e) => s + (Number(e.cash_amount) || 0) + (Number(e.card_amount) || 0), 0);
  // Physical drawer cash ("Closing Cash") must only count CASH legs — a
  // card/transfer sale never enters the drawer, it goes straight to the
  // bank. Using the card-inclusive totals above inflates this figure and
  // guarantees a false variance on Close Day whenever card payments happen.
  const salesCash = sales.reduce((s, e) => s + (Number(e.cash_amount) || 0), 0);
  const purchaseCash = purchases.reduce((s, e) => s + (Number(e.cash_amount) || 0), 0);
  const expenseCash = cashOnly.reduce((s, e) => s + (Number(e.cash_amount) || 0), 0);
  const cardCollected = salesTotal - salesCash; // card/transfer money collected today (informational)
  const systemClosingCash = (opening.cash || 0) + salesCash - purchaseCash - expenseCash;

  const toK21 = (w, k) => w * (k / 21);
  const goldBalance = useMemo(() => {
    const salesConv21 = sales.reduce((s, e) =>
      s + Number(e.weight_21k || 0) + toK21(Number(e.weight_18k || 0), 18) + toK21(Number(e.weight_24k || 0), 24), 0);
    const purchConv21 = purchases.reduce((s, e) =>
      s + Number(e.weight_21k || 0) + toK21(Number(e.weight_18k || 0), 18) + toK21(Number(e.weight_24k || 0), 24), 0);
    // Sales send gold OUT of the tray, purchases (buying jewelry/scrap from
    // customers) bring gold IN — the previous version had both signs
    // inverted, so heavier sales days made the gold balance look bigger.
    return (opening.gold || 0) - salesConv21 + purchConv21;
  }, [sales, purchases, opening.gold]);

  const balanceWarnings = [];
  if (systemClosingCash < 0) balanceWarnings.push(`Closing cash has gone negative by SAR ${Math.abs(systemClosingCash).toFixed(2)} — check for a missing or mis-categorized entry.`);
  if (goldBalance < 0) balanceWarnings.push(`Gold balance (21K-equivalent) has gone negative by ${Math.abs(goldBalance).toFixed(1)}g.`);

  const [invoiceTotalCount, setInvoiceTotalCount] = useState(0);
  useEffect(() => {
    apiGet('/invoices/count').then(d => setInvoiceTotalCount(d?.total || 0)).catch(() => {});
  }, [entries]);
  const LOAD_LIMIT = 2000;

  const weightSegs = useMemo(() => {
    const w21 = sales.reduce((s, e) => s + Number(e.weight_21k || 0), 0);
    const w18 = sales.reduce((s, e) => s + Number(e.weight_18k || 0), 0);
    const w24 = sales.reduce((s, e) => s + Number(e.weight_24k || 0), 0);
    const wS = sales.reduce((s, e) => s + Number(e.weight_silver || 0), 0);
    const totalW = w21 + w18 + w24 + wS;
    const segs = [
      { label: '21K', w: w21, color: '#D4AA30' },
      { label: '18K', w: w18, color: '#AF8C28' },
      { label: '24K', w: w24, color: '#F2CA4C' },
      { label: 'Silver', w: wS, color: '#BCC6CE' },
    ].filter(s => s.w > 0);
    return { segs, totalW };
  }, [sales]);

  // Mismatch: karat-based entries where total doesn't equal cash+card split
  const mismatches = dayEntries.filter(e =>
    (isSale(e) || isPurchase(e)) &&
    Math.abs(Number(e.total_amount || 0) - ((Number(e.cash_amount) || 0) + (Number(e.card_amount) || 0))) > 0.5
  );

  // Cash & Card flow across the last several days (trailing window ending on activeDay)
  useEffect(() => {
    if (loading || !cashCanvasRef.current) return;
    const trailingDays = allDays.filter(d => d <= activeDay).slice(-10);
    const cashByDay = trailingDays.map(d =>
      entries.filter(e => e.invoice_date === d && e.status !== 'canceled')
        .reduce((s, e) => s + (Number(e.cash_amount) || 0), 0));
    const cardByDay = trailingDays.map(d =>
      entries.filter(e => e.invoice_date === d && e.status !== 'canceled')
        .reduce((s, e) => s + (Number(e.card_amount) || 0), 0));

    if (cashChartRef.current) cashChartRef.current.destroy();
    cashChartRef.current = new Chart(cashCanvasRef.current, {
      type: 'bar',
      data: {
        labels: trailingDays,
        datasets: [
          { label: 'Cash', data: cashByDay, backgroundColor: 'rgba(212,170,48,.6)' },
          { label: 'Card', data: cardByDay, backgroundColor: 'rgba(74,127,165,.6)' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#8A95B0' } } },
        scales: {
          x: { stacked: true, ticks: { color: '#8A95B0' }, grid: { display: false } },
          y: { stacked: true, ticks: { color: '#8A95B0' }, grid: { color: 'rgba(255,255,255,.05)' } },
        },
      },
    });
    return () => { if (cashChartRef.current) cashChartRef.current.destroy(); };
  }, [entries, allDays, activeDay, loading]);

  // Sales by karat, this day only
  useEffect(() => {
    if (loading || !karatCanvasRef.current) return;
    if (karatChartRef.current) karatChartRef.current.destroy();
    if (weightSegs.totalW > 0) {
      karatChartRef.current = new Chart(karatCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: weightSegs.segs.map(s => s.label),
          datasets: [{ data: weightSegs.segs.map(s => s.w), backgroundColor: weightSegs.segs.map(s => s.color), borderColor: '#0B0E17', borderWidth: 2 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8A95B0' } } } },
      });
    }
    return () => { if (karatChartRef.current) karatChartRef.current.destroy(); };
  }, [weightSegs, loading]);

  useEffect(() => {
    setOpeningForm({ cash: opening.cash || '', gold: opening.gold || '', silver: opening.silver || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay, dayOpenings]);

  async function saveOpening(e) {
    e.preventDefault();
    setSavingOpening(true);
    try {
      await apiPut(`/day-openings/${activeDay}`, {
        opening_cash: Number(openingForm.cash) || 0,
        opening_gold: Number(openingForm.gold) || 0,
        opening_silver: Number(openingForm.silver) || 0,
      });
      setDayOpenings(prev => ({ ...prev, [activeDay]: {
        cash: Number(openingForm.cash) || 0,
        gold: Number(openingForm.gold) || 0,
        silver: Number(openingForm.silver) || 0,
      }}));
      showToast('Opening balance saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingOpening(false);
    }
  }

  function openReconcile() {
    setCountedCash(recon ? recon.counted_cash : '');
    setReconNote(recon ? recon.note || '' : '');
    setReconError('');
    setShowReconcile(true);
  }

  async function saveReconciliation(e) {
    e.preventDefault();
    if (countedCash === '') { setReconError('Enter the counted cash amount'); return; }
    setSavingRecon(true);
    setReconError('');
    try {
      const result = await apiPut(`/reconciliations/${activeDay}`, {
        system_closing_cash: systemClosingCash,
        counted_cash: Number(countedCash),
        note: reconNote.trim(),
      });
      setReconciliations(prev => ({ ...prev, [activeDay]: result }));
      showToast('Day closed and reconciled', 'success');
      setShowReconcile(false);
    } catch (err) {
      setReconError(err.message);
    } finally {
      setSavingRecon(false);
    }
  }

  function exportDayPDF() {
    const closingCash = systemClosingCash;
    const doc = new jsPDF({ unit: 'pt', format: [320, 500] });
    let y = 36;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Swag Gold', 20, y); y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`Day Summary — ${activeDay}`, 20, y); y += 18;
    doc.setDrawColor(220); doc.line(20, y, 300, y); y += 16;

    const rows = [
      ['Opening Cash', `SAR ${fmt(opening.cash)}`],
      ['Cash Sales', `SAR ${fmt(salesCash)}`],
      ['Cash Purchases', `SAR ${fmt(purchaseCash)}`],
      ['Cash Expenses / Payments', `SAR ${fmt(expenseCash)}`],
      ['Card / Transfer collected (bank)', `SAR ${fmt(cardCollected)}`],
    ];
    doc.setTextColor(30); doc.setFontSize(11);
    rows.forEach(([label, val]) => {
      doc.text(label, 20, y);
      doc.text(val, 300, y, { align: 'right' });
      y += 20;
    });
    doc.setDrawColor(200); doc.line(20, y, 300, y); y += 18;
    doc.setFont('helvetica', 'bold');
    doc.text('Closing Cash', 20, y);
    doc.text(`SAR ${fmt(closingCash)}`, 300, y, { align: 'right' });
    y += 24;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`Active Invoices: ${dayEntries.length}`, 20, y); y += 16;
    doc.text(`Gold Balance (21K-eq): ${goldBalance.toFixed(1)}g`, 20, y);

    doc.save(`swag-gold-day-summary-${activeDay}.pdf`);
  }

  if (loading) return <div className="page-subtitle">Loading your ledger…</div>;
  if (error) return <div className="login-err" style={{ display: 'block' }}>⚠ {error}</div>;

  return (
    <section className="view active">
      <div className="topbar">
        <div>
          <div className="page-title">{t('dash.title')}</div>
          <div className="page-subtitle">{activeDay}</div>
        </div>
        <div className="topbar-actions">
          <select className="day-select" value={activeDay} onChange={e => setActiveDay(e.target.value)}>
            {allDays.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button className="btn small" onClick={addNewDay}>+ New Day</button>
          <button className="btn small" onClick={openReconcile}>{t('dash.closeDay')}</button>
          <button className="btn gold" onClick={exportDayPDF}>{t('dash.daySummary')}</button>
        </div>
      </div>

      {recon && (
        <div className={`alert ${Math.abs(recon.variance) < 0.01 ? 'success' : 'warn'}`} style={{ padding: 10, borderRadius: 8, marginBottom: 12 }}>
          {Math.abs(recon.variance) < 0.01
            ? `✓ Day closed and matches — reconciled by ${recon.reconciled_by_name || 'a team member'}`
            : `⚠ Day closed with a variance of SAR ${fmt(Math.abs(recon.variance))} (${recon.variance > 0 ? 'over' : 'short'}) — reconciled by ${recon.reconciled_by_name || 'a team member'}`}
        </div>
      )}
      {mismatches.length > 0 && (
        <div className="alert warn" style={{ padding: 10, borderRadius: 8, marginBottom: 12 }}>
          ⚠ {mismatches.length} {mismatches.length === 1 ? 'entry has' : 'entries have'} a cash/card split that doesn't match its total
        </div>
      )}
      {balanceWarnings.map((w, i) => (
        <div key={i} className="alert warn" style={{ padding: 10, borderRadius: 8, marginBottom: 12 }}>⚠ {w}</div>
      ))}
      {invoiceTotalCount >= LOAD_LIMIT && (
        <div className="alert warn" style={{ padding: 10, borderRadius: 8, marginBottom: 12 }}>
          ⚠ You have {invoiceTotalCount.toLocaleString()} invoices, at the {LOAD_LIMIT.toLocaleString()}-record load limit — older invoices may not show up. Ask about switching to paginated loading.
        </div>
      )}
      {invoiceTotalCount >= LOAD_LIMIT * 0.8 && invoiceTotalCount < LOAD_LIMIT && (
        <div className="alert info" style={{ padding: 10, borderRadius: 8, marginBottom: 12 }}>
          ℹ Approaching the load limit: {invoiceTotalCount.toLocaleString()} of {LOAD_LIMIT.toLocaleString()} invoices loaded.
        </div>
      )}

      <div className="ledger-strip">
        <div className="ledger-strip-head">
          <div className="ledger-strip-title">{t('dash.weightDist')}</div>
          <div className="ledger-strip-title" style={{ color: 'var(--gold-21)' }}>{weightSegs.totalW.toFixed(1)}g total</div>
        </div>
        <div className="purity-bar" style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-3)' }}>
          {weightSegs.segs.map(s => (
            <div key={s.label} style={{ width: `${(s.w / weightSegs.totalW) * 100}%`, background: s.color }} title={`${s.label}: ${s.w.toFixed(1)}g`} />
          ))}
          {weightSegs.totalW === 0 && <div style={{ width: '100%', color: 'var(--cream-faint)', fontSize: 12, textAlign: 'center' }}>No sales weight recorded yet today</div>}
        </div>
        <div className="purity-legend" style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {weightSegs.segs.map(s => (
            <span key={s.label} style={{ fontSize: 12.5, color: 'var(--cream-dim)' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 5 }} />
              {s.label}: {s.w.toFixed(1)}g
            </span>
          ))}
        </div>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-label">{t('dash.todaySales')}</div>
          <div className="card-value">{fmt(salesTotal)}</div>
        </div>
        <div className="card">
          <div className="card-label">{t('dash.todayPurchases')}</div>
          <div className="card-value">{fmt(purchaseTotal)}</div>
        </div>
        <div className="card">
          <div className="card-label">{t('dash.openingCash')}</div>
          <div className="card-value">{fmt(opening.cash)}</div>
        </div>
        <div className="card">
          <div className="card-label">{t('dash.closingCash')}</div>
          <div className="card-value">{fmt(systemClosingCash)}</div>
        </div>
        <div className="card">
          <div className="card-label">{t('dash.goldBalance')}</div>
          <div className="card-value">{goldBalance.toFixed(1)}</div>
        </div>
        <div className="card">
          <div className="card-label">{t('dash.entriesToday')}</div>
          <div className="card-value">{dayEntries.length}</div>
        </div>
        <div className="card">
          <div className="card-label">{t('dash.contacts')}</div>
          <div className="card-value">{contacts.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="panel">
          <div className="page-title" style={{ fontSize: 15, marginBottom: 12 }}>Cash & Card Flow (last 10 days)</div>
          <div style={{ height: 240 }}><canvas ref={cashCanvasRef} /></div>
        </div>
        <div className="panel">
          <div className="page-title" style={{ fontSize: 15, marginBottom: 12 }}>Sales by Karat (This Day)</div>
          <div style={{ height: 240 }}>
            {weightSegs.totalW > 0
              ? <canvas ref={karatCanvasRef} />
              : <div style={{ color: 'var(--cream-faint)', fontSize: 13, textAlign: 'center', paddingTop: 90 }}>No sales weight today</div>}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: 15, marginBottom: 12 }}>Exhibition Overview</div>
        <div className="overview-grid">
          <div className="overview-card">
            <div className="ov-label">Days Tracked</div>
            <div className="ov-value">{allDays.length}</div>
          </div>
          <div className="overview-card">
            <div className="ov-label">All-Time Sales</div>
            <div className="ov-value">{fmt(entries.filter(e => isSale(e) && e.status !== 'canceled').reduce((s, e) => s + Number(e.total_amount || 0), 0))}</div>
          </div>
          <div className="overview-card">
            <div className="ov-label">All-Time Purchases</div>
            <div className="ov-value">{fmt(entries.filter(e => isPurchase(e) && e.status !== 'canceled').reduce((s, e) => s + Number(e.total_amount || 0), 0))}</div>
          </div>
          <div className="overview-card">
            <div className="ov-label">Total Invoices</div>
            <div className="ov-value">{entries.length}</div>
          </div>
        </div>
      </div>

      <form className="panel" onSubmit={saveOpening} style={{ marginTop: 20, maxWidth: 520 }}>
        <div className="page-title" style={{ fontSize: 16, marginBottom: 12 }}>{t('dash.openingBalance')} — {activeDay}</div>
        <div className="form-grid">
          <div className="form-field">
            <label>Cash</label>
            <input type="number" min="0" step="0.01" value={openingForm.cash}
              onChange={e => setOpeningForm(f => ({ ...f, cash: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Gold (g)</label>
            <input type="number" min="0" step="0.001" value={openingForm.gold}
              onChange={e => setOpeningForm(f => ({ ...f, gold: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Silver (g)</label>
            <input type="number" min="0" step="0.001" value={openingForm.silver}
              onChange={e => setOpeningForm(f => ({ ...f, silver: e.target.value }))} />
          </div>
        </div>
        <button className="btn gold" type="submit" disabled={savingOpening} style={{ marginTop: 14 }}>
          {savingOpening ? 'Saving…' : t('dash.saveOpening')}
        </button>
      </form>

      {showReconcile && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,6,13,.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowReconcile(false); }}
        >
          <form className="panel" onSubmit={saveReconciliation} style={{ width: 440, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="page-title" style={{ fontSize: 16 }}>Close Day — {activeDay}</div>
              <button className="btn ghost sm" type="button" onClick={() => setShowReconcile(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--cream-dim)', fontSize: 13.5, marginBottom: 12 }}>
              System closing cash: <strong>SAR {fmt(systemClosingCash)}</strong>
            </p>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label>Counted Cash (SAR)</label>
              <input type="number" step="0.01" value={countedCash} onChange={e => setCountedCash(e.target.value)} />
            </div>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label>Note (optional)</label>
              <input value={reconNote} onChange={e => setReconNote(e.target.value)} />
            </div>
            {countedCash !== '' && (
              <div className={`alert ${Math.abs((Number(countedCash) || 0) - systemClosingCash) < 0.01 ? 'success' : 'warn'}`} style={{ padding: 10, borderRadius: 8, marginBottom: 14 }}>
                {Math.abs((Number(countedCash) || 0) - systemClosingCash) < 0.01
                  ? '✓ Matches system total'
                  : `⚠ ${(Number(countedCash) || 0) > systemClosingCash ? 'Over' : 'Short'} by SAR ${fmt(Math.abs((Number(countedCash) || 0) - systemClosingCash))}`}
              </div>
            )}
            {reconError && <div className="login-err" style={{ display: 'block' }}>⚠ {reconError}</div>}
            <button className="btn gold" type="submit" disabled={savingRecon}>{savingRecon ? 'Saving…' : 'Confirm & Close Day'}</button>
          </form>
        </div>
      )}
    </section>
  );
}
