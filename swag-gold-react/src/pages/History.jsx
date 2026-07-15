import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const CATEGORY_LABELS = {
  sale: 'Sale',
  purchase_jewelry: 'Purchase — Jewelry',
  purchase_scrap: 'Purchase — Scrap',
  supplier_payment: 'Supplier Payment',
  expense: 'Expense',
};

export default function History() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { t, tf } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [flashInvoice, setFlashInvoice] = useState(location.state?.flashInvoice || null);
  const [detailEntry, setDetailEntry] = useState(null);
  const [pendingCancel, setPendingCancel] = useState(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/invoices?limit=2000');
      setEntries(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const list = entries.filter(e => {
      if (from && e.invoice_date < from) return false;
      if (to && e.invoice_date > to) return false;
      if (category !== 'all' && e.category !== category) return false;
      if (status !== 'all' && e.status !== status) return false;
      if (search && !String(e.invoice_no).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const sorted = [...list];
    switch (sort) {
      case 'date_asc': sorted.sort((a, b) => a.invoice_date.localeCompare(b.invoice_date)); break;
      case 'amount_desc': sorted.sort((a, b) => Number(b.total_amount) - Number(a.total_amount)); break;
      case 'amount_asc': sorted.sort((a, b) => Number(a.total_amount) - Number(b.total_amount)); break;
      case 'inv_desc': sorted.sort((a, b) => String(b.invoice_no).localeCompare(String(a.invoice_no), undefined, { numeric: true })); break;
      case 'inv_asc': sorted.sort((a, b) => String(a.invoice_no).localeCompare(String(b.invoice_no), undefined, { numeric: true })); break;
      default: sorted.sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)); // date_desc
    }
    return sorted;
  }, [entries, from, to, category, status, search, sort]);

  // Any filter/sort change snaps back to page 1, and pagination keeps a
  // heavy invoice history from rendering hundreds of rows into one page.
  useEffect(() => { setPage(1); }, [from, to, category, status, search, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  // After saving an entry, make it impossible to miss: if the current
  // filters/sort hide it, clear them once; then jump to whichever page it
  // actually lands on and flash its row gold for a couple of seconds.
  useEffect(() => {
    if (!flashInvoice || loading) return;
    const idx = filtered.findIndex(e => String(e.invoice_no) === String(flashInvoice));
    if (idx === -1) {
      // Not visible under the current filters — clear them once and retry.
      if (from || to || category !== 'all' || status !== 'all' || search) {
        setFrom(''); setTo(''); setCategory('all'); setStatus('all'); setSearch('');
        return;
      }
      // Genuinely not found (e.g. failed silently) — give up quietly.
      setFlashInvoice(null);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
    if (targetPage !== safePage) { setPage(targetPage); return; }
    const row = document.getElementById(`hist-row-${filtered[idx].id}`);
    if (row) {
      row.classList.add('row-flash');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => row.classList.remove('row-flash'), 2600);
    }
    setFlashInvoice(null);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashInvoice, filtered, safePage, loading]);

  const totals = filtered.reduce((acc, e) => {
    if (e.status !== 'canceled') acc.total += Number(e.total_amount) || 0;
    return acc;
  }, { total: 0 });

  async function cancelEntry(id) {
    if (user?.role === 'supervisor' && !cancelNote.trim()) {
      setCancelError('Please add a reason (required for supervisors)');
      return;
    }
    try {
      await apiPost(`/invoices/${id}/cancel`, { note: cancelNote.trim() || 'Canceled from History' });
      setPendingCancel(null);
      setCancelNote('');
      setCancelError('');
      showToast('Invoice canceled', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function exportExcel() {
    const rows = filtered.map(e => ({
      Category: CATEGORY_LABELS[e.category] || e.category,
      Invoice: e.invoice_no,
      Date: e.invoice_date,
      '21K (g)': e.weight_21k, '21K (SAR)': e.amount_21k,
      '18K (g)': e.weight_18k, '18K (SAR)': e.amount_18k,
      '24K (g)': e.weight_24k, '24K (SAR)': e.amount_24k,
      'Silver (g)': e.weight_silver, 'Silver (SAR)': e.amount_silver,
      Total: e.total_amount, Cash: e.cash_amount, Card: e.card_amount,
      Status: e.status, Contact: e.contact_name || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'History');
    XLSX.writeFile(wb, `swag-gold-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Swag Gold — History', 30, 30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
    doc.text(`${filtered.length} invoices · Total ${totals.total.toLocaleString('en-US', { maximumFractionDigits: 2 })} SAR · Exported ${new Date().toLocaleString()}`, 30, 46);

    const headers = ['Category', 'Invoice', 'Date', 'Total', 'Cash', 'Card', 'Status'];
    const colX = [30, 170, 240, 310, 380, 440, 500];
    let y = 70;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30);
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 6;
    doc.setDrawColor(200); doc.line(30, y, 780, y); y += 14;

    doc.setFont('helvetica', 'normal');
    filtered.forEach(e => {
      if (y > 560) { doc.addPage(); y = 40; }
      const row = [
        CATEGORY_LABELS[e.category] || e.category,
        String(e.invoice_no),
        e.invoice_date,
        Number(e.total_amount || 0).toLocaleString(),
        Number(e.cash_amount || 0).toLocaleString(),
        Number(e.card_amount || 0).toLocaleString(),
        e.status,
      ];
      row.forEach((val, i) => doc.text(String(val), colX[i], y));
      y += 16;
    });

    doc.save(`swag-gold-history-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function toK21(w, k) { return w * (k / 21); }
  function calcConv(e) {
    return (Number(e.weight_21k) || 0)
      + toK21(Number(e.weight_18k) || 0, 18)
      + toK21(Number(e.weight_24k) || 0, 24);
  }

  function shareWhatsApp(e) {
    const conv = calcConv(e);
    const msg = `*Swag Gold — ${CATEGORY_LABELS[e.category] || e.category}*\n`
      + `Invoice: ${e.invoice_no} | Date: ${e.invoice_date}\n`
      + `Status: ${e.status === 'canceled' ? 'Canceled' : 'Active'}\n`
      + `Total: SAR ${Number(e.total_amount || 0).toLocaleString()}\n`
      + `Cash: ${Number(e.cash_amount || 0).toLocaleString()} | Card: ${Number(e.card_amount || 0).toLocaleString()}\n`
      + (conv > 0 ? `21K Equivalent: ${conv.toFixed(2)}g\n` : '');
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  }

  function printSingleInvoice(e) {
    const conv = calcConv(e);
    const win = window.open('', '_blank', 'width=380,height=600');
    win.document.write(`
      <html><head><title>Invoice #${e.invoice_no}</title>
      <style>
        body{font-family:monospace;padding:24px;max-width:380px;margin:auto;color:#111;}
        h2{font-family:serif;margin-bottom:2px;}
        .sub{font-size:12px;color:#666;margin-bottom:16px;}
        .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px;}
        .row:last-child{font-weight:700;font-size:16px;border-bottom:none;margin-top:6px;}
        hr{border:none;border-top:1px dashed #bbb;margin:10px 0;}
      </style></head><body>
      <h2>Swag Gold</h2>
      <div class="sub">${CATEGORY_LABELS[e.category] || e.category}${e.status === 'canceled' ? ' — CANCELED' : ''}</div>
      <hr>
      <div class="row"><span>Invoice</span><span>${e.invoice_no}</span></div>
      <div class="row"><span>Date</span><span>${e.invoice_date}</span></div>
      ${e.description ? `<div class="row"><span>Description</span><span>${e.description}</span></div>` : ''}
      <hr>
      ${e.weight_21k ? `<div class="row"><span>21K</span><span>${e.weight_21k}g — SAR ${Number(e.amount_21k || 0).toLocaleString()}</span></div>` : ''}
      ${e.weight_18k ? `<div class="row"><span>18K</span><span>${e.weight_18k}g — SAR ${Number(e.amount_18k || 0).toLocaleString()}</span></div>` : ''}
      ${e.weight_24k ? `<div class="row"><span>24K</span><span>${e.weight_24k}g — SAR ${Number(e.amount_24k || 0).toLocaleString()}</span></div>` : ''}
      ${e.weight_silver ? `<div class="row"><span>Silver</span><span>${e.weight_silver}g — SAR ${Number(e.amount_silver || 0).toLocaleString()}</span></div>` : ''}
      ${conv > 0 ? `<div class="row"><span>21K Equivalent</span><span>${conv.toFixed(2)}g</span></div>` : ''}
      <hr>
      <div class="row"><span>Cash</span><span>SAR ${Number(e.cash_amount || 0).toLocaleString()}</span></div>
      <div class="row"><span>Card</span><span>SAR ${Number(e.card_amount || 0).toLocaleString()}</span></div>
      <div class="row"><span>Total</span><span>SAR ${Number(e.total_amount || 0).toLocaleString()}</span></div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 200);
  }

  if (loading) return <div className="page-subtitle">Loading…</div>;

  return (
    <section className="view active">
      <div className="topbar">
        <div>
          <div className="page-title">{t('hist.title')}</div>
          <div className="page-subtitle">{t('hist.subtitle')}</div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={exportPDF}>{t('hist.pdfExport')}</button>
          <button className="btn gold" onClick={exportExcel}>{t('hist.excelExport')}</button>
        </div>
      </div>

      <div className="panel">
        <div className="filters-row">
          <div className="form-field"><label>{t('hist.fromDate')}</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="form-field"><label>{t('hist.toDate')}</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="form-field">
            <label>{t('common.category')}</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">{t('hist.allCategories')}</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>{t('common.status')}</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">{t('hist.allStatus')}</option>
              <option value="active">{t('hist.active')}</option>
              <option value="canceled">{t('hist.canceled')}</option>
            </select>
          </div>
          <div className="form-field">
            <label>{t('hist.sort')}</label>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="date_desc">{t('hsort.datedesc')}</option>
              <option value="date_asc">{t('hsort.dateasc')}</option>
              <option value="amount_desc">{t('hsort.amtdesc')}</option>
              <option value="amount_asc">{t('hsort.amtasc')}</option>
              <option value="inv_desc">{t('hsort.invdesc')}</option>
              <option value="inv_asc">{t('hsort.invasc')}</option>
            </select>
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
            <label>{t('hist.search')}</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('hist.searchPlaceholder')} />
          </div>
        </div>

        {error && <div className="login-err" style={{ display: 'block' }}>⚠ {error}</div>}

        <div className="hist-summary">
          {filtered.length} invoices · Total {totals.total.toLocaleString('en-US', { maximumFractionDigits: 2 })} SAR
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('common.category')}</th><th>{t('common.invoice')}</th><th>{t('common.date')}</th>
                <th>21K (g/SAR)</th><th>18K (g/SAR)</th><th>24K (g/SAR)</th><th>Silver</th>
                <th>{t('common.total')} (SAR)</th><th>{t('common.cash')}</th><th>{t('common.card')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(e => (
                <tr key={e.id} className={e.status === 'canceled' ? 'canceled-row' : ''} data-inv={e.invoice_no} id={`hist-row-${e.id}`}>
                  <td>{CATEGORY_LABELS[e.category] || e.category}</td>
                  <td>
                    <span style={{ cursor: 'pointer', color: 'var(--gold-21)', fontWeight: 600 }} onClick={() => setDetailEntry(e)}>
                      {e.invoice_no}
                    </span>
                  </td>
                  <td>{e.invoice_date}</td>
                  <td>{e.weight_21k || 0}g / {e.amount_21k || 0}</td>
                  <td>{e.weight_18k || 0}g / {e.amount_18k || 0}</td>
                  <td>{e.weight_24k || 0}g / {e.amount_24k || 0}</td>
                  <td>{e.weight_silver || 0}g / {e.amount_silver || 0}</td>
                  <td>{Number(e.total_amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                  <td>{e.cash_amount || 0}</td>
                  <td>{e.card_amount || 0}</td>
                  <td>{e.status}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {e.status !== 'canceled' && user?.role !== 'cashier' && (
                      <Link className="btn ghost sm" to={`/entry/${e.id}`}>Edit</Link>
                    )}
                    {e.status !== 'canceled' && user?.role !== 'cashier' && (
                      <button className="btn ghost sm" onClick={() => setPendingCancel(e)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--cream-faint)' }}>{t('hist.noEntries')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="hist-pager" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 }}>
            <button className="btn sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>{t('pg.prev')}</button>
            <span className="hist-pager-info" style={{ fontSize: 14, color: 'var(--cream-dim)', fontFamily: "'IBM Plex Mono', monospace" }}>
              {tf('pg.showing', { a: (safePage - 1) * PAGE_SIZE + 1, b: Math.min(safePage * PAGE_SIZE, filtered.length), n: filtered.length })}
              {'  ·  '}
              {tf('pg.page', { p: safePage, t: totalPages })}
            </span>
            <button className="btn sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>{t('pg.next')}</button>
          </div>
        )}
      </div>

      {detailEntry && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,6,13,.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setDetailEntry(null); }}
        >
          <div className="panel" style={{ width: 460, maxWidth: '92vw', maxHeight: '84vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="page-title" style={{ fontSize: 18 }}>#{detailEntry.invoice_no}</div>
              <button className="btn ghost sm" onClick={() => setDetailEntry(null)}>✕</button>
            </div>
            <div style={{ color: 'var(--cream-dim)', fontSize: 13, marginBottom: 16 }}>
              {CATEGORY_LABELS[detailEntry.category] || detailEntry.category} · {detailEntry.invoice_date} · {detailEntry.status}
            </div>

            {(detailEntry.weight_21k || detailEntry.weight_18k || detailEntry.weight_24k || detailEntry.weight_silver) ? (
              <div className="table-wrap" style={{ marginBottom: 16 }}>
                <table>
                  <thead><tr><th>Purity</th><th>Weight (g)</th><th>Amount (SAR)</th></tr></thead>
                  <tbody>
                    {detailEntry.weight_21k > 0 && <tr><td>21K</td><td>{detailEntry.weight_21k}</td><td>{Number(detailEntry.amount_21k || 0).toLocaleString()}</td></tr>}
                    {detailEntry.weight_18k > 0 && <tr><td>18K</td><td>{detailEntry.weight_18k}</td><td>{Number(detailEntry.amount_18k || 0).toLocaleString()}</td></tr>}
                    {detailEntry.weight_24k > 0 && <tr><td>24K</td><td>{detailEntry.weight_24k}</td><td>{Number(detailEntry.amount_24k || 0).toLocaleString()}</td></tr>}
                    {detailEntry.weight_silver > 0 && <tr><td>Silver</td><td>{detailEntry.weight_silver}</td><td>{Number(detailEntry.amount_silver || 0).toLocaleString()}</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--cream-dim)', fontSize: 13.5, marginBottom: 16 }}>{detailEntry.description || 'No description'}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)', fontWeight: 700 }}>
              <span>Total</span><span>SAR {Number(detailEntry.total_amount || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5, color: 'var(--cream-dim)' }}>
              <span>Cash / Card</span><span>{Number(detailEntry.cash_amount || 0).toLocaleString()} / {Number(detailEntry.card_amount || 0).toLocaleString()}</span>
            </div>
            {detailEntry.contact_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5, color: 'var(--cream-dim)' }}>
                <span>Contact</span><span>{detailEntry.contact_name}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => printSingleInvoice(detailEntry)}>⎙ Print Slip</button>
              <button className="btn gold" onClick={() => shareWhatsApp(detailEntry)}>📤 Share on WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {pendingCancel && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,6,13,.6)' }}
          onClick={e => { if (e.target === e.currentTarget) { setPendingCancel(null); setCancelNote(''); setCancelError(''); } }}
        >
          <div className="panel" style={{ width: 420, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="page-title" style={{ fontSize: 17 }}>Cancel Invoice</div>
              <button className="btn ghost sm" onClick={() => { setPendingCancel(null); setCancelNote(''); setCancelError(''); }}>✕</button>
            </div>
            <p style={{ color: 'var(--cream-dim)', fontSize: 14, marginBottom: 14 }}>
              Cancel invoice #{pendingCancel.invoice_no}? This cannot be undone from here.
            </p>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label>Reason {user?.role === 'supervisor' && '(required)'}</label>
              <input value={cancelNote} onChange={e => setCancelNote(e.target.value)} placeholder="Why is this being canceled?" />
            </div>
            {cancelError && <div className="login-err" style={{ display: 'block', marginBottom: 12 }}>⚠ {cancelError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => { setPendingCancel(null); setCancelNote(''); setCancelError(''); }}>Keep Invoice</button>
              <button className="btn danger" onClick={() => cancelEntry(pendingCancel.id)}>Cancel Invoice</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
