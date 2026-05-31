import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, Send, Check } from 'lucide-react';
import { db } from '../utils/db';
import * as S from '../utils/adminStyles';

function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getSunday(d) {
  const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTH_HE = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];

function fmtWeek(start) {
  const end = addDays(start, 6);
  return `${start.getDate()} ${MONTH_HE[start.getMonth()]} – ${end.getDate()} ${MONTH_HE[end.getMonth()]}`;
}

export default function ReceiptSender() {
  const [weekStart, setWeekStart]   = useState(() => getSunday(new Date()));
  const [dayIdx, setDayIdx]         = useState(() => new Date().getDay());
  const [apts, setApts]             = useState(null);
  const [payments, setPayments]     = useState({});
  const [pendingPays, setPendingPays] = useState({});
  const [sentDb, setSentDb]         = useState({});
  const [selected, setSelected]     = useState(new Set());
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(new Set());

  useEffect(() => {
    db.settings.get('appointmentPayments', {}).then(p => setPayments(p || {}));
    db.settings.get('pendingPayments', {}).then(p => setPendingPays(p || {}));
    db.settings.get('sentReceipts', {}).then(s => setSentDb(s || {}));
  }, []);

  const selectedDate = toDS(addDays(weekStart, dayIdx));

  useEffect(() => {
    setApts(null);
    setSelected(new Set());
    setSent(new Set());
    db.appointments.byDate(selectedDate).then(arr => {
      setApts(Array.isArray(arr) ? arr.filter(a => a.status === 'confirmed') : []);
    });
  }, [selectedDate]);

  const now = new Date();
  const isPaid    = (a) => !!payments[a.id];
  const paidOnline = (a) => pendingPays[a.id]?.type === 'appointment';
  const methodOf  = (a) => payments[a.id] || (paidOnline(a) ? pendingPays[a.id]?.method : 'cash');

  const setMethod = async (aptId, method) => {
    const next = { ...payments, [aptId]: method };
    setPayments(next);
    await db.settings.set('appointmentPayments', next);
  };

  const isFuture = (a) => {
    if (!a.date || !a.time) return false;
    return new Date(`${a.date}T${a.time}`) > now;
  };
  const wasSentBefore = (a) => !!sentDb[a.id];
  const isDisabled = (a) => isFuture(a) || sent.has(a.id) || wasSentBefore(a);

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectableApts = (apts || []).filter(a => !isDisabled(a));

  const sendReceipts = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    const toSend = (apts || []).filter(a => selected.has(a.id));
    const newSent = new Set(sent);
    const newDb = { ...sentDb };
    for (const a of toSend) {
      try {
        const resp = await fetch('/api/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            aptId: a.id,
            name: a.userName || '',
            items: [{ name: a.serviceName || 'טיפול', price: a.price || 0 }],
            total: a.price || 0,
            method: payments[a.id] || 'cash',
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!json.ok) {
          console.error('[ReceiptSender] send-receipt failed:', json);
        } else {
          console.log('[ReceiptSender] ✓ receipt sent for', a.userName, json);
          newDb[a.id] = { receiptNumber: json.receiptNumber, sentAt: new Date().toISOString() };
        }
      } catch (e) { console.error('[ReceiptSender]', e); }
      newSent.add(a.id);
    }
    setSent(newSent);
    setSentDb(newDb);
    setSelected(new Set());
    setSending(false);
  };

  const jumpToday = () => { setWeekStart(getSunday(new Date())); setDayIdx(new Date().getDay()); };

  return (
    <div>
      {/* Week navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtn}><ChevronRight size={18} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1 }}>
            {fmtWeek(weekStart)}
          </p>
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtn}><ChevronLeft size={18} /></button>
      </div>

      <button onClick={jumpToday} style={{ ...S.secondaryBtn, width: '100%', marginBottom: 14, padding: '7px', fontSize: 12 }}>
        השבוע הנוכחי
      </button>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
        {DAYS_HE.map((name, i) => {
          const ds = toDS(addDays(weekStart, i));
          const isToday = ds === toDS(new Date());
          return (
            <button key={i} onClick={() => setDayIdx(i)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)', border: 'none',
                backgroundColor: dayIdx === i ? 'var(--color-primary)' : isToday ? 'var(--color-brown-15)' : 'var(--color-bg)',
                color: dayIdx === i ? 'var(--color-surface)' : 'var(--color-primary)',
                fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: dayIdx === i ? 700 : 400,
                cursor: 'pointer', touchAction: 'manipulation',
              }}>
              {name.slice(0, 2)}
            </button>
          );
        })}
      </div>

      {/* Client list */}
      {apts === null ? (
        <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>
      ) : apts.length === 0 ? (
        <div style={S.emptyState}><p style={S.emptyEmoji}>📅</p><p style={S.emptyText}>אין תורים ביום זה</p></div>
      ) : (
        <>
          {selectableApts.length > 1 && (
            <button onClick={() => setSelected(new Set(selectableApts.map(a => a.id)))}
              style={{ width: '100%', padding: '8px', marginBottom: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              בחרי הכל ({selectableApts.length})
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {apts.map(a => {
              const paid    = isPaid(a);
              const future  = isFuture(a);
              const wasSent = sent.has(a.id) || wasSentBefore(a);
              const disabled = isDisabled(a);
              const isSelected = selected.has(a.id);
              const online = paidOnline(a);
              return (
                <div key={a.id}
                  onClick={() => !disabled && toggleSelect(a.id)}
                  style={{
                    padding: '12px 14px', borderRadius: 'var(--radius-lg)',
                    border: `1.5px solid ${isSelected ? 'var(--color-primary)' : online ? 'var(--color-link)' : 'var(--color-border)'}`,
                    backgroundColor: disabled ? 'var(--color-bg)' : isSelected ? 'var(--color-brown-08)' : online ? 'rgba(74,144,226,0.06)' : 'var(--color-surface)',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled && !wasSent ? 0.65 : 1,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 'var(--radius-xs)', flexShrink: 0,
                    border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border-dark)'}`,
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {wasSent  && <Check size={12} color="var(--color-success)" strokeWidth={3} />}
                    {disabled && !wasSent && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>✕</span>}
                    {isSelected && <Check size={12} color="var(--color-surface)" strokeWidth={3} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{a.userName}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {(a.time || '').slice(0,5)} · {a.serviceName} · ₪{a.price}
                    </p>
                    {!future && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                        {[['cash','מזומן'],['bit','ביט']].map(([m, label]) => (
                          <button key={m} onClick={() => setMethod(a.id, m)}
                            style={{
                              padding: '3px 8px', borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
                              fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                              backgroundColor: methodOf(a) === m ? 'var(--color-primary)' : 'var(--color-border-soft)',
                              color: methodOf(a) === m ? 'var(--color-surface)' : 'var(--color-primary)',
                              transition: 'background-color 0.15s',
                            }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {future && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-accent)', marginTop: 2 }}>
                        לא ניתן להוציא קבלה על טיפול שלא היה
                      </p>
                    )}
                    {online && !future && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-link)', marginTop: 2, fontWeight: 600 }}>
                        ✓ שולם באתר
                      </p>
                    )}
                    {wasSent && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-success)', marginTop: 2 }}>✓ נשלחה</p>
                    )}
                  </div>

                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                    ₪{a.price}
                  </span>
                </div>
              );
            })}
          </div>

          <motion.button whileTap={{ scale: 0.97 }}
            disabled={selected.size === 0 || sending}
            onClick={sendReceipts}
            style={{
              ...S.primaryBtn,
              opacity: selected.size === 0 || sending ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <Send size={15} />
            {sending ? 'שולחת...' : `שלחי קבלות (${selected.size})`}
          </motion.button>
        </>
      )}
    </div>
  );
}

const navBtn = {
  width: 36, height: 36, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  touchAction: 'manipulation', flexShrink: 0,
};
