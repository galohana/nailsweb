import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Camera, Image as ImageIcon, Video, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BUCKET   = 'media';
const MAX_IMG  = 10 * 1024 * 1024;   // 10 MB
const MAX_VID  = 15 * 1024 * 1024;   // 15 MB
const MAX_DUR  = 10;                  // 10 seconds

const btnStyle = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '6px', padding: '12px', backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)',
  fontSize: '13px', fontWeight: 500, cursor: 'pointer', touchAction: 'manipulation',
};

function extOf(file) {
  const m = (file.type || '').match(/\/([\w]+)/);
  if (m) return m[1].replace('jpeg', 'jpg').replace('quicktime', 'mov');
  const n = file.name?.match(/\.(\w+)$/);
  return n ? n[1].toLowerCase() : 'jpg';
}

function fmtError(err) {
  if (!err) return 'שגיאה לא ידועה';
  return [err.message, err.statusCode && `(${err.statusCode})`].filter(Boolean).join(' ');
}

function validateVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(vid.duration);
    };
    vid.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    vid.src = url;
  });
}

export default function MediaUploader({
  currentUrl,
  currentType = 'image',
  onUploaded,       // (url, mediaType) => void
  label = 'מדיה',
}) {
  const [mode, setMode]       = useState(currentType === 'video' ? 'video' : 'image');
  const [uploading, setUploading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const galleryRef     = useRef(null);
  const cameraRef      = useRef(null);
  const videoRef       = useRef(null);
  const videoCameraRef = useRef(null);

  const handleUpload = async (e, isVideo = false) => {
    setError('');
    setSuccess(false);
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = isVideo ? MAX_VID : MAX_IMG;
    if (file.size > maxSize) {
      setError(isVideo ? `הסרטון גדול מ-15MB` : `הקובץ גדול מ-10MB`);
      e.target.value = '';
      return;
    }

    if (isVideo) {
      const duration = await validateVideoDuration(file);
      if (duration !== null && duration > MAX_DUR) {
        setError(`הסרטון ארוך מ-10 שניות (${Math.round(duration)}ש׳) — קצרי אותו ונסי שוב`);
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    try {
      const ext      = extOf(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const contentType = file.type || (isVideo ? 'video/mp4' : 'image/jpeg');

      const { data: upData, error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, { cacheControl: '3600', contentType, upsert: false });

      if (upErr) {
        setError(`שגיאת העלאה: ${fmtError(upErr)}`);
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      if (!urlData?.publicUrl) {
        setError('לא התקבל URL ציבורי — וודאי ש-bucket "media" ציבורי');
        return;
      }

      const mediaType = isVideo ? 'video' : 'image';
      onUploaded?.(urlData.publicUrl, mediaType);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(`שגיאה לא צפויה: ${err?.message || String(err)}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const hasMedia = !!currentUrl;
  const isCurrentVideo = currentType === 'video';

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-primary)', marginBottom: 8, fontWeight: 500 }}>
          {label}
        </p>
      )}

      {/* Toggle image / video */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[
          { id: 'image', icon: ImageIcon, label: 'תמונה' },
          { id: 'video', icon: Video,     label: 'סרטון' },
        ].map(({ id, icon: Icon, label: lbl }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 0', borderRadius: 'var(--radius-md)',
              backgroundColor: mode === id ? 'var(--color-primary)' : 'var(--color-surface)',
              backgroundImage: mode === id ? 'var(--demo-primary-mat-overlay, none)' : 'none',
              color: mode === id ? 'var(--color-surface)' : 'var(--color-text-muted)',
              border: `1.5px solid ${mode === id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: mode === id ? 600 : 400,
              cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            <Icon size={14} />
            {lbl}
          </button>
        ))}
      </div>

      {/* Preview */}
      {hasMedia && (
        <div style={{ marginBottom: 8 }}>
          {isCurrentVideo ? (
            <video
              src={currentUrl}
              autoPlay muted loop playsInline
              style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--radius-lg)', display: 'block' }}
            />
          ) : (
            <img
              src={currentUrl} alt=""
              style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--radius-lg)', display: 'block' }}
              onError={ev => { ev.target.style.border = '2px solid var(--color-accent)'; }}
            />
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {mode === 'image' ? (
              <>
                <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => galleryRef.current?.click()} style={btnStyle} disabled={uploading}>
                  <ImageIcon size={15} /><span>{uploading ? 'מעלה...' : 'החלף'}</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => cameraRef.current?.click()} style={btnStyle} disabled={uploading}>
                  <Camera size={15} /><span>צלמי</span>
                </motion.button>
              </>
            ) : (
              <>
                <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => videoRef.current?.click()} style={btnStyle} disabled={uploading}>
                  <Video size={15} /><span>{uploading ? 'מעלה...' : 'החלף קובץ'}</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => videoCameraRef.current?.click()} style={btnStyle} disabled={uploading}>
                  <Camera size={15} /><span>צלמי</span>
                </motion.button>
              </>
            )}
            <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => onUploaded?.('', 'image')} style={{ ...btnStyle, color: 'var(--color-accent)' }} disabled={uploading}>
              <X size={15} /><span>הסר</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Upload zone (when no media) */}
      {!hasMedia && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '22px 16px', border: '1.5px dashed var(--color-border-dark)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg)' }}>
          {uploading ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-muted)', margin: 0 }}>מעלה...</p>
          ) : mode === 'image' ? (
            <>
              <Upload size={26} color="var(--color-text-muted)" strokeWidth={1.5} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>הוסיפי תמונה</p>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => galleryRef.current?.click()} style={btnStyle}>
                  <ImageIcon size={15} /><span>מהגלריה</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => cameraRef.current?.click()} style={btnStyle}>
                  <Camera size={15} /><span>צילום</span>
                </motion.button>
              </div>
            </>
          ) : (
            <>
              <Video size={26} color="var(--color-text-muted)" strokeWidth={1.5} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>הוסיפי סרטון (עד 10 שניות, 15MB)</p>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => videoRef.current?.click()} style={btnStyle}>
                  <Video size={15} /><span>בחרי קובץ</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => videoCameraRef.current?.click()} style={btnStyle}>
                  <Camera size={15} /><span>צלמי</span>
                </motion.button>
              </div>
            </>
          )}
        </div>
      )}

      <input ref={galleryRef}     type="file" accept="image/*"                                     onChange={e => handleUpload(e, false)} style={{ display: 'none' }} />
      <input ref={cameraRef}      type="file" accept="image/*" capture="environment"               onChange={e => handleUpload(e, false)} style={{ display: 'none' }} />
      <input ref={videoRef}       type="file" accept="video/*"                                     onChange={e => handleUpload(e, true)}  style={{ display: 'none' }} />
      <input ref={videoCameraRef} type="file" accept="video/*" capture="environment"               onChange={e => handleUpload(e, true)}  style={{ display: 'none' }} />

      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '8px 12px', backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(76,175,80,0.2)' }}>
            <CheckCircle size={14} color="var(--color-success)" />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-success)' }}>הועלה בהצלחה!</span>
          </motion.div>
        )}
      </AnimatePresence>

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
