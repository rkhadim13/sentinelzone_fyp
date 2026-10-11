# SentinelZone — Member-2 ↔ Member-3 API Contract

Member-3's repo (`sentinelzone-main`) is a Create-React-App + Capacitor
frontend. Right now **every** screen runs entirely on mocked, in-memory
data — there is no real backend call anywhere in `src/`:

| Frontend file                          | What it currently mocks                                            |
|-----------------------------------------|----------------------------------------------------------------------|
| `src/AppContext.js`                     | `evidenceList` (seed data), `addEvidence`, `verifyEvidence` (recomputes SHA-256 **in the browser** via `crypto.subtle`), `downloadEvidence` (client-side jsPDF), `platforms`, `liveAlerts`, `emailAlerts` |
| `src/components/AIContentChecker.js`    | `setTimeout(...)` + `Math.random()` fake confidence/verdict           |
| `src/components/ConversationTimeline.js`| Hardcoded `messages` array with `flagged`/`reason` already set       |
| `src/components/ReportGenerator.js`     | Hardcoded `cases` array + client-side jsPDF report                    |
| `src/components/ConnectSources.js`      | `platforms` toggle state, no persistence                              |
| `src/components/Dashboard.js`           | `services/socket.js` opens a **real** `ws://localhost:4000` socket and listens for `{sender, type, risk, time}` — but nothing has ever been listening on that port |
| `src/components/Login.js`               | Local form validation only, no auth call                              |

This backend package (Member-2) implements the real services behind
every one of those mocks, using the **same field names and value shapes**
the frontend already expects, so wiring it up is a drop-in replacement
rather than a rewrite.

---

## Services & ports

| Service        | Tech            | Port | Purpose |
|----------------|-----------------|------|---------|
| `backend`      | Django + DRF    | 8000 | Evidence Vault, Timeline classifier, Reports/Cases, Platforms, Accounts, Alerts history |
| `ml_service`   | FastAPI         | 8001 | `/infer/image`, `/infer/audio`, `/infer/video` — AI-content / deepfake stub |
| `alert_server` | websockets+aiohttp | 4000 (ws), 4001 (http) | Pushes live alerts to `ws://localhost:4000`, the exact URL hardcoded in `src/services/socket.js` |

---

## Evidence Vault — `apps/evidence`

Object shape returned by every evidence endpoint (matches
`evidenceList` items in `AppContext.js` field-for-field):

```json
{
  "id": "uuid",
  "caseId": "uuid|null",
  "title": "string",
  "type": "Image|Audio|Video|Text|File",
  "content": "string",
  "reason": "string",
  "hash": "sha256 hex",
  "verified": true,
  "timestamp": "2026-07-29 14:32",
  "dataUrl": "data:image/jpeg;base64,... (only if file < INLINE_DATA_URL_MAX_BYTES)",
  "fileUrl": "http://.../media/evidence/xyz.jpg",
  "mime_type": "image/jpeg",
  "source": "manual_upload"
}
```

| Endpoint | Replaces | Notes |
|---|---|---|
| `GET  /api/evidence/` | `evidenceList` | optional `?case_id=` filter |
| `POST /api/evidence/upload/` (multipart `file`, or JSON `text`) | `addEvidence({file/text, title, type, reason})` | returns the created item |
| `GET  /api/evidence/<id>/verify/` | `verifyEvidence(id)` | recomputes SHA-256 server-side, sets `verified` |
| `POST /api/evidence/<id>/analyze/` | AIContentChecker's fake `setTimeout` analysis | calls `ml_service`, auto-fills `reason` when confidence > 75 |
| `GET  /api/evidence/<id>/export/` | `downloadEvidence(id)` | returns the same single-item PDF, generated server-side with ReportLab instead of jsPDF |

---

## Conversation Timeline — `apps/timeline`

`POST /api/timeline/analyze/`

Request:
```json
{
  "contact_label": "Unknown Number",
  "platform": "WhatsApp",
  "case_id": "uuid|null",
  "messages": [
    {"sender": "them", "text": "Send me money urgently, it's an emergency.", "time": "10:07 AM"}
  ]
}
```

