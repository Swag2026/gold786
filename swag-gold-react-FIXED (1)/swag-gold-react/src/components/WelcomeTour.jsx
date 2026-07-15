import { useState } from 'react';
import Modal from './Modal.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const STEPS = [
  { title: 'Welcome to Swag Gold', body: 'Your daily gold ledger — record sales, purchases, payments and expenses, and keep a running reconciliation of cash and gold.' },
  { title: 'New Entry', body: 'Press N anytime, or use the sidebar, to record a sale, purchase, supplier payment, or expense. Karat weights and rates calculate the total automatically.' },
  { title: 'Dashboard', body: 'See today\'s totals, a weight-distribution bar by purity, and close the day with a cash reconciliation whenever you\'re ready.' },
  { title: 'History & Reports', body: 'Filter, search, export to Excel or PDF, and pull real summary/daily reports straight from the backend.' },
  { title: 'You\'re ready', body: 'Press ? anytime to see keyboard shortcuts. Have a good exhibition day.' },
];

export default function WelcomeTour({ onClose }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  function finish() {
    localStorage.setItem('sg_tour_seen', '1');
    onClose();
  }

  return (
    <Modal title={STEPS[step].title} onClose={finish} width={420}>
      <p style={{ color: 'var(--cream-dim)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
        {STEPS[step].body}
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            height: 4, flex: 1, borderRadius: 2,
            background: i <= step ? 'var(--gold-21)' : 'var(--surface-3)',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn ghost" onClick={finish}>Skip</button>
        <button className="btn gold" onClick={() => isLast ? finish() : setStep(s => s + 1)}>
          {isLast ? t('tour.gotit') : 'Next'}
        </button>
      </div>
    </Modal>
  );
}
