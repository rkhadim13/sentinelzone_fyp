# Security checklist (MVP)

Implemented in this package:
- [x] Upload size limits (`MAX_UPLOAD_SIZE_BYTES`, Django's `DATA_UPLOAD_MAX_MEMORY_SIZE`)
- [x] Upload content-type allowlist (`ALLOWED_UPLOAD_CONTENT_TYPES`)
- [x] SHA-256 integrity hashing + recomputation on verify
- [x] Append-only, hash-chained chain-of-custody log per evidence item
- [x] CORS restricted to the frontend origin by default (`CORS_ALLOWED_ORIGINS`); wide-open only via explicit `CORS_ALLOW_ALL_ORIGINS=1` for local dev
- [x] Password strength + phone format validation on signup (mirrors Login.js's own regexes)
- [x] Auth tokens (DRF TokenAuthentication) issued on login/signup
- [x] Forgot-password endpoint never discloses whether an email exists

Not yet done — do before any real/production use:
- [ ] Lock down `DEFAULT_PERMISSION_CLASSES` (currently `AllowAny` for every endpoint so the two teams can integrate quickly) to `IsAuthenticated` where appropriate, and scope evidence/cases to the requesting user
- [ ] HTTPS/WSS everywhere (this MVP runs plain HTTP/WS on localhost)
- [ ] Rate limiting on `/api/auth/*` and `/api/evidence/upload/`
- [ ] Replace the ML service stubs with real, audited models before trusting `verdict`/`confidence` for anything beyond demo purposes
- [ ] Encrypt evidence files at rest (currently plain local disk under `MEDIA_ROOT`)
- [ ] Real email delivery + signed reset tokens for forgot-password
- [ ] Structured audit logging / SIEM export of the chain-of-custody events
