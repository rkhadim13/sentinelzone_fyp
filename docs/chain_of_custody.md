# Chain of Custody

Every `EvidenceItem` has an append-only `EvidenceEvent` log
(`apps/evidence/models.py`). Each event stores:

- `event_type`: `ingested` | `analyzed` | `verified` | `exported`
- `prev_event_hash`: the `event_hash` of the previous event for that item (or null for the first)
- `event_hash`: `sha256(prev_event_hash + canonical_json(payload))`
- `payload_json`: the details of what happened (source, sha256, ML result, verify result, export target)

Because each event's hash depends on the previous event's hash, the log
forms a simple hash chain per evidence item: altering or deleting a past
event breaks every hash after it, which is detectable by recomputing the
chain (`apps/evidence/hashing.py:event_hash`).

This is intentionally simple (no external anchoring, no blockchain) —
it's enough to prove internal consistency of the log and to demonstrate
the concept for a hackathon/MVP. For a real deployment, consider
periodically anchoring the latest `event_hash` per case to an external,
tamper-evident store (e.g. a signed log service or public timestamping
authority).
