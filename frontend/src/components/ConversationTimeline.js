import React, { useState, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { useAppContext } from '../AppContext';
import { timelineApi } from '../services/api';
import useIsMobile from '../useIsMobile';

// Matches the platforms actually supported elsewhere in the app
// (see AppContext.js's platforms state / Connect Sources page).
const PLATFORMS = ['WhatsApp', 'Instagram', 'Facebook'];

const TIME_IN_STAMP = /\d{1,2}:\d{2}(?::\d{2})?\s*(?:[APap]\.?[Mm]\.?)?/;
const LEADING_STAMP = /^\[?\s*[\d/.-]*[,\s]*\d{1,2}:\d{2}(?::\d{2})?\s*(?:[APap]\.?[Mm]\.?)?\s*\]?\s*[-–—]?\s*/;

// Shape of the placeholder bubbles shown while a check is running:
// alternating sides with varied widths so it reads as a real thread.
const SKELETON_BUBBLES = [false, true, false, false];
const SKELETON_WIDTHS = ['70%', '55%', '85%', '45%'];

// Pulse animation for skeleton placeholders; disabled for users who
// have reduced motion turned on. Same pattern as EvidenceVault.js.
const skeletonCss = `
  @keyframes sz-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  .sz-skeleton {
    display: inline-block;
    border-radius: 12px;
    animation: sz-pulse 1.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .sz-skeleton { animation: none; }
  }
`;

/**
 * Parses pasted chat text. Handles the common export shapes:
 *   [10:02 AM] Them: hello
 *   12/03/2024, 10:02 - John: hello
 *   Me: hello
 * Lines with no "Name:" prefix are treated as a continuation of the line above.
 */
export function parsePastedConversation(raw) {
  const out = [];
  let suggestedContact = '';

  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const stamp = trimmed.match(LEADING_STAMP);
    const body = stamp ? trimmed.slice(stamp[0].length) : trimmed;
    const timeMatch = stamp ? stamp[0].match(TIME_IN_STAMP) : null;
    const time = timeMatch ? timeMatch[0].trim() : '';

    const named = body.match(/^([^:]{1,30}?)\s*:\s*(.+)$/);

    if (named) {
      const name = named[1].trim();
      const isMe = /^(me|you|i|self)$/i.test(name);
      const isGeneric = /^(them|they|him|her|unknown|sender|other)$/i.test(name);
      if (!isMe && !isGeneric && !suggestedContact) suggestedContact = name;
      out.push({ sender: isMe ? 'me' : 'them', text: named[2].trim(), time });
    } else if (out.length > 0) {
      out[out.length - 1].text += ` ${body}`;
    } else {
      out.push({ sender: 'them', text: body, time });
    }
  });

  return { messages: out, suggestedContact };
}

