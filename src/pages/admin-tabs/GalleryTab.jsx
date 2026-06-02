import { useState, useEffect, useCallback, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { db } from '../../utils/db';
import { DEFAULT_HERO } from '../../utils/defaults';
import * as S from '../../utils/adminStyles';
import ImageUploader from '../../components/ImageUploader';
import MediaUploader from '../../components/MediaUploader';

const MAX = 10;

// ── Error boundary so a bug here doesn't crash the whole admin ───
class TabBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[GalleryTab] crash:', err, info); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 18, backgroundColor: 'rgba(168,90,74,0.08)', border: '1px solid rgba(168,90,74,0.25)', borderRadius: 'var(--demo-radius-card)', direction: 'rtl' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} color="#A85A4A" />
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14, color: '#A85A4A', margin: 0, fontWeight: 600 }}>הטאב קרס</p>
          </div>
          <pre style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {String(this.state.err?.message || this.state.err)}
          </pre>
          <button onClick={() => this.setState({ err: null })} style={{ marginTop: 10, padding: '6px 12px', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 8, fontFamily: 'var(--demo-body-font)', fontSize: 12, cursor: 'pointer' }}>
            נסי שוב
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function GalleryTab() {
  const [sub, setSub] = useState('works');
  return (
    <TabBoundary>
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button style={S.subTab(sub === 'works')}   onClick={() => setSub('works')}>גלריה ראשונה</button>
          <button style={S.subTab(sub === 'works2')}  onClick={() => setSub('works2')}>גלריה שנייה</button>
          <button style={S.subTab(sub === 'hero')}    onClick={() => setSub('hero')}>רקע ראשי</button>
        </div>
        {sub === 'works'  ? <Works />  :
         sub === 'works2' ? <Works2 /> :
                            <Hero />}
      </div>
    </TabBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────
// Works sub-tab
// ─────────────────────────────────────────────────────────────────
function Works() {
  const [images, setImages]     = useState(null);
  const [addError, setAddError] = useState('');
  const [preview, setPreview]   = useState(''); // last-uploaded URL for immediate preview

  useEffect(() => { db.gallery.list().then(setImages); }, []);

  // Called by MediaUploader with the Storage URL + mediaType
  // Returns false on DB failure so uploader can show the error
  // Note: gallery DB only stores `image_url` — video URL stored in same field, detected by extension in render
  const add = useCallback(async (url, _mediaType) => {
    if (!url) return;
    setAddError('');
    const result = await db.gallery.add(url);
    if (!result?.ok) {
      const msg = result?.error?.message || 'שגיאה לא ידועה';
      setAddError(`שמירת הקובץ ב-DB נכשלה: ${msg}\n(בדקי הרשאות INSERT על טבלת gallery ב-Supabase)`);
      return false;
    }
    setPreview(url);
    setTimeout(() => setPreview(''), 3000);
    setImages(prev => [...(prev || []), result.item]);
  }, []);

  const del = useCallback(async (id) => {
    if (!confirm('למחוק את התמונה?')) return;
    await db.gallery.delete(id);
    setImages(prev => prev.filter(g => g.id !== id));
  }, []);

  // ── Move image left/right ────────────────────────────────────
  const move = useCallback((from, to) => {
    setImages(prev => {
      if (!prev || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      const withOrder = next.map((img, i) => ({ ...img, order: i }));
      db.gallery.updateOrder(withOrder.map(img => ({ id: img.id, order: img.order })));
      return withOrder;
    });
  }, []);

  if (!images) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  const atLimit = images.length >= MAX;

  return (
    <div>
      {/* ── Upload area ── */}
      <div style={S.card}>
        {atLimit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px', backgroundColor: 'rgba(201,155,108,0.1)', borderRadius: 'var(--demo-radius-card)', border: '1px solid rgba(201,155,108,0.25)' }}>
            <AlertTriangle size={16} color="#C99B6C" />
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: 'var(--color-section)', margin: 0 }}>
              הגעת למגבלת {MAX} תמונות — מחקי תמונה כדי להוסיף
            </p>
          </div>
        ) : (
          <MediaUploader currentUrl="" onUploaded={add} label={`הוספת תמונה/סרטון (${images.length}/${MAX})`} />
        )}

        {addError && (
          <div style={{ marginTop: 8, padding: '10px 12px', backgroundColor: 'rgba(168,90,74,0.08)', borderRadius: 8, border: '1px solid rgba(168,90,74,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <AlertTriangle size={13} color="#A85A4A" style={{ flexShrink: 0, marginTop: 1 }} />
              <pre style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: '#A85A4A', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{addError}</pre>
            </div>
          </div>
        )}

        {/* Immediate preview of last upload */}
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ marginTop: 10, overflow: 'hidden' }}
            >
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: '#4CAF50', marginBottom: 6 }}>✓ הועלה — מוצג בתחתית הגלריה</p>
              {/\.(mp4|webm|mov|ogg)(\?|$)/i.test(preview) ? (
                <video src={preview} autoPlay muted loop playsInline style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <img src={preview} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Gallery carousel + reorder ── */}
      {images.length === 0 ? (
        <div style={S.emptyState}>
          <p style={S.emptyEmoji}>🖼️</p>
          <p style={S.emptyText}>אין תמונות בגלריה</p>
        </div>
      ) : (
        <div style={S.card}>
          <p style={{ ...S.heading, fontSize: 15, marginBottom: 4 }}>תמונות ({images.length}/{MAX})</p>
          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)', marginBottom: 12 }}>
            השתמשי בחצים לשינוי סדר — שינויים נשמרים אוטומטית
          </p>
          <CarouselStrip images={images} onDelete={del} onMove={move} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Horizontal carousel with arrow-based reorder
// ─────────────────────────────────────────────────────────────────
function CarouselStrip({ images, onDelete, onMove }) {
  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: 4, scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', gap: 10, width: 'fit-content', paddingBottom: 2 }}>
        {images.map((img, i) => (
          <motion.div
            key={img.id}
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ position: 'relative', flexShrink: 0, width: 120, borderRadius: 'var(--demo-radius-card)', overflow: 'visible', boxShadow: '0 2px 8px rgba(92,61,46,0.1)' }}
          >
            {/* Image / Video */}
            <div style={{ width: 120, height: 140, borderRadius: 'var(--demo-radius-card)', overflow: 'hidden', border: '1px solid #E8DCC8' }}>
              {/\.(mp4|webm|mov|ogg)(\?|$)/i.test(img.imageUrl || '') ? (
                <video
                  src={img.imageUrl}
                  autoPlay muted loop playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <img
                  src={img.imageUrl} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={ev => { ev.target.style.backgroundColor = '#F0E6D6'; }}
                />
              )}
            </div>

            {/* Delete */}
            <button
              onClick={() => onDelete(img.id)}
              style={{ position: 'absolute', top: 4, insetInlineEnd: 4, width: 26, height: 26, borderRadius: '50%', backgroundColor: 'rgba(168,90,74,0.9)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', zIndex: 2 }}
            >
              <Trash2 size={12} />
            </button>

            {/* Order badge */}
            <div style={{ position: 'absolute', top: 4, insetInlineStart: 4, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 4, padding: '1px 5px', zIndex: 2 }}>
              <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 10, color: '#fff' }}>{i + 1}</span>
            </div>

            {/* ← → reorder buttons */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => onMove(i, i - 1)}
                disabled={i === 0}
                style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid #E8DCC8', backgroundColor: i === 0 ? '#F5EEE8' : 'var(--color-surface)', color: i === 0 ? '#C8A882' : 'var(--color-primary)', cursor: i === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
              >
                <ChevronRight size={14} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => onMove(i, i + 1)}
                disabled={i === images.length - 1}
                style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid #E8DCC8', backgroundColor: i === images.length - 1 ? '#F5EEE8' : 'var(--color-surface)', color: i === images.length - 1 ? '#C8A882' : 'var(--color-primary)', cursor: i === images.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
              >
                <ChevronLeft size={14} />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Works2 sub-tab — second carousel, stored in settings as 'gallery2'
// ─────────────────────────────────────────────────────────────────
const MAX2 = 10;

function Works2() {
  const [images, setImages]     = useState(null);
  const [addError, setAddError] = useState('');
  const [preview, setPreview]   = useState('');

  useEffect(() => {
    db.settings.get('gallery2', []).then(arr => {
      setImages(Array.isArray(arr) ? arr : []);
    });
  }, []);

  const persist = (arr) => db.settings.set('gallery2', arr);

  const add = useCallback(async (url) => {
    if (!url) return;
    setAddError('');
    const item = { id: `g2_${Date.now()}`, url };
    const next = [...(images || []), item];
    setImages(next);
    await persist(next);
    setPreview(url);
    setTimeout(() => setPreview(''), 3000);
  }, [images]);

  const del = useCallback(async (id) => {
    if (!confirm('למחוק את התמונה?')) return;
    const next = images.filter(g => g.id !== id);
    setImages(next);
    await persist(next);
  }, [images]);

  const move = useCallback((from, to) => {
    setImages(prev => {
      if (!prev || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persist(next);
      return next;
    });
  }, []);

  if (!images) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  const atLimit = images.length >= MAX2;

  return (
    <div>
      <div style={S.card}>
        {atLimit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px', backgroundColor: 'rgba(201,155,108,0.1)', borderRadius: 'var(--demo-radius-card)', border: '1px solid rgba(201,155,108,0.25)' }}>
            <AlertTriangle size={16} color="#C99B6C" />
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: 'var(--color-section)', margin: 0 }}>
              הגעת למגבלת {MAX2} תמונות — מחקי תמונה כדי להוסיף
            </p>
          </div>
        ) : (
          <MediaUploader currentUrl="" onUploaded={add} label={`הוספת תמונה/סרטון לגלריה שנייה (${images.length}/${MAX2})`} />
        )}
        {addError && (
          <div style={{ marginTop: 8, padding: '10px 12px', backgroundColor: 'rgba(168,90,74,0.08)', borderRadius: 8, border: '1px solid rgba(168,90,74,0.2)' }}>
            <pre style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: '#A85A4A', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{addError}</pre>
          </div>
        )}
        <AnimatePresence>
          {preview && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: 10, overflow: 'hidden' }}>
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: '#4CAF50', marginBottom: 6 }}>✓ הועלה</p>
              {/\.(mp4|webm|mov|ogg)(\?|$)/i.test(preview) ? (
                <video src={preview} autoPlay muted loop playsInline style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <img src={preview} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {images.length === 0 ? (
        <div style={S.emptyState}>
          <p style={S.emptyEmoji}>🖼️</p>
          <p style={S.emptyText}>אין תמונות בגלריה השנייה</p>
          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            עד שתוסיפי — הגלריה השנייה תציג את תמונות הגלריה הראשונה
          </p>
        </div>
      ) : (
        <div style={S.card}>
          <p style={{ ...S.heading, fontSize: 15, marginBottom: 4 }}>תמונות ({images.length}/{MAX2})</p>
          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)', marginBottom: 12 }}>
            השתמשי בחצים לשינוי סדר — שינויים נשמרים אוטומטית
          </p>
          <CarouselStrip2 images={images} onDelete={del} onMove={move} />
        </div>
      )}
    </div>
  );
}

