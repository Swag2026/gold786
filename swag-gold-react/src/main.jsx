import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/globals.css';

// ── Global crash net ─────────────────────────────────────────────────
// React's ErrorBoundary only catches errors thrown during render — it
// misses async errors (inside useEffect, promise rejections, event
// handlers). Those crashes were the likely cause of "blank screen, error
// flashes in console and vanishes on reload": something failed silently
// in the background, leaving the UI stuck without React ever getting a
// chance to show anything. This shows ANY such error as a fixed on-page
// banner that stays up regardless of what React does afterward, so it
// can be read and screenshotted without racing DevTools.
function showCrashBanner(title, detail) {
  if (document.getElementById('__crash_banner')) return; // only show the first one
  const el = document.createElement('div');
  el.id = '__crash_banner';
  el.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;color:#111;' +
    'font-family:monospace;padding:32px;white-space:pre-wrap;word-break:break-word;' +
    'font-size:14px;line-height:1.6;overflow:auto;';
  el.innerHTML =
    '<h1 style="color:#c04840;font-size:20px;margin-bottom:16px;">⚠ ' + title + '</h1>' +
    '<div style="background:#fee;border:1px solid #c04840;border-radius:8px;padding:16px;margin-bottom:16px;">' +
    (detail || '').replace(/</g, '&lt;') + '</div>' +
    '<button onclick="location.reload()" style="padding:10px 20px;border-radius:8px;border:none;' +
    'background:#c9a227;font-weight:bold;cursor:pointer;">Reload page</button>';
  document.body.appendChild(el);
}
window.addEventListener('error', (e) => {
  showCrashBanner('Script error', (e.message || '') + '\n\nFile: ' + (e.filename || '?') + ':' + (e.lineno || '?') + '\n\n' + (e.error?.stack || ''));
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  showCrashBanner('Unhandled promise rejection', (reason?.message || String(reason)) + '\n\n' + (reason?.stack || ''));
});
// ─────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