function ConversationTimeline() {
  const { theme } = useTheme();
  const { refreshEvidence } = useAppContext();
  const isMobile = useIsMobile();

  // Form state
  const [contactLabel, setContactLabel] = useState('');
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [entryMode, setEntryMode] = useState('rows'); // 'rows' | 'paste'
  const [pasteText, setPasteText] = useState('');
  const nextRowId = useRef(3);
  const [rows, setRows] = useState([
    { id: 1, sender: 'them', text: '', time: '' },
    { id: 2, sender: 'me', text: '', time: '' },
  ]);

  // Result state
  const [messages, setMessages] = useState([]);
  const [escalationLevel, setEscalationLevel] = useState(null);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [analyzedContact, setAnalyzedContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      { id: nextRowId.current++, sender: last && last.sender === 'them' ? 'me' : 'them', text: '', time: '' },
    ]);
  };

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const removeRow = (id) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const clearForm = () => {
    setContactLabel('');
    setPasteText('');
    setRows([
      { id: nextRowId.current++, sender: 'them', text: '', time: '' },
      { id: nextRowId.current++, sender: 'me', text: '', time: '' },
    ]);
    setError(null);
  };

  const importPastedText = () => {
    const { messages: parsed, suggestedContact } = parsePastedConversation(pasteText);
    if (parsed.length === 0) {
      setError('No messages found in that text. Each line should look like "Them: hello".');
      return;
    }
    setRows(parsed.map((m, i) => ({ id: nextRowId.current + i, ...m })));
    nextRowId.current += parsed.length;
    if (!contactLabel && suggestedContact) setContactLabel(suggestedContact);
    setEntryMode('rows');
    setError(null);
  };

  // Turns the form into the payload the API expects.
  const collectMessages = () =>
    rows
      .map((r) => ({ sender: r.sender, text: r.text.trim(), time: r.time.trim() }))
      .filter((r) => r.text.length > 0);

  const analyzeThread = async () => {
    const payloadMessages = collectMessages();

    if (payloadMessages.length === 0) {
      setError('Add at least one message before analyzing.');
      return;
    }

    const label = contactLabel.trim() || 'Unknown contact';

    setLoading(true);
    setError(null);
    try {
      const data = await timelineApi.analyze({
        contactLabel: label,
        platform,
        messages: payloadMessages,
      });
      setMessages(data.conversation.messages);
      setEscalationLevel(data.escalationLevel);
      setFlaggedCount(data.flaggedCount);
      setAnalyzedContact(label);
      setHasAnalyzed(true);
      // Flagged messages are saved server-side; refresh the vault so
      // EvidenceVault.js picks them up.
      refreshEvidence();
    } catch (err) {
      setError(err.message || 'Failed to analyze conversation.');
    } finally {
      setLoading(false);
    }
  };

  const backToForm = () => {
    setMessages([]);
    setEscalationLevel(null);
    setFlaggedCount(0);
    setHasAnalyzed(false);
    setError(null);
  };

  const inputStyle = {
    ...styles.input,
    backgroundColor: theme.cardBackground,
    color: theme.text,
    border: `1px solid ${theme.border}`,
  };

  return (
    <div
      style={{
        ...styles.container,
        padding: isMobile ? '20px 14px' : '40px 20px',
        backgroundColor: theme.background,
        color: theme.text,
      }}
    >
      <h1 style={{ ...styles.title, fontSize: isMobile ? '22px' : '26px' }}>🧵 Conversation Timeline</h1>
      <p style={{ ...styles.subtitle, fontSize: isMobile ? '14px' : '16px', color: theme.textMuted }}>
        {hasAnalyzed
          ? `${analyzedContact} • ${flaggedCount} flagged ${flaggedCount === 1 ? 'message' : 'messages'} in this thread`
          : 'Enter a conversation below and it will be checked for threats and escalation.'}
      </p>

      {error && (
        <p style={{ ...styles.errorText, color: theme.danger || '#e05252' }}>⚠️ {error}</p>
      )}

      <style>{skeletonCss}</style>

      {loading && (
        <div style={styles.chatBox}>
          <p style={{ ...styles.loadingLabel, color: theme.textMuted }}>Checking this conversation...</p>
          {SKELETON_BUBBLES.map((fromMe, i) => (
            <div
              key={i}
              style={{ ...styles.messageRow, flexDirection: fromMe ? 'row-reverse' : 'row' }}
            >
              <span className="sz-skeleton" style={{ ...styles.avatar, backgroundColor: theme.border }} />
              <span
                className="sz-skeleton"
                style={{
                  ...styles.skeletonBubble,
                  width: SKELETON_WIDTHS[i],
                  backgroundColor: theme.border,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!hasAnalyzed && !loading && (
        <div style={{ ...styles.formCard, backgroundColor: theme.cardBackground, border: `1px solid ${theme.border}` }}>
          <div style={{ ...styles.fieldRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <label style={styles.field}>
              <span style={{ ...styles.fieldLabel, color: theme.textMuted }}>Who sent it</span>
              <input
                type="text"
                value={contactLabel}
                onChange={(e) => setContactLabel(e.target.value)}
                placeholder="Name, username, or phone number"
                style={inputStyle}
              />
            </label>

            <label style={{ ...styles.field, maxWidth: isMobile ? 'none' : '180px' }}>
              <span style={{ ...styles.fieldLabel, color: theme.textMuted }}>Platform</span>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={styles.tabRow}>
            <button
              type="button"
              onClick={() => setEntryMode('rows')}
              style={{
                ...styles.tab,
                fontSize: isMobile ? '15px' : '14px',
                color: entryMode === 'rows' ? theme.text : theme.textMuted,
                borderBottom: `2px solid ${entryMode === 'rows' ? theme.accent : 'transparent'}`,
              }}
            >
              Type messages
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('paste')}
              style={{
                ...styles.tab,
                fontSize: isMobile ? '15px' : '14px',
                color: entryMode === 'paste' ? theme.text : theme.textMuted,
                borderBottom: `2px solid ${entryMode === 'paste' ? theme.accent : 'transparent'}`,
              }}
            >
              Paste a chat
            </button>
          </div>

          {entryMode === 'rows' && (
            <>
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  style={{
                    ...styles.messageInputRow,
                    flexDirection: isMobile ? 'column' : 'row',
                  }}
                >
                  {/* On mobile: sender + remove share a row, text and time
                      each get their own full-width row below. */}
                  <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                    <select
                      value={row.sender}
                      onChange={(e) => updateRow(row.id, 'sender', e.target.value)}
                      aria-label={`Sender of message ${index + 1}`}
                      style={{
                        ...inputStyle,
                        width: isMobile ? '110px' : '90px',
                        flexShrink: 0,
                        padding: isMobile ? '11px 10px' : '10px 12px',
                      }}
                    >
                      <option value="them">Them</option>
                      <option value="me">Me</option>
                    </select>

                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        aria-label={`Remove message ${index + 1}`}
                        style={{
                          ...styles.removeButton,
                          flex: 1,
                          color: theme.textMuted,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          opacity: rows.length === 1 ? 0.3 : 1,
                          cursor: rows.length === 1 ? 'default' : 'pointer',
                        }}
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={row.text}
                    onChange={(e) => updateRow(row.id, 'text', e.target.value)}
                    placeholder="What the message said"
                    aria-label={`Text of message ${index + 1}`}
                    style={{
                      ...inputStyle,
                      flex: 1,
                      minWidth: isMobile ? '100%' : '160px',
                      padding: isMobile ? '11px 12px' : '10px 12px',
                    }}
                  />

                  <input
                    type="text"
                    value={row.time}
                    onChange={(e) => updateRow(row.id, 'time', e.target.value)}
                    placeholder="10:02 AM"
                    aria-label={`Time of message ${index + 1}`}
                    style={{
                      ...inputStyle,
                      width: isMobile ? '100%' : '100px',
                      flexShrink: 0,
                      padding: isMobile ? '11px 12px' : '10px 12px',
                    }}
                  />

                  {!isMobile && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      aria-label={`Remove message ${index + 1}`}
                      style={{
                        ...styles.removeButton,
                        color: theme.textMuted,
                        opacity: rows.length === 1 ? 0.3 : 1,
                        cursor: rows.length === 1 ? 'default' : 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addRow}
                style={{ ...styles.linkButton, fontSize: isMobile ? '14px' : '13px', color: theme.accent }}
              >
                + Add message
              </button>
            </>
          )}

          {entryMode === 'paste' && (
            <>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                placeholder={'Paste the chat here, one message per line:\n\n[10:02 AM] Them: hey\n[10:05 AM] Me: who is this?'}
                style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <p style={{ ...styles.hint, color: theme.textMuted }}>
                Lines starting with Me: are read as yours. Everything else is read as theirs.
              </p>
              <button
                type="button"
                onClick={importPastedText}
                disabled={!pasteText.trim()}
                style={{
                  ...styles.linkButton,
                  fontSize: isMobile ? '14px' : '13px',
                  color: theme.accent,
                  opacity: pasteText.trim() ? 1 : 0.4,
                }}
              >
                Convert to messages
              </button>
            </>
          )}

          <div
            style={{
              ...styles.actionsRow,
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            <button
              type="button"
              onClick={analyzeThread}
              disabled={loading}
              style={{
                ...styles.actionButton,
                padding: isMobile ? '13px 24px' : '12px 24px',
                backgroundColor: theme.accent,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Analyzing...' : 'Analyze conversation'}
            </button>

            <button
              type="button"
              onClick={clearForm}
              style={{ ...styles.linkButton, fontSize: isMobile ? '14px' : '13px', color: theme.textMuted }}
            >
              Clear form
            </button>
          </div>
        </div>
      )}

      {hasAnalyzed && !loading && (
        <>
          <div style={{ ...styles.resultActions, flexDirection: isMobile ? 'column' : 'row' }}>
            <button
              type="button"
              onClick={backToForm}
              style={{
                ...styles.secondaryButton,
                padding: isMobile ? '13px 24px' : '12px 24px',
                backgroundColor: theme.border,
                color: theme.text,
              }}
            >
              Edit conversation
            </button>
            <button
              type="button"
              onClick={analyzeThread}
              disabled={loading}
              style={{
                ...styles.actionButton,
                padding: isMobile ? '13px 24px' : '12px 24px',
                backgroundColor: theme.accent,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Analyzing...' : 'Run again'}
            </button>
          </div>

          {!loading && !error && (
            <div style={{ ...styles.escalationBar, backgroundColor: theme.cardBackground }}>
              <span style={{ ...styles.escalationLabel, color: theme.textMuted }}>Escalation level:</span>
              <span style={styles.escalationValue}>{escalationLevel}</span>
              <span style={{ ...styles.escalationLabel, color: theme.textMuted }}>· {platform}</span>
            </div>
          )}

          <div style={styles.chatBox}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.messageRow,
                  flexDirection: msg.sender === 'me' ? 'row-reverse' : 'row',
                }}
              >
                <div
                  style={{
                    ...styles.avatar,
                    backgroundColor:
                      msg.sender === 'me'
                        ? theme.accent
                        : msg.flagged
                        ? '#a304047d'
                        : theme.border,
                  }}
                >
                  {msg.sender === 'me' ? '🙂' : '❓'}
                </div>

                <div
                  style={{
                    ...styles.bubble,
                    maxWidth: isMobile ? '78%' : '400px',
                    backgroundColor: msg.flagged
                      ? '#d01111'
                      : msg.sender === 'me'
                      ? theme.accent
                      : theme.cardBackground,
                    borderLeft: msg.flagged ? '4px solid #e0525282' : 'none',
                  }}
                >
                  <p
                    style={{
                      ...styles.messageText,
                      color: msg.flagged || msg.sender === 'me' ? 'white' : theme.text,
                    }}
                  >
                    {msg.text}
                  </p>
                  {msg.time && (
                    <span
                      style={{
                        ...styles.messageTime,
                        color: msg.flagged || msg.sender === 'me' ? '#dae2eb' : theme.textMuted,
                      }}
                    >
                      {msg.time}
                    </span>
                  )}
                  {msg.flagged && <div style={styles.flagTag}>🚩 {msg.reason}</div>}
                  {msg.flagged && <div style={styles.evidenceTag}>🗄️ Saved to Evidence Vault</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', fontFamily: 'Arial', boxSizing: 'border-box' },
  title: { marginBottom: '5px' },
  subtitle: { marginBottom: '20px' },
  errorText: { marginBottom: '16px', fontSize: '14px' },
  loadingLabel: { fontSize: '13px', marginBottom: '4px' },
  skeletonBubble: { height: '52px', borderRadius: '12px', flexShrink: 0 },
  formCard: {
    borderRadius: '12px',
    padding: '20px',
    maxWidth: '700px',
    marginBottom: '30px',
    boxSizing: 'border-box',
  },
  fieldRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' },
  fieldLabel: { fontSize: '12px' },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  tabRow: { display: 'flex', gap: '18px', marginBottom: '16px' },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '6px 2px',
    cursor: 'pointer',
  },
  messageInputRow: { display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' },
  removeButton: { background: 'none', border: 'none', fontSize: '14px', padding: '6px' },
  linkButton: {
    background: 'none',
    border: 'none',
    padding: '8px 0',
    cursor: 'pointer',
    textAlign: 'left',
  },
  hint: { fontSize: '12px', margin: '8px 0 0 0' },
  actionsRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginTop: '18px',
    paddingTop: '16px',
  },
  actionButton: {
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  resultActions: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' },
  escalationBar: {
    padding: '12px 20px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '30px',
    flexWrap: 'wrap',
  },
  escalationLabel: { fontSize: '13px' },
  escalationValue: { fontSize: '14px', color: '#e0524f', fontWeight: 'bold' },
  chatBox: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '650px' },
  messageRow: { display: 'flex', alignItems: 'flex-end', gap: '10px' },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0,
  },
  bubble: { padding: '12px 16px', borderRadius: '12px' },
  messageText: { margin: '0 0 6px 0', fontSize: '14px' },
  messageTime: { fontSize: '11px' },
  flagTag: { marginTop: '8px', fontSize: '12px', color: '#f4a6a6', fontWeight: 'bold' },
  evidenceTag: { marginTop: '4px', fontSize: '11px', color: '#a6f4c5' },
};

export default ConversationTimeline;