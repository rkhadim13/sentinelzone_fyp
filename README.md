# SentinelZone — Integrated Build (Member-2 backend + Member-3 frontend)

This package is Member-3's React frontend (`sentinelzone-main`, design
final/unchanged) now actually wired up to Member-2's real backend
(Django + FastAPI ML service + WebSocket alert relay), instead of the
frontend's original mocked, in-memory data.

## What changed to make them compatible

Member-2's backend was already built to match the frontend's field
names and shapes exactly (see `docs/api_contracts.md`), but nothing in
`src/` actually called it — every screen ran on `setTimeout`/`Math.random`
mocks, hardcoded arrays, and client-side `crypto.subtle` hashing. This
build closes that gap:

| File | Before | Now |
|---|---|---|
| `frontend/src/services/api.js` | *(didn't exist)* | New central client for every backend endpoint |
| `frontend/src/AppContext.js` | Local state + client-side hashing + jsPDF | Fetches real evidence/platforms, calls real upload/verify/export/login/signup |
| `AIContentChecker.js` | Fake `setTimeout` + `Math.random()` confidence | Uploads to Evidence Vault, calls the real ML service via Django |
| `ConversationTimeline.js` | Hardcoded flagged messages | Sends the thread to the real pattern classifier |
| `ReportGenerator.js` | Hardcoded `cases` array, client PDF | Fetches real cases (+ "New Case"), downloads server-generated PDF |
| `Login.js` | `console.log`, no real auth | Calls `/api/auth/signup` / `/api/auth/login`, stores token |
| `Navbar.js` (logout) | Just navigated to `/login` | Actually clears the stored auth token |
| `Settings.js` | Separate hardcoded "Connected Accounts" list | Now reflects the real `platforms` state |
| `Dashboard.js` | 3 hardcoded alerts + live socket | Real alert history from the backend + live socket pushes |
| `services/socket.js` | Hardcoded `ws://localhost:4000` | Same default, now overridable via `REACT_APP_ALERT_WS_URL` |

No visual/UX changes were made — every component still renders the
same layout, copy, and styles Member-3 built. `ForgotPassword.js` is
left as its original phone+OTP demo flow, since the backend's
`forgot-password` endpoint is email-based and the two aren't a natural
fit; wire that up as a follow-up if you want OTP delivered for real.

## Run everything with Docker (recommended)

```bash
docker compose up --build
```

This starts all four services:

| Service | Port |
|---|---|
| `frontend` (React dev server) | http://localhost:3000 |
| `backend` (Django + DRF) | http://localhost:8000 |
| `ml_service` (FastAPI) | http://localhost:8001 |
| `alert_server` (WebSocket relay) | ws://localhost:4000 (+ :4001 internal) |

Open **http://localhost:3000** and sign up — everything from there
(Evidence Vault, AI Checker, Timeline, Reports, Platforms, live alerts)
talks to the real backend.

## Run it locally (four terminals)

```bash
# 1) Django backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000

# 2) ML service
cd ml_service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001

# 3) Alert relay
cd alert_server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py

# 4) Frontend
cd frontend
npm install
npm start
```

The frontend reads `REACT_APP_API_BASE_URL` and `REACT_APP_ALERT_WS_URL`
from `frontend/.env` (already set to `http://localhost:8000` and
`ws://localhost:4000`) — no code changes needed if you keep the default
ports.

## What's real vs. a stub

- Evidence hashing, chain-of-custody, verify, PDF export (both single
  evidence and full case reports), timeline classifier, alerts,
  platforms, accounts, and now the **frontend wiring itself**: real.
- ML deepfake/AI-content detection: still a **deterministic stub**
  (hash-derived confidence, no actual model) — see
  `docs/security_checklist.md` before relying on it beyond a demo.

## Notes on data

The backend starts with an empty database (no seeded demo evidence or
cases) — that's normal for a "final" build. Evidence populates itself
as you use the AI Checker and Conversation Timeline; create a Case from
the Report Generator screen ("+ New Case") to start building a report.



# SentinelZone — AI Content Checker

A full-stack AI content detection platform that identifies deepfakes and AI-generated images, audio, and text.

## Architecture

- **backend/** — Django REST API (auth, evidence vault, alerts, ML orchestration)
- **ml_service/** — FastAPI microservice (image, audio, video inference)
- **alert_server/** — Node.js WebSocket server for real-time alerts
- **frontend/** — React UI

## Tech Stack

- Django 4.2, FastAPI, Node.js
- PyTorch, Hugging Face Transformers
- React

## Setup

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/YOUR_USERNAME/sentinelzone.git
cd sentinelzone
\`\`\`

### 2. Setup the ML Service
\`\`\`bash
cd ml_service
python -m venv venv
venv\Scripts\activate     # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
\`\`\`

On first run, the image model (~350 MB) will download automatically into `ml_service/hf_cache/`.

### 3. Setup the Django Backend
\`\`\`bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
\`\`\`

### 4. Setup the Alert Server
\`\`\`bash
cd alert_server
npm install
npm start
\`\`\`

### 5. Start the Frontend
\`\`\`bash
cd frontend
npm install
npm start
\`\`\`

## Notes

- Model weights are not included in this repo. They download on first run.
- Each service keeps its own `hf_cache/` folder for offline inference.

## License

Private project — not for redistribution.