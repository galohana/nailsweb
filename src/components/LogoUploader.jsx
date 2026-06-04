import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BUCKET  = 'media';
const MAX_IMG = 5 * 1024 * 1024; // 5 MB

function extOf(file) {
  if (file.type === 'image/svg+xml') return 'svg';
  const m = (file.type || '').match(/\/(\w+)/);
  if (m) return m[1].replace('jpeg', 'jpg');
  const n = file.name?.match(/\.(\w+)$/);
  return n ? n[1].toLowerCase() : 'jpg';
}

const btnStyle = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 6, padding: '11px', backgroundColor: 'var(--color-surface)', color: 'var(--color-primary-ink)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', touchAction: 'manipulation', position: 'relative',
};

/* ── FileButton — כפתור עם input מיוצב מעליו לפתיחת בורר הקבצים ──
   מונע את בעיית ה-"user gesture" (הקרוסלה חוטפת אירועי pointer מ-framer-motion).
   הinput מכסה את הכפתור ב-opacity:0 → הקשה ישירה על הinput = "trusted" event. */
function FileButton({ onFile, onPick, children, style, disabled }) {
  const id = useRef(`fu-${Math.random().toString(36).slice(2)}`);
  return (
    <div style={{ ...style, position: 'relative', overflow: 'hidden' }}>
      {children}
      <input
        id={id.current}
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={onFile}
        onClick={onPick}
        onPointerDown={(e) => { e.stopPropagation(); onPick?.(); }}
        style={{
          position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
          fontSize: 0, width: '100%', height: '100%',
        }}
      />
    </div>
  );
}

export default function LogoUploader({ currentUrl, onUploaded, onBusyChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);
  const uploadingRef = useRef(false);

  // לחיצה על "החלף/בחרי קובץ" → עוצרים את הקרוסלה. חידוש: בסיום העלאה (finally)
  // או כשהמשתמש ביטל את בורר הקבצים (החלון חוזר ל-focus בלי שהתחילה העלאה).
  const handlePick = useCallback(() => {
    onBusyChange?.(true);
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => { if (!uploadingRef.current) onBusyChange?.(false); }, 400);
    };
    window.addEventListener('focus', onFocus);
  }, [onBusyChange]);

  const handleFile = async (e) => {
    setError('');
    setSuccess(false);
    const file = e.target.files?.[0];
    if (!file) { onBusyChange?.(false); return; }

    if (file.size > MAX_IMG) {
      setError('הקובץ גדול מ-5MB');
      e.target.value = '';
      onBusyChange?.(false);
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    try {
      const ext      = extOf(file);
      const fileName = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const contentType = file.type || 'image/png';

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, { cacheControl: '3600', contentType, upsert: false });

      if (upErr) { setError(`שגיאת העלאה: ${upErr.message}`); return; }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      if (!urlData?.publicUrl) { setError('לא התקבל URL — וודאי ש-bucket "media" ציבורי'); return; }

      onUploaded?.(urlData.publicUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(`שגיאה: ${err?.message || String(err)}`);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      e.target.value = '';
      onBusyChange?.(false);   // הסיטואציה הסתיימה → הקרוסלה ממשיכה
    }
  };

  return (
    <div>
      {/* Preview */}
      {currentUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <img
            src={currentUrl} alt="לוגו"
            style={{ width: 80, height: 80, borderRadius: 'var(--radius-full)', objectFit: 'contain', border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
            onError={ev => { ev.target.style.border = '2px solid var(--color-accent)'; }}
          />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>לוגו נוכחי</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <FileButton onFile={handleFile} onPick={handlePick} style={btnStyle} disabled={uploading}>
                <Upload size={14} />{uploading ? 'מעלה...' : 'החלף'}
              </FileButton>
              <motion.button whileTap={{ scale: 0.97 }} type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onUploaded?.('')}
                style={{ ...btnStyle, color: 'var(--color-accent)' }} disabled={uploading}>
                <X size={14} />הסר
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* Upload zone (no logo yet) */}
      {!currentUrl && (
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '22px 16px', border: '1.5px dashed var(--color-border-dark)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg)', marginBottom: 8 }}
        >
          {uploading ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-muted)', margin: 0 }}>מעלה...</p>
          ) : (
            <>
              <Upload size={26} color="var(--color-text-muted)" strokeWidth={1.5} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>PNG / JPG / SVG עד 5MB</p>
              <FileButton onFile={handleFile} onPick={handlePick} style={{ ...btnStyle, width: '100%' }} disabled={uploading}>
                <Upload size={14} />בחרי קובץ
              </FileButton>
            </>
          )}
        </div>
      )}

      {/* אין יותר input נסתר — FileButton מטפל ישירות */}

      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '8px 12px', backgroundColor: 'var(--color-success-10)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-success-20)' }}>
            <CheckCircle size={14} color="var(--color-success)" />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-success)' }}>הועלה בהצלחה!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div style={{ marginTop: 8, padding: '10px 12px', backgroundColor: 'var(--color-error-07)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-error-20)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <AlertTriangle size={14} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-accent)', margin: 0 }}>{error}</p>
          </div>
          <button onClick={() => setError('')} style={{ marginTop: 4, background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0 }}>סגור ✕</button>
        </div>
      )}
    </div>
  );
}
