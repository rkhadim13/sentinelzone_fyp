// Central API client for the SentinelZone backend.
// Every function maps 1:1 to a backend endpoint; response shapes match
// what AppContext and the page components already expect.

export const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const TOKEN_KEY = 'sentinelzone_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

async function handleResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (body && (body.error || body.detail || JSON.stringify(body))) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return body;
}

function apiGet(path) {
  return fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } }).then(handleResponse);
}

function apiPost(path, { json, form } = {}) {
  const options = { method: 'POST', headers: { ...authHeaders() } };
  if (form) {
    options.body = form;
  } else if (json) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(json);
  }
  return fetch(`${API_BASE}${path}`, options).then(handleResponse);
}

function apiUpload(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Token ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      let body = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (err) {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        const message =
          (body && (body.error || body.detail || JSON.stringify(body))) ||
          `Request failed with status ${xhr.status}`;
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));

    xhr.send(form);
  });
}

async function apiGetBlob(path, { method = 'GET' } = {}) {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: { ...authHeaders() } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.error) || `Request failed with status ${res.status}`);
  }
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'download.pdf';
  const blob = await res.blob();
  return { blob, filename };
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------

export const accountsApi = {
  signup: (payload) => apiPost('/api/auth/signup/', { json: payload }),
  login: (payload) => apiPost('/api/auth/login/', { json: payload }),
  forgotPassword: (email) => apiPost('/api/auth/forgot-password/', { json: { email } }),
  deleteAccount: () => apiPost('/api/auth/delete-account/'),
  me: () => apiGet('/api/auth/me/'),
  updateProfile: (payload) => apiPost('/api/auth/profile/', { json: payload }),
  changePassword: (payload) => apiPost('/api/auth/change-password/', { json: payload }),
};

// ---------------------------------------------------------------------
// Evidence Vault
// ---------------------------------------------------------------------

export const evidenceApi = {
  list: (caseId) => apiGet(`/api/evidence/${caseId ? `?case_id=${caseId}` : ''}`),

  upload: ({ title, type, file, text, reason, caseId, onProgress }) => {
    const form = new FormData();
    if (file) form.append('file', file);
    else form.append('text', text);
    if (title) form.append('title', title);
    if (type) form.append('type', type);
    if (reason) form.append('reason', reason);
    if (caseId) form.append('case_id', caseId);
    return apiUpload('/api/evidence/upload/', form, onProgress);
  },

  analyze: (id) => apiPost(`/api/evidence/${id}/analyze/`),

  verify: (id) => apiGet(`/api/evidence/${id}/verify/`),

  export: (id) => apiGetBlob(`/api/evidence/${id}/export/`),

  // URL builder for inline <img>/<audio>/<video> tags.
  // Auth travels as ?token= because HTML media tags can't set headers.
  fileUrl: (id) => {
    const token = getToken();
    const base = `${API_BASE}/api/evidence/${id}/file/`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  },

  // Chain-of-custody log + integrity verdict.
  events: (id) => apiGet(`/api/evidence/${id}/events/`),
};

// ---------------------------------------------------------------------
// Conversation Timeline
// ---------------------------------------------------------------------

export const timelineApi = {
  analyze: ({ contactLabel, platform, caseId, messages }) =>
    apiPost('/api/timeline/analyze/', {
      json: {
        contact_label: contactLabel,
        platform,
        case_id: caseId || undefined,
        messages,
      },
    }),

  importRaw: ({ rawText, contactLabel, platform, caseId, myName }) =>
    apiPost('/api/timeline/import/', {
      json: {
        raw_text: rawText,
        contact_label: contactLabel || undefined,
        platform: platform || undefined,
        case_id: caseId || undefined,
        my_name: myName || undefined,
      },
    }),
};

// ---------------------------------------------------------------------
// Reports / Cases
// ---------------------------------------------------------------------

export const reportsApi = {
  listCases: () => apiGet('/api/reports/cases/'),
  createCase: ({ title, date, platform, status }) =>
    apiPost('/api/reports/cases/', { json: { title, date, platform, status } }),
  exportCase: (caseId) => apiGetBlob(`/api/reports/case/${caseId}/export/`, { method: 'POST' }),
};

// ---------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------

export const platformsApi = {
  list: () => apiGet('/api/platforms/'),
  toggle: (name) => apiPost(`/api/platforms/${encodeURIComponent(name)}/toggle/`),
};

// ---------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------

export const alertsApi = {
  list: () => apiGet('/api/alerts/'),
  clearAll: () => apiPost('/api/alerts/clear/'),
  saveToVault: (id) => apiPost(`/api/alerts/${id}/save-to-vault/`),
  stats: () => apiGet('/api/alerts/stats/'),
};