function CarouselStrip2({ images, onDelete, onMove }) {
  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: 4, scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', gap: 10, width: 'fit-content', paddingBottom: 2 }}>
        {images.map((img, i) => (
          <motion.div
            key={img.id}
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ position: 'relative', flexShrink: 0, width: 120, borderRadius: 'var(--demo-radius-card)', overflow: 'visible', boxShadow: '0 2px 8px rgba(92,61,46,0.1)' }}
          >
            <div style={{ width: 120, height: 140, borderRadius: 'var(--demo-radius-card)', overflow: 'hidden', border: '1px solid #E8DCC8' }}>
              {/\.(mp4|webm|mov|ogg)(\?|$)/i.test(img.url || '') ? (
                <video src={img.url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={ev => { ev.target.style.backgroundColor = '#F0E6D6'; }} />
              )}
            </div>
            <button
              onClick={() => onDelete(img.id)}
              style={{ position: 'absolute', top: 4, insetInlineEnd: 4, width: 26, height: 26, borderRadius: '50%', backgroundColor: 'rgba(168,90,74,0.9)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', zIndex: 2 }}
            >
              <Trash2 size={12} />
            </button>
            <div style={{ position: 'absolute', top: 4, insetInlineStart: 4, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 4, padding: '1px 5px', zIndex: 2 }}>
              <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 10, color: '#fff' }}>{i + 1}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => onMove(i, i - 1)}
                disabled={i === 0}
                style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid #E8DCC8', backgroundColor: i === 0 ? '#F5EEE8' : 'var(--color-surface)', color: i === 0 ? '#C8A882' : 'var(--color-primary)', cursor: i === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
              >
                <ChevronRight size={14} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => onMove(i, i + 1)}
                disabled={i === images.length - 1}
                style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid #E8DCC8', backgroundColor: i === images.length - 1 ? '#F5EEE8' : 'var(--color-surface)', color: i === images.length - 1 ? '#C8A882' : 'var(--color-primary)', cursor: i === images.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
              >
                <ChevronLeft size={14} />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hero sub-tab
// ─────────────────────────────────────────────────────────────────
function Hero() {
  const [hero, setHero] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { db.settings.get('hero', DEFAULT_HERO).then(setHero); }, []);

  const update = (url, mediaType) => {
    const next = {
      ...hero,
      imageUrl:  mediaType === 'image' ? url : (hero.imageUrl || ''),
      videoUrl:  mediaType === 'video' ? url : '',
      mediaType: url ? mediaType : 'image',
    };
    setHero(next);
    db.settings.set('hero', next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  if (!hero) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={S.heading}>רקע ראשי</p>
        <AnimatePresence>
          {saved && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#4CAF50', fontSize: 12 }}>
              ✓ נשמר
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p style={S.subText}>התמונה/סרטון הגדול בראש דף הבית</p>
      <MediaUploader
        currentUrl={hero.mediaType === 'video' ? (hero.videoUrl || '') : (hero.imageUrl || '')}
        currentType={hero.mediaType || 'image'}
        onUploaded={update}
        label=""
      />
    </div>
  );
}
