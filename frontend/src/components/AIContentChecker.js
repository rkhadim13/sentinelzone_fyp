import React, { useState, useRef, useEffect, useCallback } from 'react';
import useIsMobile from '../useIsMobile';
import { useTheme } from '../ThemeContext';
import { useAppContext } from '../AppContext';
import { evidenceApi } from '../services/api';

// Files bigger than this are rejected before upload.
const MAX_FILE_MB = 50;

// Some browsers report an empty MIME type for dragged files, so we fall
// back to the extension.
const EXTENSION_TYPES = {
  jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', webp: 'Image', bmp: 'Image', heic: 'Image',
  mp3: 'Audio', wav: 'Audio', m4a: 'Audio', ogg: 'Audio', aac: 'Audio', flac: 'Audio',
  mp4: 'Video', mov: 'Video', webm: 'Video', avi: 'Video', mkv: 'Video', m4v: 'Video',
};

function detectType(file) {
  const mime = file.type || '';
  if (mime.startsWith('image')) return 'Image';
  if (mime.startsWith('audio')) return 'Audio';
  if (mime.startsWith('video')) return 'Video';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return EXTENSION_TYPES[ext] || null;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AIContentChecker() {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const { setEvidenceList } = useAppContext();

  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [savedToVault, setSavedToVault] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const inputRef = useRef(null);
  const dragDepth = useRef(0);

  const fileName = file ? file.name : null;

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const processFile = useCallback(
    async (picked) => {
      if (!picked) return;

      setFile(picked);
      setResult(null);
      setError(null);
      setSavedToVault(false);
      setPreviewUrl(null);

      const type = detectType(picked);

      if (!type) {
        setError('That file type is not supported. Use an image, video, or audio file.');
        return;
      }

      if (picked.size === 0) {
        setError('That file is empty. Choose a different one.');
        return;
      }

      if (picked.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`That file is ${formatSize(picked.size)}. The limit is ${MAX_FILE_MB} MB.`);
        return;
      }

      if (type === 'Image') {
        setPreviewUrl(URL.createObjectURL(picked));
      }

      setAnalyzing(true);
      setStage('uploading');
      setUploadProgress(0);

      try {
        const evidence = await evidenceApi.upload({
          title: `AI Check - ${picked.name}`,
          type,
          file: picked,
          onProgress: setUploadProgress,
        });
        setEvidenceList((prev) => [evidence, ...prev]);
        setSavedToVault(true);
        setStage('checking');

        const { evidence: updatedEvidence, result: mlResult } = await evidenceApi.analyze(evidence.id);
        setResult({ confidence: Math.round(mlResult.confidence), verdict: mlResult.verdict });
        setEvidenceList((prev) => prev.map((ev) => (ev.id === updatedEvidence.id ? updatedEvidence : ev)));
      } catch (err) {
        console.error('AI content check failed:', err);
        setError(err.message || 'Something went wrong while analyzing this file.');
      } finally {
        setAnalyzing(false);
        setStage(null);
      }
    },
    [setEvidenceList]
  );

  const handleFileSelect = (e) => {
    const picked = e.target.files[0];
    e.target.value = '';
    processFile(picked);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);

    const dropped = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : [];
    if (dropped.length === 0) {
      setFile({ name: 'Dropped item' });
      setError('That was not a file. Drag a file from your computer.');
      return;
    }
    if (dropped.length > 1) {
      setError('Only one file at a time. Checking the first one.');
    }
    processFile(dropped[0]);
  };

  const openPicker = () => {
    if (inputRef.current) inputRef.current.click();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  };

  useEffect(() => {
    if (file || analyzing) return undefined;
    const onPaste = (e) => {
      const items = e.clipboardData && e.clipboardData.files;
      if (items && items.length > 0) {
        e.preventDefault();
        processFile(items[0]);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [file, analyzing, processFile]);

  useEffect(() => {
    const swallow = (e) => e.preventDefault();
    window.addEventListener('dragover', swallow);
    window.addEventListener('drop', swallow);
    return () => {
      window.removeEventListener('dragover', swallow);
      window.removeEventListener('drop', swallow);
    };
  }, []);

  const resetChecker = () => {
    setFile(null);
    setResult(null);
    setAnalyzing(false);
    setStage(null);
    setUploadProgress(0);
    setSavedToVault(false);
    setError(null);
    setPreviewUrl(null);
    dragDepth.current = 0;
    setIsDragging(false);
  };

  const cardWidth = isMobile ? '100%' : '350px';

  return (
    <div style={{ ...styles.container, backgroundColor: theme.background, color: theme.text }}>
      <h1 style={{ ...styles.title, fontSize: isMobile ? '22px' : '26px' }}>🧠 AI Content Checker</h1>
      <p
        style={{
          ...styles.subtitle,
          fontSize: isMobile ? '14px' : '16px',
          color: theme.textMuted,
        }}
      >
        Drop an image, video, or audio file here to check if it's AI-generated or manipulated.
      </p>

      {!fileName && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a file to check"
          onClick={openPicker}
          onKeyDown={handleKeyDown}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            ...styles.uploadZone,
            width: cardWidth,
            // Taller tap target on mobile — the whole zone is already
            // tappable, this just gives thumbs more room to land accurately.
            padding: isMobile ? '48px 20px' : '40px 20px',
            backgroundColor: isDragging ? theme.background : theme.cardBackground,
            borderColor: isDragging ? '#e0a852' : theme.border,
            borderWidth: isDragging ? '3px' : '2px',
            transform: isDragging ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          <span style={styles.uploadIcon}>{isDragging ? '📥' : '📤'}</span>
          <span style={{ ...styles.uploadText, fontSize: isMobile ? '16px' : '15px' }}>
            {isDragging ? 'Release to check this file' : 'Tap to browse, or drag a file here'}
          </span>
          <span style={{ ...styles.uploadSubtext, color: theme.textMuted }}>
            Images, video, and audio · up to {MAX_FILE_MB} MB
          </span>
          {!isMobile && (
            <span style={{ ...styles.uploadSubtext, color: theme.textMuted, marginTop: '6px' }}>
              You can also paste a screenshot with Ctrl+V
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,audio/*,video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {fileName && (
        <div style={{ ...styles.resultCard, width: cardWidth, backgroundColor: theme.cardBackground }}>
          {previewUrl && (
            <img src={previewUrl} alt={fileName} style={styles.preview} />
          )}

          <p style={{ ...styles.fileNameText, color: theme.textMuted }}>
            📄 {fileName}
            {file && typeof file.size === 'number' ? ` · ${formatSize(file.size)}` : ''}
          </p>

          {analyzing && stage === 'uploading' && (
            <>
              <p style={{ ...styles.analyzingText, color: theme.accent }}>
                ⬆️ Uploading... {uploadProgress}%
              </p>
              <div style={{ ...styles.confidenceBarTrack, backgroundColor: theme.background }}>
                <div style={{ ...styles.confidenceBarFill, width: `${uploadProgress}%` }} />
              </div>
            </>
          )}

          {analyzing && stage === 'checking' && (
            <p style={{ ...styles.analyzingText, color: theme.accent }}>🔍 Analyzing content, please wait...</p>
          )}

          {!analyzing && error && (
            <>
              <p style={styles.errorText}>⚠️ {error}</p>
              <button
                style={{
                  ...styles.resetButton,
                  width: isMobile ? '100%' : 'auto',
                  padding: isMobile ? '13px 20px' : '10px 20px',
                  fontSize: isMobile ? '15px' : '14px',
                  backgroundColor: theme.accent,
                }}
                onClick={resetChecker}
              >
                Check another file
              </button>
            </>
          )}

          {!analyzing && !error && result && (
            <>
              <div style={styles.verdictBox}>
                <p style={styles.confidenceNumber}>{result.confidence}%</p>
                <p style={styles.verdictText}>{result.verdict}</p>
              </div>

              <div style={{ ...styles.confidenceBarTrack, backgroundColor: theme.background }}>
                <div style={{ ...styles.confidenceBarFill, width: `${result.confidence}%` }} />
              </div>

              {savedToVault && <p style={styles.savedNote}>✅ Saved to Evidence Vault</p>}

              <button
                style={{
                  ...styles.resetButton,
                  width: isMobile ? '100%' : 'auto',
                  padding: isMobile ? '13px 20px' : '10px 20px',
                  fontSize: isMobile ? '15px' : '14px',
                  backgroundColor: theme.accent,
                }}
                onClick={resetChecker}
              >
                Check another file
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '30px 16px',
    fontFamily: 'Arial',
    boxSizing: 'border-box',
  },
  title: { marginBottom: '5px' },
  subtitle: { marginBottom: '40px', textAlign: 'center', maxWidth: '450px' },
  uploadZone: {
    border: '2px dashed',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    boxSizing: 'border-box',
    maxWidth: '350px',
    outlineOffset: '4px',
    transition: 'border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease',
  },
  uploadIcon: { fontSize: '36px', marginBottom: '10px' },
  uploadText: { marginBottom: '5px' },
  uploadSubtext: { fontSize: '12px' },
  resultCard: {
    borderRadius: '12px',
    padding: '30px 20px',
    textAlign: 'center',
    boxSizing: 'border-box',
    maxWidth: '350px',
  },
  preview: {
    width: '100%',
    maxHeight: '180px',
    objectFit: 'contain',
    borderRadius: '8px',
    marginBottom: '16px',
    display: 'block',
  },
  fileNameText: { fontSize: '14px', marginBottom: '20px', wordBreak: 'break-word' },
  analyzingText: { fontSize: '15px' },
  errorText: { fontSize: '14px', color: '#f4a6a6', marginBottom: '16px' },
  verdictBox: { marginBottom: '15px' },
  confidenceNumber: { fontSize: '40px', fontWeight: 'bold', color: '#e0a852', margin: '0 0 5px 0' },
  verdictText: { fontSize: '15px', color: '#f4a6a6', margin: 0 },
  confidenceBarTrack: { borderRadius: '10px', height: '10px', width: '100%', marginBottom: '20px', overflow: 'hidden' },
  confidenceBarFill: { backgroundColor: '#e0a852', height: '100%', borderRadius: '10px', transition: 'width 0.5s ease' },
  savedNote: { fontSize: '13px', color: '#52e07a', marginBottom: '15px' },
  resetButton: { color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
};

export default AIContentChecker;