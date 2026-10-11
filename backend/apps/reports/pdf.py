"""
Server-side PDF generation with ReportLab that reproduces, section for
section, the two jsPDF reports Member-3 currently builds client-side:

  1. build_case_report()        <- src/components/ReportGenerator.js (handleDownload)
  2. build_single_evidence_report()  <- src/AppContext.js (downloadEvidence)

Keeping the layout identical means the PDF a user gets is the same
whether it was generated in the browser (offline/demo mode) or by this
backend (once Member-3 wires the "Download PDF" button to
GET/POST these endpoints instead of calling jsPDF directly).
"""
from datetime import datetime
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

NAVY = (28 / 255, 34 / 255, 255 / 255 * 0 + 48 / 255)  # #1c2230-ish header bar
GREY = (100 / 255, 100 / 255, 100 / 255)
DARK = (40 / 255, 40 / 255, 40 / 255)
LIGHT_LINE = (200 / 255, 200 / 255, 200 / 255)


def _wrap(c, text, font, size, max_width):
    c.setFont(font, size)
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if c.stringWidth(trial, font, size) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def build_case_report(case, evidence_qs) -> bytes:
    """Mirrors ReportGenerator.js -> handleDownload()."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    # Header bar
    c.setFillColorRGB(28 / 255, 34 / 255, 48 / 255)
    c.rect(0, height - 35, width, 35, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(15, height - 16, "SentinelZone")
    c.setFont("Helvetica", 10)
    c.drawString(15, height - 24, "Cyber Harassment, Fraud & Deepfake Detection Platform")
    c.drawString(15, height - 30, "OFFICIAL INCIDENT REPORT")

    y = height - 45

    c.setFillColorRGB(*GREY)
    c.setFont("Helvetica", 9)
    c.drawString(15, y, f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_id = f"SZ-{str(case.id)[:8]}-{str(int(datetime.now().timestamp()))[-6:]}"
    c.drawString(width - 15 - c.stringWidth(f"Report ID: {report_id}", "Helvetica", 9), y, f"Report ID: {report_id}")
    y -= 10

    c.setStrokeColorRGB(*LIGHT_LINE)
    c.line(15, y, width - 15, y)
    y -= 12

    flagged_count = case.flagged_count

    # 1. Case Overview
    c.setFillColorRGB(28 / 255, 34 / 255, 48 / 255)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(15, y, "1. Case Overview")
    y -= 8

    c.setFont("Helvetica", 11)
    c.setFillColorRGB(*DARK)
    fields = [
        ("Case Title", case.title),
        ("Date of Incident", case.date.strftime("%Y-%m-%d")),
        ("Flagged Messages", str(flagged_count)),
        ("Platform", case.platform),
        ("Status", case.status),
    ]
    for label, value in fields:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(18, y, f"{label}:")
        c.setFont("Helvetica", 11)
        c.drawString(70, y, str(value))
        y -= 8

    y -= 6
    c.setStrokeColorRGB(230 / 255, 230 / 255, 230 / 255)
    c.line(15, y, width - 15, y)
    y -= 12

    # 2. Evidence & Forensic Verification
    c.setFillColorRGB(28 / 255, 34 / 255, 48 / 255)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(15, y, "2. Evidence & Forensic Verification")
    y -= 8

    evidence_list = list(evidence_qs)
    tamper_failed = any(e.verified is False for e in evidence_list)
    evidence_fields = [
        ("Evidence Hash (SHA-256)", f"Included — {len(evidence_list)} item(s), see Evidence Vault"),
        ("Chain of Custody", "Verified"),
        ("Tamper Check", "FAILED — discrepancy found" if tamper_failed else "Passed — no discrepancies found"),
        ("Evidence Source", "SentinelZone Evidence Vault (auto-collected)"),
    ]
    c.setFillColorRGB(*DARK)
    for label, value in evidence_fields:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(18, y, f"{label}:")
        c.setFont("Helvetica", 11)
        wrapped = _wrap(c, str(value), "Helvetica", 11, width - 90)
        for line in wrapped:
            c.drawString(70, y, line)
            y -= 8

    y -= 6
    c.setStrokeColorRGB(230 / 255, 230 / 255, 230 / 255)
    c.line(15, y, width - 15, y)
    y -= 12

    # 3. Recommended Action
    c.setFillColorRGB(28 / 255, 34 / 255, 48 / 255)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(15, y, "3. Recommended Action")
    y -= 8

    c.setFillColorRGB(*DARK)
    recommendation = (
        "This case is recommended for formal submission to the FIA Cybercrime Wing for "
        "further investigation. All flagged evidence has been cryptographically hashed and "
        "is available in the Evidence Vault for chain-of-custody verification."
    )
    for line in _wrap(c, recommendation, "Helvetica", 11, width - 30):
        c.drawString(18, y, line)
        y -= 6
    y -= 10

    c.setStrokeColorRGB(150 / 255, 150 / 255, 150 / 255)
    c.rect(15, y - 30, width - 30, 30, fill=0, stroke=1)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20, y - 8, "For Official Use:")
    c.setFont("Helvetica", 10)
    c.drawString(20, y - 18, "Reviewing Officer: ______________________")
    c.drawString(20, y - 26, "Signature / Stamp: ______________________")

    c.setFont("Helvetica", 8)
    c.setFillColorRGB(150 / 255, 150 / 255, 150 / 255)
    c.drawString(15, 15, "Generated by SentinelZone — Cyber Harassment, Fraud & Deepfake Detection Platform")
    c.drawString(15, 10, "This document is system-generated and forensically traceable via Evidence Vault hash records.")
    c.drawString(width - 30 - c.stringWidth("Page 1 of 1", "Helvetica", 8), 10, "Page 1 of 1")

    c.showPage()
    c.save()
    return buf.getvalue()


def build_single_evidence_report(evidence_data: dict) -> bytes:
    """Mirrors AppContext.js -> downloadEvidence(). `evidence_data` is the
    dict produced by EvidenceItemSerializer (title/type/timestamp/reason/
    hash/verified/content/dataUrl)."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 50

    c.setFillColorRGB(28 / 255, 34 / 255, 48 / 255)
    c.rect(0, y - 30 + 50 - 30, width, 30, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(14, height - 19, "SentinelZone — Evidence Report")

    c.setFillColorRGB(20 / 255, 20 / 255, 20 / 255)
    y = height - 42

    c.setFont("Helvetica", 10)
    c.setFillColorRGB(120 / 255, 120 / 255, 120 / 255)
    c.drawString(14, y, f"Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    y -= 10

    c.setStrokeColorRGB(220 / 255, 220 / 255, 220 / 255)
    c.line(14, y, width - 14, y)
    y -= 8

    c.setFillColorRGB(20 / 255, 20 / 255, 20 / 255)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(14, y, "Evidence Details")
    y -= 8

    verified = evidence_data.get("verified")
    integrity = (
        "Verified — Hash Matches" if verified is True
        else "TAMPERED — Hash Mismatch" if verified is False
        else "Not Yet Verified"
    )
    fields = [
        ("Title", evidence_data.get("title", "")),
        ("Type", evidence_data.get("type", "")),
        ("Timestamp", evidence_data.get("timestamp", "")),
        ("Reason / Category", evidence_data.get("reason") or "N/A"),
        ("SHA-256 Hash", evidence_data.get("hash", "")),
        ("Integrity Status", integrity),
    ]
    c.setFont("Helvetica", 10)
    for label, value in fields:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(14, y, f"{label}:")
        c.setFont("Helvetica", 10)
        wrapped = _wrap(c, str(value), "Helvetica", 10, width - 60)
        for line in wrapped:
            c.drawString(55, y, line)
            y -= 7

    y -= 4
    c.setStrokeColorRGB(220 / 255, 220 / 255, 220 / 255)
    c.line(14, y, width - 14, y)
    y -= 8

    c.setFont("Helvetica-Bold", 12)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(14, y, "Content")
    y -= 8

    c.setFont("Helvetica", 10)
    has_file = bool(evidence_data.get("dataUrl") or evidence_data.get("fileUrl"))
    content_text = (
        f"Attached media file: {evidence_data.get('content', '')} (exported separately below)"
        if has_file else (evidence_data.get("content") or "[Not available for this legacy entry]")
    )
    for line in _wrap(c, content_text, "Helvetica", 10, width - 28):
        c.drawString(14, y, line)
        y -= 7
    y -= 6

    c.setStrokeColorRGB(220 / 255, 220 / 255, 220 / 255)
    c.line(14, y, width - 14, y)
    y -= 8
    c.setFont("Helvetica-Oblique", 9)
    c.setFillColorRGB(140 / 255, 140 / 255, 140 / 255)
    footer = (
        "This report was generated automatically by SentinelZone. The SHA-256 hash above serves "
        "as a cryptographic fingerprint of the original evidence at the time of capture, enabling "
        "tamper detection. This document may be submitted alongside the original evidence file to "
        "the FIA Cybercrime Wing or relevant platform as part of a formal complaint."
    )
    for line in _wrap(c, footer, "Helvetica-Oblique", 9, width - 28):
        c.drawString(14, y, line)
        y -= 6

    c.showPage()
    c.save()
    return buf.getvalue()
