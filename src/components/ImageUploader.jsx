import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, Camera, Image as ImageIcon, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BUCKET = 'media';

const btnStyle = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '6px', padding: '12px', backgroundColor: 'var(--color-surface)', color: 'var(--color-primary-ink)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)',
  fontSize: '13px', fontWeight: 500, cursor: 'pointer', touchAction: 'manipulation',
};

function extOf(file) {
  const m = (file.type || '').match(/^image\/(\w+)/);
  if (m) return m[1].replace('jpeg', 'jpg');
  const n = file.name?.match(/\.(\w+)$/);
  return n ? n[1].toLowerCase() : 'jpg';
}

function fmtError(err) {
  if (!err) return 'שגיאה לא ידועה';
  const parts = [];
  if (err.message)    parts.push(err.message);
  if (err.statusCode) parts.push(`(${err.statusCode})`);
  else if (err.status) parts.push(`(${err.status})`);
  if (err.error && err.error !== err.message) parts.push(`[${err.error}]`);
  return parts.join(' ') || JSON.stringify(err);
}

export default function ImageUploader({ currentUrl, onUploaded, label = 'תמונה' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);
  const galleryRef = useRef(null);
  const cameraRef  = useRef(null);

  async function handleUpload(e) {
    setError('');
    setSuccess(false);

    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('הקובץ גדול מ-10MB');
      return;
    }

    setUploading(true);
    try {
      const ext      = extOf(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const contentType = file.type || 'image/jpeg';

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, { cacheControl: '3600', contentType, upsert: false });

      if (upErr) {
        const msg = fmtError(upErr);
        console.error('[ImageUploader] upload failed:', upErr);

        const isRLS = String(upErr.statusCode) === '403'
          || String(upErr.status) === '403'
          || (upErr.message || '').toLowerCase().includes('policy')
          || (upErr.message || '').toLowerCase().includes('unauthorized')
          || (upErr.error  || '').toLowerCase().includes('unauthorized');

        if (isRLS) {
          setError(
            `שגיאת הרשאות (403) — ה-bucket "${BUCKET}" חסום לכתיבה.\n` +
            `פתרון: Supabase → Storage → bucket "media" → Policies → ` +
            `New policy → "Full Access" לאנונימי.\n` +
            `SQL: CREATE POLICY "anon_upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'media');`
          );
        } else {
          setError(`שגיאת העלאה: ${msg}`);
        }
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        setError('לא התקבל URL ציבורי — וודאי ש-bucket "media" מוגדר כ-Public ב-Supabase.');
        return;
      }

      const result = onUploaded(urlData.publicUrl);
      if (result && typeof result.then === 'function') {
        const outcome = await result;
        if (outcome === false || (outcome && outcome.ok === false)) {
          setError(`שמירה ב-DB נכשלה — בדקי הרשאות על טבלת gallery ב-Supabase.`);
          return;
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);

    } catch (err) {
      console.error('[ImageUploader] uncaught exception:', err);
      setError(`שגיאה לא צפויה: ${err?.message || String(err)}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {label && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-primary-ink)', marginBottom: '8px', fontWeight: 500 }}>
          {label}
        </p>
      )}

      {currentUrl ? (
        <div>
          <img
            src={currentUrl} alt=""
            style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: 'var(--radius-lg)', display: 'block' }}
            onError={ev => { ev.target.style.border = '2px solid var(--color-accent)'; ev.target.alt = 'תמונה לא זמינה'; }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => galleryRef.current?.click()} style={btnStyle} disabled={uploading}>
              <ImageIcon size={16} /><span>{uploading ? 'מעלה...' : 'החלף'}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => onUploaded('')} style={{ ...btnStyle, color: 'var(--color-accent)' }} disabled={uploading}>
              <X size={16} /><span>הסר</span>
            </motion.button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 16px', border: '1.5px dashed var(--color-border-dark)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg)' }}>
          {uploading
            ? <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-muted)', margin: 0 }}>מעלה...</p>
            : <>
                <Upload size={28} color="var(--color-text-muted)" strokeWidth={1.5} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-muted)', margin: 0 }}>הוסיפי תמונה</p>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => galleryRef.current?.click()} style={btnStyle} disabled={uploading}>
                    <ImageIcon size={16} /><span>מהגלריה</span>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => cameraRef.current?.click()} style={btnStyle} disabled={uploading}>
                    <Camera size={16} /><span>צילום</span>
                  </motion.button>
                </div>
              </>
          }
        </div>
      )}

      <input ref={galleryRef} type="file" accept="image/*"                    onChange={handleUpload} style={{ display: 'none' }} />
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: 'none' }} />

      {/* Success flash */}
      {success && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '8px 12px', backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(76,175,80,0.2)' }}>
          <CheckCircle size={14} color="var(--color-success)" />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-success)' }}>הועלה בהצלחה!</span>
        </motion.div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{ marginTop: 8, padding: '10px 12px', backgroundColor: 'rgba(168,90,74,0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(168,90,74,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <AlertTriangle size={14} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: 1 }} />
            <pre style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-accent)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', direction: 'rtl' }}>
              {error}
            </pre>
          </div>
          <button onClick={() => setError('')} style={{ marginTop: 6, background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0 }}>
            סגור ✕
          </button>
        </div>
      )}
    </div>
  );
}
