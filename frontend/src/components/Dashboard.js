import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useIsMobile from '../useIsMobile';
import { useTheme } from '../ThemeContext';
import { useAppContext } from '../AppContext';
import { connectSocket, onAlert } from '../services/socket';
import { alertsApi } from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';

// ---------------------------------------------------------------------------
// Helpers for improvements #1 and #2
// ---------------------------------------------------------------------------

const PREVIEW_LENGTH = 60;

// Turns an ISO timestamp into "2026-09-20, 21:30".
// If the backend still only sends a short time like "21:30", show it unchanged.
const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const makePreview = (text) => {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > PREVIEW_LENGTH ? clean.slice(0, PREVIEW_LENGTH) + '...' : clean;
};

const riskFromLabel = (risk) => {
  // Defensive: handle null/undefined/non-string safely
  const value = typeof risk === 'string' ? risk : '';
  if (value.includes('High')) return 'High';
  if (value.includes('Medium')) return 'Medium';
  return 'Low';
};

// One place that converts an API/socket alert into the shape the UI uses.
// Every new field has a fallback, so this keeps working until the backend
// starts sending them. Adjust the field names on the right-hand side to match
// your serializer.
const normalizeAlert = (a, icon, idOverride, receivedAt) => {
  const fullText = a.message_text ?? a.message ?? a.text ?? '';
  // Live alerts that carry no date are stamped with the time they arrived.
  const timestamp = a.created_at ?? a.timestamp ?? receivedAt ?? null;
  const parsedMs = timestamp ? new Date(timestamp).getTime() : NaN;
  return {
    id: idOverride ?? a.id,
    contact: a.sender,
    username: a.username ?? a.sender_username ?? '',
    platform: a.platform ?? 'Instagram',
    type: a.type,
    icon,
    risk: riskFromLabel(a.risk),
    time: a.time,
    timestampMs: Number.isNaN(parsedMs) ? null : parsedMs,
    dateTime: timestamp ? formatDateTime(timestamp) : a.time,
    preview: a.message_preview ?? makePreview(fullText),
    fullText,
    confidence: a.confidence ?? a.confidence_score ?? null,
    sha256: a.sha256 ?? a.evidence_hash ?? a.evidence?.sha256 ?? '',
    evidenceId: a.evidence_id ?? a.evidence?.id ?? null,
    rawPayload: a.raw_payload ?? a.payload ?? null,
  };
};

const formatConfidence = (c) => {
  if (c === null || c === undefined || c === '') return 'Not available';
  const n = Number(c);
  if (Number.isNaN(n)) return String(c);
  // Accept both 0.93 and 93
  return `${(n <= 1 ? n * 100 : n).toFixed(1)}%`;
};

const formatRaw = (raw) => {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'string') {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch (e) {
      return raw;
    }
  }
  return JSON.stringify(raw, null, 2);
};

// ---------------------------------------------------------------------------
// Real stats for the gauge and trend chart (#8), plus the weekly summary (#14).
// No sample data: everything here is computed from the alerts and evidence
// the dashboard actually has. Each alert counts as High = 100, Medium = 60,
// Low = 20, and the score is the average.
// ---------------------------------------------------------------------------

const RISK_WEIGHT = { High: 100, Medium: 60, Low: 20 };
const RISK_COLORS = { High: '#e05252', Medium: '#e0a852', Low: '#52e07a' };

const averageRisk = (list) =>
  list.length === 0
    ? null
    : Math.round(list.reduce((sum, a) => sum + RISK_WEIGHT[a.risk], 0) / list.length);

const levelFromScore = (score) => {
  if (score === null) return 'None';
  if (score >= 67) return 'High';
  if (score >= 34) return 'Medium';
  return 'Low';
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Midnight, 6 days ago — the shared start-of-week boundary used by both the
// alert trend and the weekly evidence count below.
const startOfWeekMs = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
};

// One entry per calendar day for the last 7 days, ending today.
// Days with no alerts get risk: null, so the line has a gap instead of a fake zero.
const buildTrend = (list) => {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push({
      key: dayKey(d),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      items: [],
    });
  }
  list.forEach((a) => {
    if (a.timestampMs === null) return;
    const slot = days.find((x) => x.key === dayKey(new Date(a.timestampMs)));
    if (slot) slot.items.push(a);
  });
  return days.map((x) => ({ day: x.day, risk: averageRisk(x.items), count: x.items.length }));
};

