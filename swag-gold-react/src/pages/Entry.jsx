import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '../lib/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const CATEGORIES = [
  { key: 'sale', labelKey: 'entry.sale', hasKarat: true, contactKey: 'entry.customer' },
  { key: 'purchase_jewelry', labelKey: 'entry.purchaseJewelry', hasKarat: true, contactKey: 'entry.supplier' },
  { key: 'purchase_scrap', labelKey: 'entry.purchaseScrap', hasKarat: true, contactKey: 'entry.supplier' },
  { key: 'supplier_payment', labelKey: 'entry.supplierPayment', hasKarat: false, contactKey: 'entry.supplier' },
  { key: 'expense', labelKey: 'entry.expense', hasKarat: false, contactKey: null },
];

const KARATS = [
  { key: '21k', label: '21K' },
  { key: '18k', label: '18K' },
  { key: '24k', label: '24K' },
  { key: 'silver', label: 'Silver' },
];

const emptyKaratState = () => ({
  weight_21k: '', rate_21k: '',
  weight_18k: '', rate_18k: '',
  weight_24k: '', rate_24k: '',
  weight_silver: '', rate_silver: '',
});

export default function Entry() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { t, tf } = useLanguage();
  const isEdit = Boolean(id);

  const [category, setCategory] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [contactId, setContactId] = useState('');
  const [description, setDescription] = useState('');
  const [karat, setKarat] = useState(emptyKaratState());
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [dupWarning, setDupWarning] = useState('');

  function clearFieldError(name) {
    setFieldErrors(prev => (prev[name] ? { ...prev, [name]: false } : prev));
  }

  useEffect(() => {
    apiGet('/contacts').then(setContacts).catch(() => {});
  }, []);

  // Edit mode: load the existing invoice and prefill everything.
  useEffect(() => {
    if (!isEdit) return;
    apiGet(`/invoices/${id}`).then(inv => {
      setCategory(inv.category);
      setInvoiceNo(inv.invoice_no);
      setDate(inv.invoice_date);
      setContactId(inv.contact_id || '');
      setDescription(inv.description || '');
      setKarat({
        weight_21k: inv.weight_21k || '', rate_21k: inv.weight_21k ? (inv.amount_21k / inv.weight_21k) : '',
        weight_18k: inv.weight_18k || '', rate_18k: inv.weight_18k ? (inv.amount_18k / inv.weight_18k) : '',
        weight_24k: inv.weight_24k || '', rate_24k: inv.weight_24k ? (inv.amount_24k / inv.weight_24k) : '',
        weight_silver: inv.weight_silver || '', rate_silver: inv.weight_silver ? (inv.amount_silver / inv.weight_silver) : '',
      });
      setCash(inv.cash_amount || '');
      setCard(inv.card_amount || '');
    }).catch(err => setError(err.message))
      .finally(() => setLoadingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cat = CATEGORIES.find(c => c.key === category);

  const karatTotal = KARATS.reduce((sum, k) => {
    const w = Number(karat[`weight_${k.key}`]) || 0;
    const r = Number(karat[`rate_${k.key}`]) || 0;
    return sum + w * r;
  }, 0);
  const total = cat?.hasKarat ? karatTotal : (Number(cash) || 0) + (Number(card) || 0);

  // Live 21K-equivalent conversion note, matching the original's convNote —
  // helps at a glance compare mixed-purity entries on a common scale.
  const toK21 = (w, k) => w * (k / 21);
  const conv21 = cat?.hasKarat
    ? (Number(karat.weight_21k) || 0)
      + toK21(Number(karat.weight_18k) || 0, 18)
      + toK21(Number(karat.weight_24k) || 0, 24)
    : 0;

  function resetForm() {
    setInvoiceNo(''); setDate(new Date().toISOString().slice(0, 10));
    setContactId(''); setDescription(''); setKarat(emptyKaratState());
    setCash(''); setCard(''); setError(''); setErrors([]); setFieldErrors({});
  }

  async function openCategory(key) {
    setCategory(key);
    resetForm();
    try {
      const data = await apiGet(`/invoices?category=${key}&limit=2000`);
      const list = Array.isArray(data) ? data : data?.items || [];
      const nums = list
        .map(e => e.invoice_no)
        .filter(no => /^\d+$/.test(String(no).trim()))
        .map(no => parseInt(no, 10));
      if (nums.length) setInvoiceNo(String(Math.max(...nums) + 1));
    } catch (_) {
      // silent — suggestion is a convenience, not required
    }
  }

  async function checkDuplicate() {
    if (!invoiceNo.trim() || !category) { setDupWarning(''); return; }
    try {
      const matches = await apiGet(`/invoices?search=${encodeURIComponent(invoiceNo.trim())}&category=${category}&limit=10`);
      const list = Array.isArray(matches) ? matches : matches?.items || [];
      const dup = list.find(m => m.invoice_no === invoiceNo.trim() && String(m.id) !== String(id));
      setDupWarning(dup ? `⚠ Invoice #${invoiceNo.trim()} already exists for this category (created ${dup.invoice_date})` : '');
    } catch (_) {
      // silent — this is just a helpful heads-up, not a hard validation
    }
  }

  function quickSplit(mode) {
    if (mode === 'cash') { setCash(total); setCard(0); }
    else if (mode === 'card') { setCash(0); setCard(total); }
    else if (mode === 'half') { setCash((total / 2).toFixed(2)); setCard((total / 2).toFixed(2)); }
    else { setCash(''); setCard(''); }
  }

  async function saveEntry(e) {
    e.preventDefault();
    setError('');
    setErrors([]);
    setFieldErrors({});

    // ── Mandatory-field validation ───────────────────────────────────
    // The old check only looked at invoiceNo — a form could be saved with
    // every amount at 0 (cash+card both blank, or a weight typed with no
    // rate) because 0 == 0 "matched". These checks close that hole and
    // paint the offending fields red instead of silently accepting it.
    const newErrors = [];
    const newFieldErrors = {};

    if (!invoiceNo.trim()) { newErrors.push(t('val.invreq')); newFieldErrors.invoiceNo = true; }
    if (!date) { newErrors.push(t('val.datereq')); newFieldErrors.date = true; }
    if (isEdit && user?.role === 'supervisor' && !editNote.trim()) {
      newErrors.push(t('val.editnotereq'));
      newFieldErrors.editNote = true;
    }

    if (cat?.hasKarat) {
      if (karatTotal <= 0) {
        newErrors.push(t('val.noamount'));
        KARATS.forEach(k => { newFieldErrors[`rate_${k.key}`] = true; });
      } else {
        KARATS.forEach(k => {
          const w = Number(karat[`weight_${k.key}`]) || 0;
          const r = Number(karat[`rate_${k.key}`]) || 0;
          if (w > 0 && r <= 0) { newFieldErrors[`rate_${k.key}`] = true; }
          if (r > 0 && w <= 0) { newFieldErrors[`weight_${k.key}`] = true; }
        });
        if (KARATS.some(k => newFieldErrors[`rate_${k.key}`] || newFieldErrors[`weight_${k.key}`])) {
          newErrors.push(t('val.pairmismatch'));
        }
        const allocated = (Number(cash) || 0) + (Number(card) || 0);
        if (Math.abs(karatTotal - allocated) >= 0.01) {
          newErrors.push(tf('val.splitmismatch', { alloc: allocated.toLocaleString(), total: karatTotal.toLocaleString() }));
          newFieldErrors.cash = true; newFieldErrors.card = true;
        }
      }
    } else {
      if ((Number(cash) || 0) + (Number(card) || 0) <= 0) {
        newErrors.push(t('val.nopay'));
        newFieldErrors.cash = true; newFieldErrors.card = true;
      }
      if (!description.trim()) {
        newErrors.push(t('val.descreq'));
        newFieldErrors.description = true;
      }
    }

    if (newErrors.length) {
      setErrors(newErrors);
      setFieldErrors(newFieldErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoice_no: invoiceNo.trim(),
        invoice_date: date,
        category,
        contact_id: contactId ? Number(contactId) : null,
        weight_21k: Number(karat.weight_21k) || 0,
        weight_18k: Number(karat.weight_18k) || 0,
        weight_24k: Number(karat.weight_24k) || 0,
        weight_silver: Number(karat.weight_silver) || 0,
        amount_21k: (Number(karat.weight_21k) || 0) * (Number(karat.rate_21k) || 0),
        amount_18k: (Number(karat.weight_18k) || 0) * (Number(karat.rate_18k) || 0),
        amount_24k: (Number(karat.weight_24k) || 0) * (Number(karat.rate_24k) || 0),
        amount_silver: (Number(karat.weight_silver) || 0) * (Number(karat.rate_silver) || 0),
        cash_amount: Number(cash) || 0,
        card_amount: Number(card) || 0,
        total_amount: cat?.hasKarat ? karatTotal : (Number(cash) || 0) + (Number(card) || 0),
        description: description || null,
      };
      if (isEdit) {
        payload.note = editNote.trim();
        await apiPut(`/invoices/${id}`, payload);
      } else {
        await apiPost('/invoices', payload);
      }
      navigate('/history', { state: { flashInvoice: invoiceNo.trim() } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingExisting) return <div className="page-subtitle">Loading invoice…</div>;

  if (!category) {
    return (
      <section className="view active">
        <div className="topbar">
          <div>
            <div className="page-title">{t('entry.title')}</div>
            <div className="page-subtitle">{t('entry.subtitle')}</div>
          </div>
        </div>
        <div className="entry-launcher-grid">
          {CATEGORIES.map(c => (
            <div key={c.key} className="entry-launcher-tile" onClick={() => openCategory(c.key)}>
              <div className="entry-launcher-icon">◆</div>
              <div className="entry-launcher-label">{t(c.labelKey)}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="view active">
      <div className="topbar">
        <div>
          <div className="page-title">{isEdit ? t('entry.editTitle') : t('entry.title')}</div>
          <div className="page-subtitle">{t(cat.labelKey)}</div>
        </div>
      </div>
      {!isEdit && (
        <div className="entry-breadcrumb">
          <span onClick={() => setCategory(null)} style={{ cursor: 'pointer' }}>← {t('entry.title')}</span>
          <span className="entry-breadcrumb-sep"> / </span>
          <span>{t(cat.labelKey)}</span>
        </div>
      )}

      <form className="panel" onSubmit={saveEntry}>
        {errors.length > 0 && (
          <div className="form-error-summary">
            <div className="alert warn" style={{ padding: 10, borderRadius: 8 }}>
              <span className="alert-icon">⚠</span>
              <div>{errors.map((msg, i) => <div key={i}>• {msg}</div>)}</div>
            </div>
          </div>
        )}
        {isEdit && (
          <div className="form-field" style={{ marginBottom: 18 }}>
            <label className={user?.role === 'supervisor' ? 'req' : ''}>{t('entry.editNote')} {user?.role === 'supervisor' && '(required)'}</label>
            <input
              className={fieldErrors.editNote ? 'input-error' : ''}
              value={editNote}
              onChange={e => { setEditNote(e.target.value); clearFieldError('editNote'); }}
              placeholder="Why is this entry being edited?"
            />
          </div>
        )}

        <div className="form-grid" style={{ marginBottom: 18 }}>
          <div className="form-field">
            <label className="req">{t('entry.invoiceNo')}</label>
            <input
              className={fieldErrors.invoiceNo ? 'input-error' : ''}
              value={invoiceNo}
              onChange={e => { setInvoiceNo(e.target.value); clearFieldError('invoiceNo'); }}
              onBlur={checkDuplicate}
              placeholder="e.g. 872"
            />
          </div>
          <div className="form-field">
            <label className="req">{t('common.date')}</label>
            <input
              type="date"
              className={fieldErrors.date ? 'input-error' : ''}
              value={date}
              onChange={e => { setDate(e.target.value); clearFieldError('date'); }}
            />
          </div>
        </div>

        {dupWarning && (
          <div className="alert warn" style={{ padding: 10, borderRadius: 8, marginBottom: 18 }}>{dupWarning}</div>
        )}

        {cat.contactKey && (
          <div className="form-field" style={{ marginBottom: 18 }}>
            <label>{t(cat.contactKey)}</label>
            <select value={contactId} onChange={e => setContactId(e.target.value)}>
              <option value="">— No contact linked —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {!cat.hasKarat && (
          <div className="form-field" style={{ marginBottom: 18 }}>
            <label className="req">{t('entry.description')}</label>
            <input
              className={fieldErrors.description ? 'input-error' : ''}
              value={description}
              onChange={e => { setDescription(e.target.value); clearFieldError('description'); }}
              placeholder="e.g. Al Rashid Supplier — invoice settlement"
            />
          </div>
        )}

        {cat.hasKarat && (
          <div id="karatBlocks">
            {KARATS.map(k => (
              <div className="form-grid wide" key={k.key} style={{ marginBottom: 12 }}>
                <div className="form-field">
                  <label>{k.label} — {t('entry.weight')}</label>
                  <input
                    type="number" min="0" step="0.001" placeholder="0"
                    className={fieldErrors[`weight_${k.key}`] ? 'input-error' : ''}
                    value={karat[`weight_${k.key}`]}
                    onChange={e => { setKarat(s => ({ ...s, [`weight_${k.key}`]: e.target.value })); clearFieldError(`weight_${k.key}`); }}
                  />
                </div>
                <div className="form-field">
                  <label>{k.label} — {t('entry.rate')}</label>
                  <input
                    type="number" min="0" step="0.01" placeholder="0"
                    className={fieldErrors[`rate_${k.key}`] ? 'input-error' : ''}
                    value={karat[`rate_${k.key}`]}
                    onChange={e => { setKarat(s => ({ ...s, [`rate_${k.key}`]: e.target.value })); clearFieldError(`rate_${k.key}`); }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="form-grid wide" id="paySplit">
          <div className="form-field">
            <label>{t('entry.cash')}</label>
            <input
              type="number" min="0" step="0.01" placeholder="0"
              className={fieldErrors.cash ? 'input-error' : ''}
              value={cash}
              onChange={e => { setCash(e.target.value); clearFieldError('cash'); }}
            />
          </div>
          <div className="form-field">
            <label>{t('entry.card')}</label>
            <input
              type="number" min="0" step="0.01" placeholder="0"
              className={fieldErrors.card ? 'input-error' : ''}
              value={card}
              onChange={e => { setCard(e.target.value); clearFieldError('card'); }}
            />
          </div>
        </div>

        {cat.hasKarat && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '-4px 0 16px' }}>
            <button type="button" className="btn ghost sm" onClick={() => quickSplit('cash')}>{t('entry.allCash')}</button>
            <button type="button" className="btn ghost sm" onClick={() => quickSplit('card')}>{t('entry.allCard')}</button>
            <button type="button" className="btn ghost sm" onClick={() => quickSplit('half')}>{t('entry.split5050')}</button>
            <button type="button" className="btn ghost sm" onClick={() => quickSplit('clear')}>{t('entry.clearSplit')}</button>
          </div>
        )}

        <div className="form-total">
          <div>
            <div className="form-total-label">{t('entry.totalAmount')}</div>
            <div className="form-total-value">{total.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            {cat?.hasKarat && conv21 > 0 && (
              <div className="form-total-sub">◆ {conv21.toFixed(2)}g in 21K equivalent</div>
            )}
          </div>
        </div>

        {error && <div className="login-err" style={{ display: 'block', marginTop: 12 }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn gold" type="submit" disabled={saving}>{saving ? 'Saving…' : (isEdit ? t('entry.update') : t('entry.save'))}</button>
          {!isEdit && <button className="btn" type="button" onClick={resetForm}>{t('entry.clearForm')}</button>}
          <button className="btn ghost" type="button" style={{ marginLeft: 'auto' }} onClick={() => navigate('/history')}>{t('common.cancel')}</button>
        </div>
      </form>
    </section>
  );
}
