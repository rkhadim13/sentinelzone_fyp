"""
SHA-256 hashing helpers.

Mirrors the browser-side implementation in Member-3's src/AppContext.js
(computeHash, using crypto.subtle.digest('SHA-256', ...)) so that a hash
computed in the browser and a hash recomputed here will always match for
the same bytes.
"""
import hashlib
import json


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_fileobj(fileobj) -> str:
    h = hashlib.sha256()
    fileobj.seek(0)
    for chunk in iter(lambda: fileobj.read(1024 * 1024), b""):
        h.update(chunk)
    fileobj.seek(0)
    return h.hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def event_hash(prev_hash, payload_obj: dict) -> str:
    """Chain-of-custody hash: sha256(prev_hash + canonical_json(payload))."""
    prev = prev_hash or ""
    payload = canonical_json(payload_obj)
    return sha256_bytes((prev + payload).encode("utf-8"))
