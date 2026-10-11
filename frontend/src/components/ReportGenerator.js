import React, { useEffect, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { useLanguage } from '../LanguageContext';
import { reportsApi, downloadBlob } from '../services/api';
import useIsMobile from '../useIsMobile';

function ReportGenerator() {
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();
  const isMobile = useIsMobile();

  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [error, setError] = useState(null);

  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [creating, setCreating] = useState(false);

  const urduFont = "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', Arial, sans-serif";

  const loadCases = async () => {
    setLoadingCases(true);
    try {
      const data = await reportsApi.listCases();
      setCases(data);
    } catch (err) {
      setError(err.message || 'Failed to load cases.');
    } finally {
      setLoadingCases(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!newTitle || !newDate) return;
    setCreating(true);
    setError(null);
    try {
      const created = await reportsApi.createCase({ title: newTitle, date: newDate });
      setCases((prev) => [created, ...prev]);
      setNewTitle('');
      setNewDate('');
      setShowNewCaseForm(false);
    } catch (err) {
      setError(err.message || 'Failed to create case.');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = () => {
    setGenerating(true);
    setReportReady(false);
    setTimeout(() => {
      setGenerating(false);
      setReportReady(true);
    }, 800);
  };

  const handleDownload = async () => {
    if (!selectedCase) return;
    try {
      const { blob, filename } = await reportsApi.exportCase(selectedCase.id);
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err.message || 'Failed to export report.');
    }
  };

  const handleSelect = (caseItem) => {
    setSelectedCase(caseItem);
    setReportReady(false);
  };

  return (
    <div
      style={{
        ...styles.container,
        padding: isMobile ? '24px 16px' : '40px 60px',
        backgroundColor: theme.background,
        color: theme.text,
      }}
    >
      <h1
        style={{
          ...styles.title,
          fontSize: isMobile ? '22px' : '26px',
          fontFamily: isRTL ? urduFont : 'Arial',
        }}
      >
        📄 {t('reports.title')}
      </h1>
      <p
        style={{
          ...styles.subtitle,
          fontSize: isMobile ? '14px' : '16px',
          color: theme.textMuted,
          fontFamily: isRTL ? urduFont : 'Arial',
        }}
      >
        {t('reports.subtitle')}
      </p>

      {error && <p style={{ color: '#e05252', marginBottom: '16px' }}>⚠️ {error}</p>}

      <div style={{ ...styles.layout, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ ...styles.caseList, maxWidth: isMobile ? '100%' : '380px' }}>
          <div style={styles.caseListHeader}>
            <p style={{ ...styles.sectionLabel, color: theme.textMuted, margin: 0 }}>
              {t('reports.selectCase')}
            </p>
            <button
              style={{
                ...styles.newCaseButton,
                padding: isMobile ? '9px 14px' : '6px 12px',
                fontSize: isMobile ? '13px' : '12px',
                backgroundColor: theme.accent,
                fontFamily: isRTL ? urduFont : 'Arial',
              }}
              onClick={() => setShowNewCaseForm((v) => !v)}
            >
              {showNewCaseForm ? t('reports.cancel') : t('reports.newCase')}
            </button>
          </div>

          {showNewCaseForm && (
            <form onSubmit={handleCreateCase} style={{ ...styles.newCaseForm, backgroundColor: theme.cardBackground }}>
              <input
                type="text"
                placeholder={t('reports.caseTitlePlaceholder')}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{
                  ...styles.input,
                  padding: isMobile ? '11px 12px' : '8px 10px',
                  fontSize: isMobile ? '14px' : '13px',
                  backgroundColor: theme.background,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                }}
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                style={{
                  ...styles.input,
                  padding: isMobile ? '11px 12px' : '8px 10px',
                  fontSize: isMobile ? '14px' : '13px',
                  backgroundColor: theme.background,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  colorScheme: theme.mode === 'dark' ? 'dark' : 'light',
                }}
              />
              <button
                type="submit"
                disabled={creating}
                style={{
                  ...styles.newCaseButton,
                  padding: isMobile ? '11px 14px' : '6px 12px',
                  fontSize: isMobile ? '14px' : '12px',
                  backgroundColor: theme.accent,
                  fontFamily: isRTL ? urduFont : 'Arial',
                }}
              >
                {creating ? t('reports.creating') : t('reports.createCase')}
              </button>
            </form>
          )}

          {loadingCases && (
            <p style={{ color: theme.textMuted, fontSize: '13px' }}>{t('reports.loadingCases')}</p>
          )}
          {!loadingCases && cases.length === 0 && (
            <p style={{ color: theme.textMuted, fontSize: '13px' }}>{t('reports.noCases')}</p>
          )}

          {cases.map((c) => (
            <div
              key={c.id}
              onClick={() => handleSelect(c)}
              style={{
                ...styles.caseCard,
                padding: isMobile ? '14px 16px' : '16px',
                backgroundColor: theme.cardBackground,
                border: selectedCase?.id === c.id ? `2px solid ${theme.accent}` : '2px solid transparent',
              }}
            >
              <h3 style={{ ...styles.caseTitle, color: theme.text }}>{c.title}</h3>
              <p style={{ ...styles.caseMeta, color: theme.textMuted }}>
                {c.date} • {c.flaggedCount} {t('reports.flaggedMessages')}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            ...styles.previewCard,
            padding: isMobile ? '18px' : '25px',
            backgroundColor: theme.cardBackground,
          }}
        >
          {!selectedCase && (
            <p style={{ ...styles.placeholderText, color: theme.textMuted }}>
              {t('reports.selectPrompt')}
            </p>
          )}

          {selectedCase && (
            <>
              <p style={{ ...styles.sectionLabel, color: theme.textMuted }}>{t('reports.preview')}</p>
              <div style={{ ...styles.previewBox, backgroundColor: theme.background }}>
                <p style={{ ...styles.previewLine, color: theme.text }}>
                  <b>{t('reports.caseLabel')}</b> {selectedCase.title}
                </p>
                <p style={{ ...styles.previewLine, color: theme.text }}>
                  <b>{t('reports.dateRange')}</b> {selectedCase.date}
                </p>
                <p style={{ ...styles.previewLine, color: theme.text }}>
                  <b>{t('reports.flaggedMessagesLabel')}</b> {selectedCase.flaggedCount}
                </p>
                <p style={{ ...styles.previewLine, color: theme.text }}>
                  <b>{t('reports.evidenceHash')}</b> {t('reports.included')}
                </p>
                <p style={{ ...styles.previewLine, color: theme.text }}>
                  <b>{t('reports.chainOfCustody')}</b> {t('reports.verified')}
                </p>
                <p style={{ ...styles.previewLine, color: theme.text }}>
                  <b>{t('reports.recommendedAction')}</b> {t('reports.recommendation')}
                </p>
              </div>

              {!reportReady && (
                <button
                  style={{
                    ...styles.generateButton,
                    width: isMobile ? '100%' : 'auto',
                    padding: isMobile ? '13px 20px' : '12px 20px',
                    backgroundColor: theme.accent,
                    fontFamily: isRTL ? urduFont : 'Arial',
                  }}
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? t('reports.generating') : t('reports.generate')}
                </button>
              )}

              {reportReady && (
                <div style={{ ...styles.readyBox, backgroundColor: theme.background, border: `1px solid ${theme.border}` }}>
                  <p style={styles.readyText}>✅ {t('reports.success')}</p>
                  <button
                    style={{
                      ...styles.downloadButton,
                      width: isMobile ? '100%' : 'auto',
                      padding: isMobile ? '12px 18px' : '10px 18px',
                      backgroundColor: theme.accent,
                      fontFamily: isRTL ? urduFont : 'Arial',
                    }}
                    onClick={handleDownload}
                  >
                    ⬇️ {t('reports.download')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', fontFamily: 'Arial' },
  title: { marginBottom: '5px' },
  subtitle: { marginBottom: '30px', maxWidth: '600px' },
  layout: { display: 'flex', flexWrap: 'wrap', gap: '24px' },
  caseList: { flex: '1 1 320px' },
  caseListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  newCaseButton: { color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  newCaseForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '14px',
    borderRadius: '10px',
    marginBottom: '14px',
  },
  input: { borderRadius: '6px', outline: 'none', boxSizing: 'border-box' },
  sectionLabel: { fontSize: '14px', marginBottom: '12px' },
  caseCard: { borderRadius: '10px', marginBottom: '12px', cursor: 'pointer' },
  caseTitle: { margin: '0 0 5px 0', fontSize: '15px' },
  caseMeta: { margin: 0, fontSize: '12px' },
  previewCard: { flex: '2 1 400px', borderRadius: '12px' },
  placeholderText: { fontSize: '14px' },
  previewBox: { borderRadius: '8px', padding: '18px', marginBottom: '20px' },
  previewLine: { fontSize: '13px', margin: '0 0 10px 0' },
  generateButton: { color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  readyBox: { padding: '16px', borderRadius: '8px' },
  readyText: { color: '#52e07a', fontSize: '14px', marginBottom: '12px', fontWeight: 'bold' },
  downloadButton: { color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
};

export default ReportGenerator;