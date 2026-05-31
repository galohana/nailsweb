import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, Phone, MessageCircle, X, Ban, AlertCircle, UserX, Trash2, MinusCircle } from 'lucide-react';
import { db } from '../../utils/db';
import { storage } from '../../utils/storage';
import { DEFAULT_ADMIN_SETTINGS } from '../../utils/defaults';
import * as S from '../../utils/adminStyles';

const todayDS = () => new Date().toISOString().slice(0, 10);

function getNoShowStatus(noShows, blocked, admS) {
  if (blocked) return { label: '⛔ חסומה', color: '#A85A4A', bg: 'rgba(168,90,74,0.10)' };
  if (!admS || noShows === 0) return null;
  const warn  = admS?.noShow?.warningCount ?? 2;
  const block = admS?.noShow?.blockCount   ?? 4;
  if (noShows >= block) return { label: '⛔ עברה סף חסימה', color: '#A85A4A', bg: 'rgba(168,90,74,0.10)' };
  if (noShows >= warn) {
    const rem = block - noShows;
    return { label: `נותרו ${rem} אי הגעות לחסימה`, color: '#A85A4A', bg: 'rgba(168,90,74,0.07)' };
  }
  const rem = warn - noShows;
  return { label: `נותרו ${rem} אי הגעות לאזהרה`, color: 'var(--color-section)', bg: 'rgba(92,61,46,0.05)' };
}

