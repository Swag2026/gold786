import Modal from './Modal.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const SHORTCUTS = [
  { desc: 'Open New Entry form', key: 'N' },
  { desc: 'Jump to History', key: '/' },
  { desc: 'Go to Dashboard', key: 'D' },
  { desc: 'Go to Activity Log', key: 'A' },
  { desc: 'Show keyboard shortcuts', key: '?' },
  { desc: 'Close any modal', key: 'Esc' },
];

export default function ShortcutsModal({ onClose }) {
  const { t } = useLanguage();
  return (
    <Modal title={t('mod.shortcuts')} onClose={onClose} width={420}>
      <p style={{ color: 'var(--cream-dim)', fontSize: 13.5, marginBottom: 14 }}>
        Speed up your workflow with these shortcuts.
      </p>
      <div>
        {SHORTCUTS.map(s => (
          <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13.5 }}>{s.desc}</span>
            <span style={{
              fontFamily: "'IBM Plex Mono',monospace", background: 'var(--surface-3)',
              border: '1px solid var(--line-2)', borderRadius: 5, padding: '2px 8px', fontSize: 12.5,
            }}>{s.key}</span>
          </div>
        ))}
      </div>
      <button className="btn gold" onClick={onClose} style={{ marginTop: 16 }}>{t('mod.gotit')}</button>
    </Modal>
  );
}