Response:
```json
{
  "conversation": { "...": "...", "messages": [{"...": "...", "flagged": true, "reason": "Urgency / Financial Fraud Pattern", "risk": "Medium"}] },
  "escalationLevel": "High",
  "flaggedCount": 2
}
```

Behavior mirrors the `useEffect` block in `ConversationTimeline.js`:
every flagged message is auto-saved as an Evidence item titled
`"Timeline - <reason>"`, and any `High`-risk finding is pushed as a live
alert (see below).

Reason strings are intentionally identical to the ones already hardcoded
in the frontend's mock `messages` array (`Threat / Blackmail Pattern`,
`Sextortion / Blackmail`, `Isolation Tactic (Grooming Pattern)`,
`Urgency / Financial Fraud Pattern`, `Harassment Pattern`).

---

## Reports / Cases — `apps/reports`

| Endpoint | Replaces |
|---|---|
| `GET  /api/reports/cases/` | the hardcoded `cases` array in `ReportGenerator.js` (`id, title, date, flaggedCount`) |
| `POST /api/reports/cases/` | create a case |
| `POST /api/reports/case/<case_id>/export/` | `handleDownload()` — returns the identical multi-section PDF (Case Overview / Evidence & Forensic Verification / Recommended Action / signature block) generated server-side |

---

## Platforms — `apps/platforms`

| Endpoint | Replaces |
|---|---|
| `GET  /api/platforms/` | `platforms` state → `{"WhatsApp": false, "Instagram": false, "Facebook": false}` |
| `POST /api/platforms/<name>/toggle/` | `togglePlatform(name)` |

---

## Accounts — `apps/accounts`

| Endpoint | Replaces |
|---|---|
| `POST /api/auth/signup/` | Login.js sign-up branch (`name,email,password,gender,dob,phone`) |
| `POST /api/auth/login/`  | Login.js login branch |
| `POST /api/auth/forgot-password/` | ForgotPassword.js |

Returns a DRF auth token (`{"token": "..."}`) the frontend should send
as `Authorization: Token <token>` on subsequent requests once it moves
past the current all-`AllowAny` MVP permissions.

---

## Live Alerts — `apps/alerts` + `alert_server`

`alert_server` listens on **`ws://localhost:4000`** — the exact URL
already hardcoded in `src/services/socket.js`. No frontend code changes
are required for the socket connection itself. Every message broadcast
has this shape, matching `onAlert()`'s expected fields in `Dashboard.js`:

```json
{ "sender": "Unknown Number", "type": "Threat / Blackmail Pattern", "risk": "High Risk", "time": "10:10 AM" }
```

`GET /api/alerts/` additionally returns alert history (last 100) so the
dashboard has data on first load / reconnect, not just live pushes.

---

## ML Service contract — `ml_service`

`POST <ML_SERVICE_URL>/infer/{image|audio|video}` (multipart `file`)

```json
{
  "category": "deepfake_image",
  "confidence": 87.3,
  "verdict": "Likely AI-Generated",
  "label": "likely_ai",
  "signals": {"note": "baseline_stub", "checks": ["compression_artifacts", "face_landmark_symmetry"]},
  "model": {"name": "stub-image-v1", "version": "0.1.0"}
}
```

`confidence` + `verdict` map directly onto the `result` state object
`AIContentChecker.js` already renders (`result.confidence`,
`result.verdict`) — no remapping needed on the frontend.

**This is a stub.** Swap `app/services/*_stub.py` for real model
inference calls before using this for anything beyond a demo.

---

## Suggested frontend follow-up (not included — Member-3's files untouched)

To wire this in, `AppContext.js` / the individual components would
replace their local `useState` + mock logic with `fetch()` calls to the
endpoints above, e.g.:

```js
const addEvidence = async ({ title, type, file, text, reason }) => {
  const form = new FormData();
  if (file) form.append('file', file); else form.append('text', text);
  form.append('title', title);
  if (type) form.append('type', type);
  if (reason) form.append('reason', reason);

  const res = await fetch(`${API_BASE}/api/evidence/upload/`, { method: 'POST', body: form });
  const item = await res.json();
  setEvidenceList((prev) => [item, ...prev]);
};
```

That's a decision for whoever owns `src/` next — this backend is ready
to receive those calls today.