function toE164(phone) {
  if (!phone) return '';
  const p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) return p.slice(1);
  if (p.startsWith('972')) return p;
  if (p.startsWith('05') || p.startsWith('07')) return '972' + p.slice(1);
  return p;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function ClientsTab() {
  const [apts, setApts] = useState(null);
  const [meta, setMeta] = useState({});
  const [clientRows, setClientRows] = useState([]);
  const [admS, setAdmS] = useState(null);
  const [search, setSearch] = useState('');
  const [openClient, setOpenClient] = useState(null);
  const [saved, setSaved] = useState(false);
  // Phones (digits-only) of accounts admin marked as deleted. Survives via settings.
  // Used to mark customers as "inactive" even when they have no clients row + no future appts.
  const [deletedDigits, setDeletedDigits] = useState([]);
  // Phones permanently deleted — hidden from list entirely (past history kept in DB).
  const [permDeletedDigits, setPermDeletedDigits] = useState([]);
  // map { phoneDigits: 'male' | 'female' } — saved at register-time in settings.userGenders
  const [userGenders, setUserGenders] = useState({});

  useEffect(() => {
    Promise.all([
      db.appointments.list(),
      db.settings.get('clientsMeta', {}),
      db.clients.list(),
      db.settings.get('adminSettings', DEFAULT_ADMIN_SETTINGS),
      db.settings.get('deletedAccounts', []),
      db.settings.get('permanentlyDeletedPhones', []),
      db.settings.get('userGenders', {}),
    ]).then(([a, m, cr, s, dd, pd, gens]) => {
      setApts(a || []);
      setMeta(m || {});
      setClientRows(cr || []);
      setAdmS(s);
      setDeletedDigits(Array.isArray(dd) ? dd : []);
      setPermDeletedDigits(
        Array.isArray(pd) ? pd.map(p => String(p || '').replace(/\D/g, '')) : []
      );
      setUserGenders(gens && typeof gens === 'object' ? gens : {});
    });
  }, []);

  // Gender palette — keep in sync with Register.jsx GENDER_COLORS
  const GENDER_COLORS = {
    male:   { solid: '#4A90E2', soft: 'rgba(74,144,226,0.10)', border: 'rgba(74,144,226,0.50)', tag: 'rgba(74,144,226,0.16)' },
    female: { solid: '#E91E8C', soft: 'rgba(233,30,140,0.10)', border: 'rgba(233,30,140,0.50)', tag: 'rgba(233,30,140,0.16)' },
  };
  const genderOf = (phone) => userGenders[String(phone || '').replace(/\D/g, '')] || null;

  const markPhoneDeleted = async (phone) => {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return;
    const next = Array.from(new Set([...deletedDigits, d]));
    setDeletedDigits(next);
    await db.settings.set('deletedAccounts', next);
  };
  const unmarkPhoneDeleted = async (phone) => {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return;
    const next = deletedDigits.filter(x => x !== d);
    setDeletedDigits(next);
    await db.settings.set('deletedAccounts', next);
  };

  const markNS = async (phone, name) => {
    const newCount = await db.clients.markNoShow(phone, name);
    const shouldBlock = admS?.noShow?.autoBlock && newCount >= (admS?.noShow?.blockCount || 99);
    if (shouldBlock) await db.clients.block(phone, name);
    setClientRows(prev => {
      const exists = prev.find(c => c.phone === phone);
      if (exists) return prev.map(c => c.phone === phone ? { ...c, no_show_count: newCount, is_blocked: shouldBlock || c.is_blocked } : c);
      return [...prev, { phone, name, no_show_count: newCount, is_blocked: shouldBlock || false }];
    });
  };

  const unmarkNS = async (phone) => {
    const newCount = await db.clients.decrementNoShow(phone);
    setClientRows(prev => {
      const exists = prev.find(c => c.phone === phone);
      if (exists) return prev.map(c => c.phone === phone ? { ...c, no_show_count: newCount } : c);
      return prev;
    });
  };
  const setBlocked = async (phone, name, blocked) => {
    if (blocked) await db.clients.block(phone, name);
    else await db.clients.unblock(phone);
    setClientRows(prev => {
      const exists = prev.find(c => c.phone === phone);
      if (exists) return prev.map(c => c.phone === phone ? { ...c, is_blocked: blocked } : c);
      return [...prev, { phone, name, no_show_count: 0, is_blocked: blocked }];
    });
  };

  const clients = useMemo(() => {
    if (!apts) return null;
    const byPhone = {};
    apts.forEach(a => {
      if (!byPhone[a.phone]) byPhone[a.phone] = { phone: a.phone, name: a.userName || a.phone, appts: [] };
      byPhone[a.phone].appts.push(a);
      if (!byPhone[a.phone].name && a.userName) byPhone[a.phone].name = a.userName;
    });
    // ── Merge in clients from `clients` table that have no appointments yet ──
    // אחרת לקוחות שסומנו (NS/block) או נרשמו אך עוד לא הזמינו — לא מוצגים בכלל.
    (clientRows || []).forEach(cr => {
      if (!cr?.phone) return;
      if (!byPhone[cr.phone]) {
        byPhone[cr.phone] = { phone: cr.phone, name: cr.name || cr.phone, appts: [] };
      }
    });
    const today = todayDS();
    // Skip permanently-deleted phones — they're hidden from the list entirely.
    // Past appointments remain in DB but shouldn't create a visible client entry.
    return Object.values(byPhone)
      .filter(c => !permDeletedDigits.includes(String(c.phone || '').replace(/\D/g, '')))
      .map(c => {
      const sorted = c.appts.slice().sort((x, y) => (`${y.date}T${y.time}`).localeCompare(`${x.date}T${x.time}`));
      const m = meta[c.phone] || {};
      const cr = clientRows.find(r => r.phone === c.phone) || {};
      const hasFutureCancelled = c.appts.some(a => a.date && a.date >= today && a.status === 'cancelled');
      const hasFutureActive    = c.appts.some(a => a.date && a.date >= today && a.status === 'confirmed');
      const digits = String(c.phone || '').replace(/\D/g, '');
      const markedDeleted = deletedDigits.includes(digits);
      const inactive = markedDeleted || (hasFutureCancelled && !hasFutureActive);
      return {
        ...c,
        appts: sorted,
        total: c.appts.length,
        confirmed: c.appts.filter(a => a.status === 'confirmed').length,
        cancelled: c.appts.filter(a => a.status === 'cancelled').length,
        lastVisit: sorted.find(a => a.status === 'confirmed')?.date || null,
        vip: !!m.vip,
        notes: m.notes || '',
        noShows: cr.no_show_count || 0,
        blocked: !!cr.is_blocked,
        inactive,
      };
    }).sort((a, b) => {
      if (a.vip !== b.vip) return a.vip ? -1 : 1;
      return (b.lastVisit || '').localeCompare(a.lastVisit || '');
    });
  }, [apts, meta, clientRows, deletedDigits, permDeletedDigits]);

  const updateMeta = async (phone, k, v) => {
    const next = { ...meta, [phone]: { ...(meta[phone] || {}), [k]: v } };
    setMeta(next);
    await db.settings.set('clientsMeta', next);
    setSaved(true); setTimeout(() => setSaved(false), 1400);
  };

  // If the deleted phone matches the currently logged-in localStorage user → clear it
  const clearLocalIfMatch = (phone) => {
    try {
      const u = storage.get('user');
      const d1 = String(u?.phone || '').replace(/\D/g, '');
      const d2 = String(phone || '').replace(/\D/g, '');
      if (d1 && d2 && d1 === d2) storage.remove('user');
    } catch {}
  };

  const deleteAccount = async (phone, name) => {
    if (!confirm('בטול חשבון ימחק את כל התורים העתידיים של הלקוחה. פעולה זו אינה הפיכה.')) return;

    // ── Always mark as deleted in settings — source of truth for the "מבוטל" tag ──
    // Even if the customer exists only in appointments (no clients row), this flag
    // ensures the UI reflects the deletion and re-registration is allowed.
    await markPhoneDeleted(phone);

    // Best-effort: delete from clients + cancel future appts. Failures are logged but non-blocking.
    await Promise.all([
      db.users.deleteByPhone(phone).catch(e => { console.error('[deleteAccount] deleteByPhone threw:', e); return 'error'; }),
      db.appointments.cancelFuture(phone).catch(e => { console.error('[deleteAccount] cancelFuture threw:', e); return 0; }),
    ]);

    clearLocalIfMatch(phone);
    // Optimistic: remove from local state immediately so UI updates without waiting for re-fetch
    const d = String(phone).replace(/\D/g, '');
    setApts(prev => prev.map(a => {
      if (String(a.phone || '').replace(/\D/g, '') !== d) return a;
      const today = new Date().toISOString().slice(0,10);
      if (a.date >= today && a.status === 'confirmed') return { ...a, status: 'cancelled' };
      return a;
    }));
    setClientRows(prev => prev.filter(r => String(r.phone || '').replace(/\D/g, '') !== d));
    setOpenClient(null);
  };

  const permanentDeleteAccount = async (phone) => {
    if (!confirm('מחיקה לצמיתות תמחק את החשבון ואת כל התורים העתידיים של הלקוחה. ההיסטוריה תישמר ב-DB אך לא תוצג. לא ניתן לשחזר. בטוחה?')) return;
    const result = await db.users.permanentDelete(phone);
    if (!result.ok) {
      if (result.error === 'rls_blocked') {
        alert('המחיקה נחסמה ע"י RLS.\nרוצי ב-Supabase SQL Editor:\n\nCREATE POLICY "allow_anon_delete_clients" ON clients FOR DELETE TO anon USING (true);\nCREATE POLICY "allow_anon_delete_appointments" ON appointments FOR DELETE TO anon USING (true);');
      } else {
        alert('המחיקה נכשלה: ' + (result.error || 'unknown'));
      }
      return;
    }
    clearLocalIfMatch(phone);

    const d = String(phone || '').replace(/\D/g, '');

    // 1. Remove from soft-delete list (deletedAccounts) — no longer needed
    await unmarkPhoneDeleted(phone);

    // 2. Add to permanent-delete list — hides this phone from client list after refresh,
    //    even though past appointments still exist in DB (history preserved).
    const nextPerm = Array.from(new Set([...permDeletedDigits, d]));
    setPermDeletedDigits(nextPerm);
    await db.settings.set('permanentlyDeletedPhones', nextPerm);

    // 3. Optimistic: remove from local state immediately
    setApts(prev => prev.filter(a => String(a.phone || '').replace(/\D/g, '') !== d));
    setClientRows(prev => prev.filter(r => String(r.phone || '').replace(/\D/g, '') !== d));
    setOpenClient(null);
  };

  if (!clients) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;
  const filtered = clients.filter(c => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div>
      <div style={S.card}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color="#7D5A47" style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input style={{ ...S.input, paddingInlineStart: 36, marginBottom: 0 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={`חיפוש מתוך ${clients.length} לקוחות`} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={S.emptyState}><p style={S.emptyEmoji}>👤</p><p style={S.emptyText}>{search ? 'אין תוצאות' : 'אין לקוחות עדיין'}</p></div>
      ) : (
        <div>
          {filtered.map(c => {
            const g  = genderOf(c.phone);
            const gc = g ? GENDER_COLORS[g] : null;
            return (
            <motion.div key={c.phone} layout style={{
              ...S.card,
              padding: 14,
              // Gender frame: tint border + soft background. Falls back to default S.card when unknown.
              ...(gc ? {
                border: `1.5px solid ${gc.border}`,
                backgroundColor: gc.soft,
                boxShadow: `0 1px 4px ${gc.soft}, inset 0 0 0 1px rgba(255,255,255,0.4)`,
              } : null),
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={() => updateMeta(c.phone, 'vip', !c.vip)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, touchAction: 'manipulation' }}>
                  <Star size={20} color={c.vip ? '#F5A623' : '#D4B896'} fill={c.vip ? '#F5A623' : 'none'} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Gender icon — soft circle in gender color, sits before the name */}
                    {gc && (
                      <span title={g === 'male' ? 'זכר' : 'נקבה'} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: '50%',
                        backgroundColor: gc.tag, color: gc.solid,
                        fontSize: 12, fontWeight: 700, flexShrink: 0, lineHeight: 1,
                      }}>{g === 'male' ? '♂' : '♀'}</span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.blocked && <Ban size={12} color="#A85A4A" style={{ marginInlineStart: 6, verticalAlign: 'middle' }} />}
                    {c.inactive && (
                      <span style={{ marginInlineStart: 6, padding: '2px 8px', borderRadius: 8, backgroundColor: 'rgba(168,90,74,0.14)', border: '1px solid #A85A4A', fontSize: 10, fontWeight: 700, color: '#A85A4A', verticalAlign: 'middle', letterSpacing: '0.02em' }}>
                        מבוטל
                      </span>
                    )}
                  </p>
                  <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 11, marginTop: 2 }}>
                    {c.phone} · {c.confirmed} בוצעו{c.noShows > 0 ? ` · ${c.noShows} NS` : ''} · {fmtDate(c.lastVisit)}
                  </p>
                  {(() => {
                    const ns = getNoShowStatus(c.noShows, c.blocked, admS);
                    if (!ns) return null;
                    return (
                      <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 10, color: ns.color, marginTop: 3, padding: '2px 7px', backgroundColor: ns.bg, borderRadius: 4, display: 'inline-block' }}>
                        {ns.label}
                      </span>
                    );
                  })()}
                </div>
                <button onClick={() => setOpenClient(c.phone)} style={{ ...S.secondaryBtn, padding: '8px 12px', touchAction: 'manipulation' }}>פרטים</button>
              </div>
            </motion.div>
          );
          })}
        </div>
      )}

      <AnimatePresence>
        {openClient && (() => {
          const c = clients.find(x => x.phone === openClient);
          if (!c) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenClient(null)}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            >
              <motion.div
                onClick={e => e.stopPropagation()}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                style={{ width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', backgroundColor: 'var(--color-surface)', borderRadius: '20px 20px 0 0', padding: 20, direction: 'rtl' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 24, color: 'var(--color-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {c.name}
                      {c.inactive && (
                        <span style={{ padding: '3px 10px', borderRadius: 'var(--demo-radius-card)', backgroundColor: 'rgba(168,90,74,0.14)', border: '1px solid #A85A4A', fontSize: 11, fontWeight: 700, color: '#A85A4A', fontFamily: 'var(--demo-body-font)', letterSpacing: '0.02em' }}>
                          מבוטל
                        </span>
                      )}
                    </p>
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: 'var(--color-section)', marginTop: 2 }}>{c.phone}</p>
                  </div>
                  <button onClick={() => setOpenClient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={20} color="#7D5A47" />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
                  <Stat value={c.total} label="סה״כ" />
                  <Stat value={c.confirmed} label="בוצעו" />
                  <Stat value={c.cancelled} label="ביטולים" />
                  <Stat value={c.noShows} label="אי-הגעות" highlight={c.noShows > 0} />
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: c.noShows > 0 ? 6 : 12 }}>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => markNS(c.phone, c.name)} style={{ flex: 1, padding: '10px', backgroundColor: 'rgba(168,90,74,0.08)', color: '#A85A4A', border: '1px solid rgba(168,90,74,0.3)', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, touchAction: 'manipulation' }}>
                    <AlertCircle size={14} />סמני אי-הגעה
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setBlocked(c.phone, c.name, !c.blocked)} style={{ flex: 1, padding: '10px', backgroundColor: c.blocked ? 'var(--color-primary)' : 'transparent', color: c.blocked ? 'var(--color-surface)' : 'var(--color-primary)', border: '1px solid #5C3D2E', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, touchAction: 'manipulation' }}>
                    <Ban size={14} />{c.blocked ? 'בטלי חסימה' : 'חסמי'}
                  </motion.button>
                </div>
                {c.noShows > 0 && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => unmarkNS(c.phone)}
                    style={{ width: '100%', padding: '9px', marginBottom: 12, backgroundColor: 'transparent', color: 'var(--color-section)', border: '1px solid #D4B896', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, touchAction: 'manipulation' }}>
                    <MinusCircle size={13} />
                    {(() => {
                      const warn  = admS?.noShow?.warningCount ?? 2;
                      const block = admS?.noShow?.blockCount   ?? 4;
                      const n     = c.noShows;
                      let smartTxt;
                      if (n >= block)      smartTxt = '⛔ עברה סף חסימה';
                      else if (n >= warn)  smartTxt = `נותרו ${block - n} לחסימה`;
                      else                 smartTxt = `נותרו ${warn - n} לאזהרה`;
                      return `בטלי אי-הגעה · ${smartTxt}`;
                    })()}
                  </motion.button>
                )}

                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <a href={`tel:+${toE164(c.phone)}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)', border: 'var(--demo-primary-mat-border, none)', borderRadius: 'var(--demo-radius-card)', color: 'var(--color-surface)', textDecoration: 'none', fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 600 }}>
                    <Phone size={16} />חיוג
                  </a>
                  <a href={`https://wa.me/${toE164(c.phone)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', backgroundColor: '#25D366', color: 'var(--color-surface)', borderRadius: 'var(--demo-radius-card)', textDecoration: 'none', fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 600 }}>
                    <MessageCircle size={16} />WhatsApp
                  </a>
                </div>

                <label style={S.label}>הערות אישיות</label>
                <textarea
                  rows={3}
                  style={{ ...S.input, resize: 'vertical' }}
                  defaultValue={c.notes}
                  onBlur={e => updateMeta(c.phone, 'notes', e.target.value)}
                  placeholder="העדפות, אלרגיות, מוצרים אהובים..."
                />
                <AnimatePresence>{saved && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontFamily: 'var(--demo-body-font)', color: '#4CAF50', fontSize: 11, marginBottom: 8 }}>✓ נשמר</motion.p>}</AnimatePresence>

                {/* Delete account — dynamic based on inactive status */}
                {c.inactive ? (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => permanentDeleteAccount(c.phone)}
                    style={{
                      width: '100%', padding: '15px', marginTop: 14, marginBottom: 8,
                      backgroundColor: '#C9302C', color: '#FFFFFF', border: 'none', borderRadius: 'var(--demo-radius-card)',
                      fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 800,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      touchAction: 'manipulation',
                      boxShadow: '0 6px 18px rgba(201,48,44,0.45), 0 1px 3px rgba(201,48,44,0.30)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <Trash2 size={18} strokeWidth={2.3} />מחק לצמיתות
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ backgroundColor: 'rgba(168,90,74,0.08)' }}
                    onClick={() => deleteAccount(c.phone, c.name)}
                    style={{
                      width: '100%', padding: '13px', marginTop: 12, marginBottom: 8,
                      backgroundColor: 'transparent', color: '#A85A4A',
                      border: '2px solid #A85A4A', borderRadius: 'var(--demo-radius-card)',
                      fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      touchAction: 'manipulation', letterSpacing: '0.02em',
                    }}
                  >
                    <UserX size={16} strokeWidth={2.2} />בטל חשבון
                  </motion.button>
                )}

                <p style={{ ...S.heading, marginTop: 4 }}>היסטוריית תורים</p>
                {c.appts.length === 0 ? (
                  <p style={S.subText}>אין תורים</p>
                ) : c.appts.slice(0, 20).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F0E6D6' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>{a.serviceName}</p>
                      <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)' }}>{fmtDate(a.date)} · {a.time}</p>
                    </div>
                    <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: a.status === 'confirmed' ? '#4CAF50' : a.status === 'cancelled' ? '#A85A4A' : 'var(--color-section)' }}>
                      {a.status === 'confirmed' ? '✓' : a.status === 'cancelled' ? 'בוטל' : a.status}
                    </span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

function Stat({ value, label, highlight }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 4px', backgroundColor: highlight ? 'rgba(168,90,74,0.08)' : 'rgba(92,61,46,0.05)', borderRadius: 'var(--demo-radius-card)' }}>
      <p style={{ fontFamily: 'var(--demo-heading-font)', color: highlight ? '#A85A4A' : 'var(--color-primary)', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 10, marginTop: 4 }}>{label}</p>
    </div>
  );
}