// Best-effort timestamp reader for evidence records, since the exact field
// name isn't confirmed yet (created_at / createdAt / timestamp / date all
// seen in different backends). Returns null if none parse, so callers can
// fall back to an all-time total instead of showing a wrong "this week" count.
const evidenceTimeMs = (e) => {
  const raw = e.created_at ?? e.createdAt ?? e.timestamp ?? e.date ?? null;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? null : ms;
};

// ---------------------------------------------------------------------------
// Loading skeletons (#4)
// ---------------------------------------------------------------------------

const SKELETON_CSS = `
  @keyframes cs-skeleton-pulse {
    0%, 100% { opacity: 0.45; }
    50%      { opacity: 1; }
  }
  .cs-skeleton { animation: cs-skeleton-pulse 1.4s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .cs-skeleton { animation: none; }
  }
`;

function Skeleton({ width = '100%', height = 14, radius = 6, style }) {
  const { theme } = useTheme();
  return (
    <div
      className="cs-skeleton"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, backgroundColor: theme.border, ...style }}
    />
  );
}

// ---------------------------------------------------------------------------
// Alert detail modal (#2)
// ---------------------------------------------------------------------------

function AlertModal({ alert, onClose, theme, riskColor }) {
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError('');
    try {
      // Needs a backend endpoint. Rename to whatever your api.js exposes.
      if (typeof alertsApi.saveToVault !== 'function') {
        throw new Error('The save endpoint is not connected yet.');
      }
      await alertsApi.saveToVault(alert.id);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(err.message || 'Could not save to the Evidence Vault.');
    }
  };

  const rawText = formatRaw(alert.rawPayload);
  const color = riskColor(alert.risk);

  const label = { ...modalStyles.label, color: theme.textMuted };
  const box = { ...modalStyles.box, backgroundColor: theme.background, border: `1px solid ${theme.border}` };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Alert details"
        style={{ ...modalStyles.panel, backgroundColor: theme.cardBackground, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={modalStyles.header}>
          <div>
            <h2 style={modalStyles.title}>{alert.username || alert.contact}</h2>
            <p style={{ ...modalStyles.meta, color: theme.textMuted }}>
              {alert.platform} • {alert.type} • {alert.dateTime}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ ...modalStyles.closeBtn, color: theme.text }}>
            ✕
          </button>
        </div>

        <div style={modalStyles.row}>
          <span style={{ ...styles.riskChip, backgroundColor: color + '33', color }}>
            {alert.risk} Risk
          </span>
          <span style={{ fontSize: '13px', color: theme.textMuted }}>
            Confidence: <strong style={{ color: theme.text }}>{formatConfidence(alert.confidence)}</strong>
          </span>
        </div>

        <p style={label}>Message</p>
        <div style={box}>
          {alert.fullText ? alert.fullText : <span style={{ color: theme.textMuted }}>No message text available.</span>}
        </div>

        <p style={label}>SHA-256 hash</p>
        <div style={{ ...box, fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
          {alert.sha256 ? alert.sha256 : <span style={{ color: theme.textMuted }}>Not linked to evidence yet.</span>}
        </div>

        <p style={label}>Original Meta payload</p>
        <pre style={{ ...box, ...modalStyles.pre }}>
          {rawText ? rawText : 'No raw payload stored for this alert.'}
        </pre>

        <div style={modalStyles.footer}>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving' || saveState === 'saved'}
            style={{
              ...modalStyles.saveBtn,
              backgroundColor: saveState === 'saved' ? '#52e07a' : theme.accent,
              color: saveState === 'saved' ? '#0b2b14' : '#fff',
              opacity: saveState === 'saving' ? 0.6 : 1,
              cursor: saveState === 'saving' ? 'wait' : saveState === 'saved' ? 'default' : 'pointer',
            }}
          >
            {saveState === 'saving' && 'Saving...'}
            {saveState === 'saved' && 'Saved to Evidence Vault'}
            {(saveState === 'idle' || saveState === 'error') && 'Save to Evidence Vault'}
          </button>
          {saveState === 'error' && <span style={modalStyles.errorText}>{saveError}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly Summary card (#14)
// ---------------------------------------------------------------------------

function WeeklySummary({ theme, loading, weekly, evidenceWeekly }) {
  const tileBg = theme.background;

  return (
    <div style={{ ...styles.weeklyCard, backgroundColor: theme.cardBackground }}>
      <p style={{ ...styles.gaugeLabel, color: theme.textMuted, marginBottom: '15px' }}>
        📅 Weekly Summary
      </p>

      {loading ? (
        <div style={styles.weeklyGrid}>
          {[0, 1, 2, 3].map((n) => (
            <div key={n} style={{ ...styles.weeklyTile, backgroundColor: tileBg }}>
              <Skeleton width="60%" height={12} style={{ marginBottom: 10 }} />
              <Skeleton width="40%" height={22} />
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.weeklyGrid}>
          {/* Total alerts this week */}
          <div style={{ ...styles.weeklyTile, backgroundColor: tileBg }}>
            <p style={{ ...styles.weeklyTileLabel, color: theme.textMuted }}>
              Alerts {weekly.hasDates ? 'this week' : 'total'}
            </p>
            <p style={{ ...styles.weeklyTileValue, color: theme.text }}>{weekly.basisCount}</p>
          </div>

          {/* Risk breakdown */}
          <div style={{ ...styles.weeklyTile, backgroundColor: tileBg }}>
            <p style={{ ...styles.weeklyTileLabel, color: theme.textMuted }}>Risk breakdown</p>
            {weekly.basisCount === 0 ? (
              <p style={{ ...styles.weeklyTileValue, color: theme.textMuted, fontSize: '14px' }}>No alerts yet</p>
            ) : (
              <div style={styles.riskBreakdownRow}>
                {['High', 'Medium', 'Low'].map((level) => (
                  <span key={level} style={styles.riskBreakdownItem}>
                    <span style={{ ...styles.riskDot, backgroundColor: RISK_COLORS[level] }} />
                    <span style={{ color: theme.text, fontWeight: 700 }}>{weekly.breakdown[level] || 0}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Busiest day */}
          <div style={{ ...styles.weeklyTile, backgroundColor: tileBg }}>
            <p style={{ ...styles.weeklyTileLabel, color: theme.textMuted }}>Busiest day</p>
            <p style={{ ...styles.weeklyTileValue, color: theme.text }}>
              {weekly.busiestDay ? weekly.busiestDay : '–'}
            </p>
            {weekly.busiestDay && (
              <p style={{ ...styles.weeklyTileSub, color: theme.textMuted }}>
                {weekly.busiestCount} {weekly.busiestCount === 1 ? 'alert' : 'alerts'}
              </p>
            )}
          </div>

          {/* Evidence saved */}
          <div style={{ ...styles.weeklyTile, backgroundColor: tileBg }}>
            <p style={{ ...styles.weeklyTileLabel, color: theme.textMuted }}>
              Evidence {evidenceWeekly.hasDates ? 'this week' : 'saved total'}
            </p>
            <p style={{ ...styles.weeklyTileValue, color: theme.text }}>
              {evidenceWeekly.hasDates ? evidenceWeekly.count : evidenceWeekly.total}
            </p>
          </div>
        </div>
      )}

      {!loading && weekly.topType && (
        <p style={{ ...styles.weeklyFootnote, color: theme.textMuted }}>
          Most common this {weekly.hasDates ? 'week' : 'period'}:{' '}
          <strong style={{ color: theme.text }}>{weekly.topType}</strong> ({weekly.topTypeCount}
          {weekly.topTypeCount === 1 ? ' alert' : ' alerts'})
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard() {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const { evidenceList } = useAppContext();

  const [liveAlerts, setLiveAlerts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [clearing, setClearing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const handleClearAlerts = async () => {
    if (!window.confirm('Delete all alerts? This cannot be undone.')) return;
    setClearing(true);
    try {
      await alertsApi.clearAll();
      setAlerts([]);
      setLiveAlerts([]);
      setSelectedAlert(null);
    } catch (err) {
      console.error('Failed to clear alerts:', err);
    } finally {
      setClearing(false);
    }
  };

  // Alert history, so the dashboard has data on first load / reconnect,
  // not just live pushes.
  const loadHistory = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    alertsApi
      .list()
      .then((data) => {
        // Handle both response shapes: paginated {results: [...]} or plain array
        const history = Array.isArray(data) ? data : (data.results || []);
        setAlerts(history.map((a) => normalizeAlert(a, '⚠️')));
      })
      .catch((err) => {
        console.error('Failed to load alert history:', err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();

    connectSocket();

    const offAlert = onAlert((alert) => {
      const newAlert = normalizeAlert(alert, '🚨', alert.id ?? Date.now(), Date.now());
      setLiveAlerts((prev) => [newAlert, ...prev]);
      setToastMessage(`New alert: ${alert.type} from ${alert.username || alert.sender}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    });

    // Only remove this page's listener; the socket stays open app-wide so the
    // sidebar live indicator keeps working on every page.
    return () => offAlert();
  }, [loadHistory]);

  const riskColor = (risk) => RISK_COLORS[risk] || RISK_COLORS.Low;

  const allAlerts = useMemo(() => [...liveAlerts, ...alerts], [liveAlerts, alerts]);

  const stats = useMemo(() => {
    const dated = allAlerts.filter((a) => a.timestampMs !== null);
    const weekStart = startOfWeekMs();
    const thisWeek = dated.filter((a) => a.timestampMs >= weekStart);
    // If the server does not send dates yet, use every loaded alert.
    const basis = dated.length > 0 ? thisWeek : allAlerts;
    const score = averageRisk(basis);
    const trend = buildTrend(allAlerts);

    // #14 weekly summary: risk breakdown, most common alert type, busiest day
    const breakdown = { High: 0, Medium: 0, Low: 0 };
    basis.forEach((a) => {
      breakdown[a.risk] = (breakdown[a.risk] || 0) + 1;
    });

    const typeCounts = {};
    basis.forEach((a) => {
      const ty = a.type || 'Unknown';
      typeCounts[ty] = (typeCounts[ty] || 0) + 1;
    });
    let topType = null;
    let topTypeCount = 0;
    Object.entries(typeCounts).forEach(([ty, count]) => {
      if (count > topTypeCount) {
        topType = ty;
        topTypeCount = count;
      }
    });

    let busiestDay = null;
    let busiestCount = 0;
    trend.forEach((d) => {
      if (d.count > busiestCount) {
        busiestDay = d.day;
        busiestCount = d.count;
      }
    });

    return {
      score,
      level: levelFromScore(score),
      basisCount: basis.length,
      hasDates: dated.length > 0,
      trend,
      hasTrend: trend.some((d) => d.count > 0),
      breakdown,
      topType,
      topTypeCount,
      busiestDay,
      busiestCount,
    };
  }, [allAlerts]);

  // #14 weekly summary: how much evidence was saved this week, falling back
  // to an all-time total if evidence records don't carry a usable date yet.
  const evidenceWeekly = useMemo(() => {
    const list = evidenceList || [];
    const weekStart = startOfWeekMs();
    const dated = list.filter((e) => evidenceTimeMs(e) !== null);
    const thisWeek = dated.filter((e) => evidenceTimeMs(e) >= weekStart);
    return {
      count: thisWeek.length,
      total: list.length,
      hasDates: dated.length > 0,
    };
  }, [evidenceList]);

  const gaugeColor = stats.score === null ? theme.border : riskColor(stats.level);
  const gaugeData = [{ name: 'Risk', value: stats.score ?? 0, fill: gaugeColor }];
  const plural = stats.basisCount === 1 ? 'alert' : 'alerts';
  let gaugeCaption;
  if (stats.basisCount === 0) {
    gaugeCaption = stats.hasDates ? 'No alerts this week' : 'No alerts yet';
  } else {
    gaugeCaption = `Based on ${stats.basisCount} ${plural}${stats.hasDates ? ' this week' : ''}`;
  }

  return (
    <div style={{ ...styles.container, backgroundColor: theme.background, color: theme.text }}>
      {showToast && (
        <div style={styles.toast}>
          🚨 {toastMessage}
        </div>
      )}

      <style>{SKELETON_CSS}</style>
      <h1 style={styles.title}>📊 Live Dashboard</h1>
      <p style={{ ...styles.subtitle, color: theme.textMuted }}>Here's an overview of your recent activity.</p>

      {/* Top row: Gauge + Chart side by side (stacks on mobile) */}
      <div style={{ ...styles.topRow, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ ...styles.gaugeCard, backgroundColor: theme.cardBackground }}>
          <p style={{ ...styles.gaugeLabel, color: theme.textMuted }}>Overall Risk Level</p>
          {loading ? (
            <>
              <Skeleton width={150} height={150} radius="50%" style={{ margin: '15px auto' }} />
              <Skeleton width="70%" height={12} style={{ margin: '14px auto 0' }} />
            </>
          ) : (
            <>
              <div style={styles.gaugeWrapper}>
                <ResponsiveContainer width="100%" height={180}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="100%"
                    barSize={16}
                    data={gaugeData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar background={{ fill: theme.border }} dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div style={styles.gaugeCenterText}>
                  <div
                    style={{
                      ...styles.gaugeNumber,
                      color: stats.score === null ? theme.textMuted : gaugeColor,
                    }}
                  >
                    {stats.score === null ? '–' : stats.score}
                  </div>
                  <div style={{ ...styles.gaugeSubtext, color: theme.textMuted }}>
                    {stats.score === null ? 'No data' : stats.level}
                  </div>
                </div>
              </div>
              <p style={{ ...styles.gaugeText, color: theme.textMuted }}>{gaugeCaption}</p>
            </>
          )}
        </div>

        <div style={{ ...styles.chartCard, backgroundColor: theme.cardBackground }}>
          <p style={{ ...styles.gaugeLabel, color: theme.textMuted }}>Risk Trend (Last 7 Days)</p>
          {loading ? (
            <Skeleton height={220} radius={10} />
          ) : !stats.hasTrend ? (
            <div style={{ ...styles.chartEmpty, color: theme.textMuted }}>
              {allAlerts.length === 0
                ? 'No alerts yet. The trend appears as alerts arrive.'
                : 'The trend needs alert dates from the server.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="day" stroke={theme.textMuted} />
                <YAxis stroke={theme.textMuted} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: theme.cardBackground, border: `1px solid ${theme.border}`, color: theme.text }}
                  formatter={(value, name, item) => [
                    `${value} (${item.payload.count} ${item.payload.count === 1 ? 'alert' : 'alerts'})`,
                    'Risk',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="risk"
                  stroke={theme.accent}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Weekly Summary (#14) */}
      <WeeklySummary theme={theme} loading={loading} weekly={stats} evidenceWeekly={evidenceWeekly} />

      {/* Alerts section header with Clear button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px',
        }}
      >
        <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Recent Alerts</h2>
        {allAlerts.length > 0 && (
          <button
            onClick={handleClearAlerts}
            disabled={clearing}
            style={{
              backgroundColor: '#e05252',
              color: 'white',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: clearing ? 'wait' : 'pointer',
              opacity: clearing ? 0.6 : 1,
            }}
          >
            {clearing ? 'Clearing...' : '🗑️ Clear All Alerts'}
          </button>
        )}
      </div>

      {/* Alerts grid or empty state */}
      {loading ? (
        <div style={styles.alertsGrid}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{ ...styles.alertCard, backgroundColor: theme.cardBackground, cursor: 'default' }}>
              <div style={styles.alertLeft}>
                <Skeleton width={26} height={26} radius="50%" />
                <div style={styles.alertText}>
                  <Skeleton width="55%" height={15} style={{ marginBottom: 8 }} />
                  <Skeleton width="80%" height={12} style={{ marginBottom: 10 }} />
                  <Skeleton width="65%" height={12} />
                </div>
              </div>
              <Skeleton width={80} height={24} radius={20} />
            </div>
          ))}
        </div>
      ) : loadError && allAlerts.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            borderRadius: '12px',
            backgroundColor: theme.cardBackground,
            textAlign: 'center',
            color: theme.textMuted,
            fontSize: '14px',
          }}
        >
          <p style={{ margin: '0 0 14px 0' }}>Could not load alerts. Check that the server is running.</p>
          <button onClick={loadHistory} style={styles.retryBtn}>
            Try again
          </button>
        </div>
      ) : allAlerts.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            borderRadius: '12px',
            backgroundColor: theme.cardBackground,
            textAlign: 'center',
            color: theme.textMuted,
            fontSize: '14px',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🛡️</div>
          <p style={{ margin: 0 }}>No alerts yet. You're all caught up!</p>
        </div>
      ) : (
        <div style={styles.alertsGrid}>
          {allAlerts.map((alert) => (
            <div
              key={alert.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedAlert(alert)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedAlert(alert);
                }
              }}
              style={{ ...styles.alertCard, backgroundColor: theme.cardBackground }}
            >
              <div style={styles.alertLeft}>
                <span style={styles.alertIcon}>{alert.icon}</span>
                <div style={styles.alertText}>
                  <h3 style={styles.alertContact}>
                    {alert.username ? `@${alert.username}` : alert.contact}
                  </h3>
                  <p style={{ ...styles.alertType, color: theme.textMuted }}>
                    {alert.platform} • {alert.type} • {alert.dateTime}
                  </p>
                  {alert.preview && (
                    <p style={{ ...styles.alertPreview, color: theme.text }}>
                      "{alert.preview}"
                    </p>
                  )}
                </div>
              </div>
              <span
                style={{
                  ...styles.riskChip,
                  backgroundColor: riskColor(alert.risk) + '33',
                  color: riskColor(alert.risk),
                }}
              >
                {alert.risk} Risk
              </span>
            </div>
          ))}
        </div>
      )}

      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          theme={theme}
          riskColor={riskColor}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '30px 20px',
    fontFamily: 'Arial',
  },
  toast: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: '#e05252',
    color: 'white',
    padding: '14px 20px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000,
    fontWeight: 'bold',
  },
  title: {
    fontSize: '26px',
    marginBottom: '5px',
  },
  subtitle: {
    marginBottom: '30px',
  },
  topRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '24px',
    marginBottom: '24px',
  },
  gaugeCard: {
    borderRadius: '12px',
    padding: '25px',
    textAlign: 'center',
    flex: '1 1 300px',
    maxWidth: '340px',
  },
  gaugeLabel: {
    fontSize: '14px',
    marginBottom: '10px',
  },
  gaugeWrapper: {
    position: 'relative',
  },
  gaugeCenterText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  gaugeNumber: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#e0a852',
  },
  gaugeSubtext: {
    fontSize: '13px',
  },
  gaugeText: {
    fontSize: '13px',
    marginTop: '10px',
  },
  chartCard: {
    borderRadius: '12px',
    padding: '25px',
    flex: '2 1 400px',
  },
  weeklyCard: {
    borderRadius: '12px',
    padding: '25px',
    marginBottom: '40px',
  },
  weeklyGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px',
  },
  weeklyTile: {
    borderRadius: '10px',
    padding: '16px 18px',
    flex: '1 1 160px',
    minWidth: '140px',
  },
  weeklyTileLabel: {
    fontSize: '12px',
    margin: '0 0 8px 0',
  },
  weeklyTileValue: {
    fontSize: '26px',
    fontWeight: 'bold',
    margin: 0,
  },
  weeklyTileSub: {
    fontSize: '12px',
    margin: '4px 0 0 0',
  },
  riskBreakdownRow: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
  },
  riskBreakdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '15px',
  },
  riskDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  weeklyFootnote: {
    fontSize: '13px',
    marginTop: '16px',
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '15px',
  },
  chartEmpty: {
    height: '220px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontSize: '14px',
    padding: '0 20px',
  },
  retryBtn: {
    backgroundColor: '#e05252',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  alertsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px',
  },
  alertCard: {
    padding: '18px 20px',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flex: '1 1 320px',
    maxWidth: '420px',
    cursor: 'pointer',
  },
  alertLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    minWidth: 0,
    flex: 1,
  },
  alertIcon: {
    fontSize: '22px',
  },
  alertText: {
    minWidth: 0,
    flex: 1,
  },
  alertContact: {
    margin: '0 0 4px 0',
    fontSize: '15px',
  },
  alertType: {
    margin: 0,
    fontSize: '13px',
  },
  alertPreview: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    fontStyle: 'italic',
    opacity: 0.85,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  },
  riskChip: {
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 2000,
  },
  panel: {
    width: '100%',
    maxWidth: '640px',
    maxHeight: '88vh',
    overflowY: 'auto',
    borderRadius: '14px',
    padding: '24px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '14px',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '20px',
  },
  meta: {
    margin: 0,
    fontSize: '13px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '14px',
    marginBottom: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    margin: '16px 0 6px 0',
  },
  box: {
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  pre: {
    margin: 0,
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: '220px',
    overflow: 'auto',
    whiteSpace: 'pre',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '20px',
  },
  saveBtn: {
    border: 'none',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
  },
  errorText: {
    color: '#e05252',
    fontSize: '13px',
  },
};

export default Dashboard;