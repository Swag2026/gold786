// Central place for the backend URL. Set VITE_API_BASE in Netlify env vars
// (Site settings → Environment variables) to point at your Railway backend,
// e.g. https://erpgold-production.up.railway.app/api
export const API_BASE = import.meta.env.VITE_API_BASE || 'https://erpgold-production.up.railway.app/api';

function authHeaders(json = true) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem('sg_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handle(res) {
  if (res.status === 401) {
    // token expired / invalid — force back to login, same behaviour as the
    // original doLogout() flow.
    localStorage.removeItem('sg_token');
    localStorage.removeItem('sg_user');
    window.location.reload();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.detail || body.message || msg;
    } catch (_) { /* no json body */ }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function apiGet(path) {
  const res = await fetch(API_BASE + path, { headers: authHeaders() });
  return handle(res);
}

export async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  });
  return handle(res);
}

export async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body)
  });
  return handle(res);
}

export async function apiDelete(path) {
  const res = await fetch(API_BASE + path, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return handle(res);
}
