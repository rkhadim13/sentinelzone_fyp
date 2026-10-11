import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { useAppContext } from '../AppContext';
import { useLanguage } from '../LanguageContext';
import { evidenceApi } from '../services/api';
import useIsMobile from '../useIsMobile';

const SKELETON_ROWS = 4;

// Small preview component so each card can independently fall back to
// "no preview" if the underlying file is missing (404, broken storage,
// etc.) — without affecting the rest of the card.
function MediaPreview({ item, onImageClick, styles, theme }) {
  const [errored, setErrored] = useState(false);

  if (errored) return null;
  if (!item || !item.id) return null;

  const src = evidenceApi.fileUrl(item.id);

  if (item.type === 'Image') {
    return (
      <div style={styles.previewWrap}>
        <img
          src={src}
          alt={item.title || 'Evidence image'}
          onError={() => setErrored(true)}
          onClick={() => onImageClick(item)}
          style={styles.thumbnail}
        />
      </div>
    );
  }

  if (item.type === 'Audio') {
    return (
      <div style={styles.previewWrap}>
        <audio
          controls
          src={src}
          onError={() => setErrored(true)}
          style={styles.audioPlayer}
        />
      </div>
    );
  }

  if (item.type === 'Video') {
    return (
      <div style={styles.previewWrap}>
        <video
          controls
          src={src}
          onError={() => setErrored(true)}
          style={styles.videoPlayer}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Text / File → no inline preview, card renders as before.
  return null;
}

function EvidenceVault() {
  const { theme } = useTheme();
  const { t } = useLanguage();  const ctx = useAppContext();
  const { evidenceList, verifyEvidence, downloadEvidence } = ctx;
  const isLoading = ctx.evidenceLoading !== undefined ? ctx.evidenceLoading : evidenceList == null;
  const isMobile = useIsMobile();

  const [verifyingId, setVerifyingId] = useState(null);
  const [lightboxItem, setLightboxItem] = useState(null);

  const handleVerify = async (id) => {
    setVerifyingId(id);
    await verifyEvidence(id);
    setVerifyingId(null);
  };

  const typeIcon = (type) => {
    if (type === 'Image') return '🖼️';
    if (type === 'Audio') return '🎙️';
    if (type === 'Video') return '🎬';
    if (type === 'Text') return '💬';
    return '📄';
  };

  const buttonStyle = {
    padding: isMobile ? '11px 16px' : '8px 14px',
    fontSize: isMobile ? '14px' : '13px',
    width: isMobile ? '100%' : 'auto',
  };

  const hasPreview = (type) => type === 'Image' || type === 'Audio' || type === 'Video';

  return (
    <div
      style={{
        ...styles.container,
        padding: isMobile ? '24px 16px' : '40px 60px',
        backgroundColor: theme.background,
        color: theme.text,
      }}
    >
      <style>{skeletonCss}</style>

      <h1 style={{ ...styles.title, fontSize: isMobile ? '22px' : '26px' }}>
        🗄️ {t('vault.title')}
      </h1>
      <p style={{ ...styles.subtitle, fontSize: isMobile ? '14px' : '16px', color: theme.textMuted }}>
        {t('vault.subtitle')}
      </p>

      {isLoading && (
        <div style={styles.list}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.card,
                backgroundColor: theme.cardBackground,
              }}
            >
              <div style={styles.cardLeft}>
                <span className="sz-skeleton" style={{ ...styles.skeletonIcon, backgroundColor: theme.border }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="sz-skeleton" style={{ ...styles.skeletonLine, width: '160px', backgroundColor: theme.border }} />
                  <span className="sz-skeleton" style={{ ...styles.skeletonLine, width: '220px', backgroundColor: theme.border }} />
                  <span className="sz-skeleton" style={{ ...styles.skeletonLine, width: '180px', backgroundColor: theme.border }} />
                </div>
              </div>
              <span
                className="sz-skeleton"
                style={{
                  ...styles.skeletonButton,
                  width: isMobile ? '100%' : '110px',
                  backgroundColor: theme.border,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!isLoading && evidenceList && evidenceList.length === 0 && (
        <div style={{ ...styles.emptyState, backgroundColor: theme.cardBackground }}>
          <p style={{ ...styles.emptyTitle, color: theme.text }}>No evidence saved yet</p>
          <p style={{ ...styles.emptyText, color: theme.textMuted }}>
            Flagged alerts, checked files, and analyzed conversations will appear here automatically.
          </p>
        </div>
      )}

      {!isLoading && evidenceList && evidenceList.length > 0 && (
        <div style={styles.list}>
          {evidenceList.map((item) => (
            <div
              key={item.id}
              style={{
                ...styles.card,
                backgroundColor: theme.cardBackground,
              }}
            >
              {/* Top row: text + action buttons */}
              <div
                style={{
                  ...styles.cardRow,
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                }}
              >
                <div style={styles.cardLeft}>
                  <span style={styles.icon}>{typeIcon(item.type)}</span>
                  <div>
                    <h3 style={styles.itemTitle}>{item.title}</h3>
                    <p style={{ ...styles.itemMeta, color: theme.textMuted }}>
                      Saved: {item.timestamp} • Type: {item.type}
                    </p>
                    {item.reason && (
                      <p style={{ ...styles.itemMeta, color: theme.textMuted }}>
                        Reason: {item.reason}
                      </p>
                    )}
                    <p style={{ ...styles.hash, color: theme.textMuted }}>
                      Hash: {item.hash || item.legacyHash}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    ...styles.cardRight,
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    width: isMobile ? '100%' : 'auto',
                  }}
                >
                  {item.verified === null && (
                    <button
                      style={{ ...styles.verifyButton, ...buttonStyle, backgroundColor: theme.accent }}
                      onClick={() => handleVerify(item.id)}
                      disabled={verifyingId === item.id}
                    >
                      {verifyingId === item.id ? 'Verifying...' : t('vault.verify')}
                    </button>
                  )}
                  {item.verified === true && (
                    <span style={styles.verifiedBadge}>✅ {t('vault.verified')}</span>
                  )}
                  {item.verified === false && (
                    <span style={styles.tamperedBadge}>⚠️ {t('vault.tampered')}</span>
                  )}
                  <button
                    style={{
                      ...styles.exportButton,
                      ...buttonStyle,
                      backgroundColor: theme.border,
                      color: theme.text,
                    }}
                    onClick={() => downloadEvidence(item.id)}
                  >
                    {t('vault.export')}
                  </button>
                </div>
              </div>

              {/* Inline preview (#9) — only for Image / Audio / Video */}
              {hasPreview(item.type) && (
                <MediaPreview
                  item={item}
                  onImageClick={setLightboxItem}
                  styles={styles}
                  theme={theme}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image lightbox */}
      {lightboxItem && (
        <div style={styles.lightboxOverlay} onClick={() => setLightboxItem(null)}>
          <div style={styles.lightboxInner} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxItem(null)}
              aria-label="Close"
              style={styles.lightboxClose}
            >
              ✕
            </button>
            <img
              src={evidenceApi.fileUrl(lightboxItem.id)}
              alt={lightboxItem.title || 'Evidence image'}
              style={styles.lightboxImg}
            />
            <div style={{ ...styles.lightboxCaption, backgroundColor: theme.cardBackground, color: theme.text }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>{lightboxItem.title}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>
                SHA-256: {lightboxItem.hash || lightboxItem.legacyHash}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Pulse animation for skeleton placeholders; disabled for users who
// have reduced motion turned on.
const skeletonCss = `
  @keyframes sz-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  .sz-skeleton {
    display: inline-block;
    border-radius: 6px;
    animation: sz-pulse 1.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .sz-skeleton { animation: none; }
  }
`;

const styles = {
  container: { minHeight: '100vh', fontFamily: 'Arial' },
  title: { marginBottom: '5px' },
  subtitle: { marginBottom: '30px' },
  list: { display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '750px' },

  // Card is now a column: top row (text + buttons) + optional media row
  card: {
    borderRadius: '10px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '15px',
  },
  cardLeft: { display: 'flex', gap: '14px', alignItems: 'flex-start', minWidth: 0 },
  icon: { fontSize: '26px' },
  itemTitle: { margin: '0 0 4px 0', fontSize: '15px' },
  itemMeta: { margin: '0 0 4px 0', fontSize: '13px' },
  hash: { margin: 0, fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' },
  cardRight: { display: 'flex', gap: '10px', flexShrink: 0 },
  verifyButton: { color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  verifiedBadge: { color: '#52e07a', fontSize: '13px', fontWeight: 'bold' },
  tamperedBadge: { color: '#e05252', fontSize: '13px', fontWeight: 'bold' },
  exportButton: { border: 'none', borderRadius: '6px', cursor: 'pointer' },

  // --- Inline media preview (#9) ---
  previewWrap: {
    width: '100%',
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#00000011',
  },
  thumbnail: {
    display: 'block',
    width: '100%',
    maxHeight: '260px',
    objectFit: 'cover',
    cursor: 'zoom-in',
    borderRadius: '8px',
  },
  audioPlayer: {
    width: '100%',
    display: 'block',
  },
  videoPlayer: {
    width: '100%',
    maxHeight: '360px',
    display: 'block',
    borderRadius: '8px',
    background: '#000',
  },

  // --- Lightbox ---
  lightboxOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 4000,
  },
  lightboxInner: {
    position: 'relative',
    maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  lightboxImg: {
    maxWidth: '90vw',
    maxHeight: '78vh',
    objectFit: 'contain',
    borderRadius: '10px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  lightboxCaption: {
    padding: '12px 16px',
    borderRadius: '10px',
    wordBreak: 'break-word',
  },
  lightboxClose: {
    position: 'absolute',
    top: '-14px',
    insetInlineEnd: '-14px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    background: '#ffffff',
    color: '#0f1010',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
  },

  // --- Skeletons ---
  skeletonIcon: { width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0 },
  skeletonLine: { height: '11px' },
  skeletonButton: { height: '32px', borderRadius: '6px' },
  emptyState: {
    borderRadius: '10px',
    padding: '40px 20px',
    maxWidth: '750px',
    textAlign: 'center',
  },
  emptyTitle: { fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0' },
  emptyText: { fontSize: '14px', margin: 0 },
};

export default EvidenceVault;