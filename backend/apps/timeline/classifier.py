"""
Lightweight, explainable keyword-pattern classifier for conversation
messages -- a real, server-side implementation of the pattern-flagging
logic that Member-3's src/components/ConversationTimeline.js currently
hardcodes as static mock data (flagged / reason per message).

Reason strings intentionally match the frontend's existing vocabulary:
  - "Threat / Intimidation"
  - "Threat / Blackmail Pattern"
  - "Sextortion / Blackmail"
  - "Urgency / Financial Fraud Pattern"
  - "Isolation Tactic (Grooming Pattern)"
  - "Harassment Pattern"
"""
import re

PATTERNS = [
    {
        "reason": "Sextortion / Blackmail",
        "risk": "High",
        "keywords": [
            r"\bsend (a |me )?(nude|explicit|photo)",
            r"\bexplicit (image|photo|video)s?\b",
            r"\bshare (it|your photos?|this) (everywhere|with everyone)\b",
        ],
    },
    {
        "reason": "Threat / Blackmail Pattern",
        "risk": "High",
        "keywords": [
            r"\bi'?ll (share|post|leak|expose)\b",
            r"\bor (i'?ll|else)\b",
            r"\bsend (a )?photo of yourself or\b",
        ],
    },
    {
        "reason": "Threat / Intimidation",
        "risk": "High",
        "keywords": [
            r"\bi (know where|will find|will hurt|will come)\b",
            r"\bwatch your back\b",
            r"\byou'?ll regret\b",
        ],
    },
    {
        "reason": "Urgency / Financial Fraud Pattern",
        "risk": "Medium",
        "keywords": [
            r"\bsend (me )?money\b",
            r"\burgent(ly)?\b",
            r"\bemergency\b.*\bmoney\b",
            r"\bgift card\b",
            r"\bbank (details|account)\b",
            r"\bwire transfer\b",
        ],
    },
    {
        "reason": "Isolation Tactic (Grooming Pattern)",
        "risk": "High",
        "keywords": [
            r"\bdo not tell (anyone|your parents|your friends)\b",
            r"\bdon'?t tell (anyone|your parents|your friends)\b",
            r"\bkeep this (a )?secret\b",
            r"\bjust between us\b",
        ],
    },
    {
        "reason": "Harassment Pattern",
        "risk": "Medium",
        "keywords": [
            r"\bstop (messaging|texting|calling) me\b",  # (from the recipient's side -> repeated contact)
            r"\bleave me alone\b",
            r"\byou (always|never)\b.*\b(annoying|worthless|stupid)\b",
        ],
    },
]

_COMPILED = [
    {**p, "regexes": [re.compile(k, re.IGNORECASE) for k in p["keywords"]]}
    for p in PATTERNS
]


def classify_message(text: str):
    """Returns (flagged: bool, reason: str|None, risk: str|None)."""
    if not text:
        return False, None, None
    for pattern in _COMPILED:
        for rgx in pattern["regexes"]:
            if rgx.search(text):
                return True, pattern["reason"], pattern["risk"]
    return False, None, None


def escalation_level(flagged_risks: list) -> str:
    if any(r == "High" for r in flagged_risks):
        return "High"
    if any(r == "Medium" for r in flagged_risks):
        return "Medium"
    return "Low"
