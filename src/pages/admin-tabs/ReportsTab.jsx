import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, DollarSign, UserPlus, Repeat, Clock, TrendingUp, Star, Minus, Plus, TrendingDown, Info, X } from 'lucide-react';
import { db } from '../../utils/db';
import { toDS } from '../../utils/format';
import { DAYS_HE } from '../../utils/constants';
import * as S from '../../utils/adminStyles';

const WARM = ['#C97B4B','#A85A4A','var(--color-section)','var(--color-primary)','#D4A574','#8B6E52','#6B4F3A'];

const RANGES = [
  { id: 'week',   label: 'שבוע',     days: 7 },
  { id: 'month',  label: 'חודש',     days: 30 },
  { id: '3m',     label: '3 חודשים', days: 90 },
  { id: 'all',    label: 'הכל',      days: null },
  { id: 'custom', label: 'מותאם',    days: null },
];

function daysAgoDS(n) { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-n); return toDS(d); }
function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to   && dateStr > to)   return false;
  return true;
}

export default function ReportsTab() {
  const [sub, setSub]               = useState('finance'); // 'finance' | 'data'
  const [apts, setApts]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [range, setRange]           = useState('month');
  const [customFrom, setCustomFrom] = useState(daysAgoDS(30));
  const [customTo, setCustomTo]     = useState(toDS(new Date()));
  const [noShowCount, setNoShowCount] = useState(0);
  const [noShows, setNoShows]         = useState([]);
  const [allClients, setAllClients]   = useState([]);
  const [noShowModal, setNoShowModal] = useState(null);
  const [searchQ, setSearchQ]         = useState('');
  const [nsDate, setNsDate]           = useState(toDS(new Date()));
  const [expenses, setExpenses]       = useState(0);
  const [expenseModal, setExpenseModal] = useState(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [showTip, setShowTip]         = useState(false);
  const [aptPayments, setAptPayments]     = useState({});
  const [orderPayments, setOrderPayments] = useState({});
  const [orders, setOrders]               = useState([]);
  // map { aptId: true } — תורים שהאדמין סימן ידנית "לא להחשיב בדוחות" (גם אם התקיימו)
  const [excludedFromStats, setExcludedFromStats] = useState({});
  useEffect(() => {
    Promise.all([
      db.appointments.list().catch(() => []),
      db.settings.get('noShowCount', 0),
      db.settings.get('businessExpenses', 0),
      db.settings.get('noShows', []),
      db.clients.list().catch(() => []),
      db.settings.get('appointmentPayments', {}),
      db.settings.get('orderPayments', {}),
      db.orders.list().catch(() => []),
      db.settings.get('excludedFromStats', {}),
    ]).then(([all, ns, ex, nsArr, clients, apPays, ordPays, ords, excl]) => {
      setApts(Array.isArray(all) ? all : []);
      const arr = Array.isArray(nsArr) ? nsArr : [];
      setNoShows(arr);
      setNoShowCount(arr.length > 0 ? arr.length : (Number(ns) || 0));
      setAllClients(Array.isArray(clients) ? clients : []);
      setExpenses(Number(ex) || 0);
      setAptPayments(apPays || {});
      setOrderPayments(ordPays || {});
      setOrders(Array.isArray(ords) ? ords : []);
      setExcludedFromStats(excl && typeof excl === 'object' ? excl : {});
      setLoading(false);
    });
  }, []);

  const todayDS   = useMemo(() => toDS(new Date()), []);
  // pastApts = תורים שכבר התקיימו (date+time < now). תור היום בעוד שעה — לא ייכלל.
  // אם אין שעה — נשתמש ב-23:59 כדי לכלול את היום כשנגמר.
  const pastApts  = useMemo(() => {
    const nowMs = Date.now();
    return apts.filter(a => {
      if (!a.date) return false;
      const aptDT = new Date(`${a.date}T${a.time || '23:59'}`).getTime();
      return Number.isFinite(aptDT) && aptDT < nowMs;
    });
  }, [apts]);

  // Effective range — every branch caps toStr at today, so future
  // appointments can NEVER leak into reports even if pastApts misses a case.
  const { fromStr, toStr } = useMemo(() => {
    if (range === 'all')    return { fromStr: null,                              toStr: todayDS };
    if (range === 'custom') {
      // Defensive clamp: never let an out-of-order or future custom range slip through
      let f = customFrom || null;
      let t = customTo   || todayDS;
      if (t > todayDS) t = todayDS;                  // cap to today
      if (f && f > todayDS) f = todayDS;
      if (f && t && f > t) { const tmp = f; f = t; t = tmp; }  // swap if reversed
      return { fromStr: f, toStr: t };
    }
    const r = RANGES.find(x => x.id === range);
    return { fromStr: daysAgoDS(r.days), toStr: todayDS };
  }, [range, customFrom, customTo, todayDS]);

  const filtered  = useMemo(() => pastApts.filter(a => inRange(a.date, fromStr, toStr)), [pastApts, fromStr, toStr]);
  // confirmed = תורים שהתקיימו (pastApts) AND status confirmed AND לא מוחרגים ידנית
  const confirmed = useMemo(
    () => filtered.filter(a => a.status === 'confirmed' && !excludedFromStats[a.id]),
    [filtered, excludedFromStats]
  );
  const cancelled = useMemo(() => filtered.filter(a => a.status === 'cancelled'), [filtered]);

  const totalApts  = confirmed.length;
  const totalRev   = confirmed.reduce((s, a) => s + (a.price || 0), 0);
  const avgPerApt  = totalApts ? Math.round(totalRev / totalApts) : 0;

  const rangePhones = useMemo(() => {
    const seen = new Set(); confirmed.forEach(a => { if (a.phone) seen.add(a.phone); }); return seen;
  }, [confirmed]);

  const newClients = useMemo(() => {
    // לקוחות "חדשים" = יש להן תור ב-range, אין להן תור היסטורי (לפני ה-range) שנכלל בסטטיסטיקה.
    // תורים מוחרגים ידנית לא נחשבים גם לבדיקה ההיסטורית.
    const filtered2 = pastApts.filter(a => !inRange(a.date, fromStr, toStr) && a.status === 'confirmed' && !excludedFromStats[a.id]);
    const beforePhones = new Set(filtered2.map(a => a.phone).filter(Boolean));
    return [...rangePhones].filter(p => !beforePhones.has(p)).length;
  }, [pastApts, rangePhones, fromStr, toStr, excludedFromStats]);

  const returnRate = rangePhones.size ? Math.round(([...rangePhones].filter(p => {
    const before = pastApts.filter(a => a.phone === p && !inRange(a.date, fromStr, toStr) && a.status === 'confirmed' && !excludedFromStats[a.id]);
    return before.length > 0;
  }).length / rangePhones.size) * 100) : 0;

  const hourCounts = useMemo(() => {
    const c = {}; confirmed.forEach(a => { const h = a.time?.split(':')[0]; if (h) c[h] = (c[h]||0)+1; }); return c;
  }, [confirmed]);
  const peakHour = Object.entries(hourCounts).sort((a,b) => b[1]-a[1])[0];

  const dayCounts = useMemo(() => {
    const c = {}; confirmed.forEach(a => { if (!a.date) return; const d = new Date(a.date+'T12:00:00').getDay(); c[d] = (c[d]||0)+1; }); return c;
  }, [confirmed]);
  const peakDay = Object.entries(dayCounts).sort((a,b) => b[1]-a[1])[0];

  const svcCounts = useMemo(() => {
    const c = {}; confirmed.forEach(a => { if (!a.serviceName) return; c[a.serviceName] = (c[a.serviceName]||0)+1; }); return c;
  }, [confirmed]);
  const topService = Object.entries(svcCounts).sort((a,b) => b[1]-a[1])[0];

  const dayBarData = useMemo(() => DAY_HE.map((name, i) => ({ name, count: dayCounts[i] || 0 })), [dayCounts]);
  const maxDayCount = Math.max(...dayBarData.map(d => d.count), 1);

  const pieData  = useMemo(() => Object.entries(svcCounts).sort((a,b) => b[1]-a[1]).slice(0,6), [svcCounts]);
  const pieTotal = pieData.reduce((s,[,v]) => s+v, 0);

  const lineData = useMemo(() => {
    if (!confirmed.length) return [];
    const buckets = {};
    confirmed.forEach(a => {
      if (!a.date) return;
      let key;
      if (range === 'week') key = a.date;
      else if (range === 'month') { const d = new Date(a.date+'T12:00:00'); key = `${d.getFullYear()}-W${Math.ceil(d.getDate()/7)}`; }
      else key = a.date?.slice(0,7);
      buckets[key] = (buckets[key]||0)+1;
    });
    return Object.entries(buckets).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => ({ label: k.slice(-5), v }));
  }, [confirmed, range]);
  const maxLine = Math.max(...lineData.map(d => d.v), 1);

  const aptRevBreakdown = useMemo(() => {
    let cash = 0, bit = 0;
    confirmed.forEach(a => {
      const m = aptPayments[a.id];
      const price = a.price || 0;
      if (m === 'bit') bit += price;
      else cash += price;
    });
    return { cash, bit, total: cash + bit };
  }, [confirmed, aptPayments]);

  const storeRevBreakdown = useMemo(() => {
    let cash = 0, bit = 0;
    orders.forEach(o => {
      const d = o.createdAt ? o.createdAt.slice(0, 10) : null;
      if (!d || !inRange(d, fromStr, toStr) || o.status === 'rejected') return;
      const m = orderPayments[o.id];
      const t = Number(o.total) || 0;
      if (m === 'bit') bit += t;
      else cash += t;
    });
    return { cash, bit, total: cash + bit };
  }, [orders, orderPayments, fromStr, toStr]);

  const rangeDays = useMemo(() => {
    if (fromStr && toStr) {
      return Math.max(1, Math.round((new Date(toStr+'T00:00:00') - new Date(fromStr+'T00:00:00')) / 86400000) + 1);
    }
    if (fromStr) {
      return Math.max(1, Math.round((new Date(todayDS+'T00:00:00') - new Date(fromStr+'T00:00:00')) / 86400000) + 1);
    }
    if (!pastApts.length) return 1;
    const dates = pastApts.map(a => a.date).filter(Boolean).sort();
    return Math.max(1, Math.round((new Date(dates[dates.length-1]+'T00:00:00') - new Date(dates[0]+'T00:00:00')) / 86400000) + 1);
  }, [fromStr, toStr, todayDS, pastApts]);

  const totalAllRev = aptRevBreakdown.total + storeRevBreakdown.total;
  const revPerDay   = Math.round(totalAllRev / rangeDays);
  const newClientsPerMonth = Math.round(newClients / (rangeDays / 30 || 1));

  const topServiceByRev = useMemo(() => {
    const map = {};
    confirmed.forEach(a => { if (!a.serviceName) return; map[a.serviceName] = (map[a.serviceName] || 0) + (a.price || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0] || null;
  }, [confirmed]);

  const netProfit = totalAllRev - expenses;

  // ── Services grouped by base service (serviceId) ──
  const baseServiceStats = useMemo(() => {
    const map = {};
    confirmed.forEach(a => {
      const key = a.serviceId || a.serviceName;
      if (!map[key]) map[key] = { name: a.serviceName?.split(' + ')[0] || a.serviceName, count: 0, revenue: 0, addonCombos: {} };
      map[key].count++;
      map[key].revenue += a.price || 0;
      // Group by addon combination
      const comboKey = (a.addons || []).length === 0 ? '__none__' : (a.addons || []).map(x => x.name).sort().join(' + ');
      const comboLabel = comboKey === '__none__' ? 'ללא תוספות' : comboKey;
      if (!map[key].addonCombos[comboKey]) map[key].addonCombos[comboKey] = { label: comboLabel, count: 0, revenue: 0 };
      map[key].addonCombos[comboKey].count++;
      map[key].addonCombos[comboKey].revenue += (a.addons || []).reduce((s, x) => s + (x.price || 0), 0);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [confirmed]);

  // ── New chart: top 5 clients by visit count ──
  const topClientsData = useMemo(() => {
    const map = {};
    confirmed.forEach(a => {
      if (!a.phone) return;
      if (!map[a.phone]) map[a.phone] = { name: a.userName || a.phone, count: 0 };
      map[a.phone].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [confirmed]);
  const maxTopClient = Math.max(...topClientsData.map(d => d.count), 1);

  // ── New chart: revenue by payment method ──
  const payMethodData = useMemo(() => [
    { label: 'מזומן',   value: aptRevBreakdown.cash   + storeRevBreakdown.cash,   color: '#E69E2C' },
    { label: 'ביט',     value: aptRevBreakdown.bit    + storeRevBreakdown.bit,    color: 'var(--color-success)' },
  ], [aptRevBreakdown, storeRevBreakdown]);
  const maxPayMethod = Math.max(...payMethodData.map(d => d.value), 1);

  const updateNoShow = useCallback(async (delta) => {
    const next = Math.max(0, noShowCount + delta);
    setNoShowCount(next);
    await db.settings.set('noShowCount', next);
  }, [noShowCount]);

  const addNoShow = async (client) => {
    const entry = { clientName: client.name || '', clientPhone: client.phone || '', date: nsDate };
    const next = [...noShows, entry];
    setNoShows(next);
    setNoShowCount(next.length);
    await db.settings.set('noShows', next);
    setNoShowModal(null);
    setSearchQ('');
  };
  const removeNoShow = async (idx) => {
    const next = noShows.filter((_, i) => i !== idx);
    setNoShows(next);
    setNoShowCount(next.length);
    await db.settings.set('noShows', next);
  };

  // ── Safe setters for custom-range date inputs ──
  // Block illogical input: no future dates, "from" cannot exceed "to".
  // HTML min/max + these JS clamps = double protection.
  const onChangeCustomFrom = (raw) => {
    if (!raw) return;
    let v = raw;
    if (v > todayDS) v = todayDS;                      // no future
    if (customTo && v > customTo) v = customTo;        // not after "to"
    setCustomFrom(v);
  };
  const onChangeCustomTo = (raw) => {
    if (!raw) return;
    let v = raw;
    if (v > todayDS) v = todayDS;                      // no future
    if (customFrom && v < customFrom) v = customFrom;  // not before "from"
    setCustomTo(v);
  };

  const submitExpense = async () => {
    const amt = Number(expenseAmount);
    if (!amt || amt <= 0) { setExpenseModal(null); setExpenseAmount(''); return; }
    const next = expenseModal === 'add' ? expenses + amt : Math.max(0, expenses - amt);
    setExpenses(next);
    await db.settings.set('businessExpenses', next);
    setExpenseModal(null);
    setExpenseAmount('');
  };

  if (loading) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.02em', marginBottom: 14, textAlign: 'center' }}>
        דוחות וסטטיסטיקה
      </p>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { id: 'finance', label: '💰 כספים' },
          { id: 'data',    label: '📊 נתונים וגרפים' },
        ].map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            style={{ ...S.subTab(sub === t.id), flex: 1, padding: '9px 10px', fontSize: 13, touchAction: 'manipulation' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Range selector — only for finance + data tabs */}
      {(sub === 'finance' || sub === 'data') && (
        <div style={S.card}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRange(r.id)}
                style={{ ...S.subTab(range === r.id), flex: '1 0 auto', padding: '8px 10px', fontSize: 13, touchAction: 'manipulation' }}>
                {r.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label style={S.label}>מ־</label>
                <input
                  type="date"
                  style={S.input}
                  value={customFrom}
                  max={customTo && customTo < todayDS ? customTo : todayDS}
                  onChange={e => onChangeCustomFrom(e.target.value)}
                />
              </div>
              <div>
                <label style={S.label}>עד</label>
                <input
                  type="date"
                  style={S.input}
                  value={customTo}
                  min={customFrom || undefined}
                  max={todayDS}
                  onChange={e => onChangeCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 10, textAlign: 'center' }}>
            {filtered.length} תורים בטווח · מתוך {apts.length} סה״כ
            {fromStr && toStr && (
              <span style={{ display: 'block', marginTop: 2, fontSize: 10, opacity: 0.75 }}>
                {fromStr} ← {toStr}
              </span>
            )}
          </p>
        </div>
      )}

      {/* ══ Tab: כספים ══ */}
      {sub === 'finance' && <div>
          <SectionHeader title="💰 כספים" />

          <GlassCard>
            <CardTitle>הכנסות מטיפולים</CardTitle>
            <RevenueRow label="מזומן"   value={aptRevBreakdown.cash}   color="#E69E2C" />
            <RevenueRow label="ביט"     value={aptRevBreakdown.bit}    color="#4CAF50" />
            <RevenueRow label="סך הכל" value={aptRevBreakdown.total}  color="#5C3D2E" bold />
          </GlassCard>

          <GlassCard>
            <CardTitle>הכנסות מחנות</CardTitle>
            <RevenueRow label="מזומן"   value={storeRevBreakdown.cash}   color="#E69E2C" />
            <RevenueRow label="ביט"     value={storeRevBreakdown.bit}    color="#4CAF50" />
            <RevenueRow label="סך הכל" value={storeRevBreakdown.total}  color="#5C3D2E" bold />
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>סה״כ הכנסות</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--color-primary-ink)', lineHeight: 1 }}>
                ₪{totalAllRev.toLocaleString()}
              </span>
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <CardTitle style={{ margin: 0 }}>הוצאות</CardTitle>
              <button onClick={() => setShowTip(t => !t)}
                style={{ width: 26, height: 26, borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>
                <Info size={13} color="var(--color-text-muted)" />
              </button>
            </div>
            <AnimatePresence>
              {showTip && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', backgroundColor: 'rgba(125,90,71,0.06)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 10, lineHeight: 1.5 }}>
                    כאן תוכלי לעקוב אחר הוצאות העסק — הוסיפי כל הוצאה ידנית והכל יישמר מסודר
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setExpenseModal('subtract'); setExpenseAmount(''); }}
                style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-border-dark)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'manipulation' }}>
                <Minus size={18} color="var(--color-text-muted)" />
              </motion.button>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>₪{expenses.toLocaleString()}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>סה״כ מצטבר</p>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setExpenseModal('add'); setExpenseAmount(''); }}
                style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-border-dark)', backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'manipulation' }}>
                <Plus size={18} color="var(--color-surface)" />
              </motion.button>
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <CardTitle style={{ margin: 0 }}>רווח נקי</CardTitle>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>הכנסות פחות הוצאות</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {netProfit >= 0 ? <TrendingUp size={22} color="var(--color-success)" /> : <TrendingDown size={22} color="var(--color-accent)" />}
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-accent)', lineHeight: 1 }}>
                  ₪{netProfit.toLocaleString()}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>}

      {/* ══ Tab: נתונים וגרפים ══ */}
      {sub === 'data' && <div>
          <SectionHeader title="📊 נתונים" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <KpiCard icon={DollarSign} value={`₪${avgPerApt}`}              label="ממוצע לתור"         tint="#7D5A47" bg="rgba(125,90,71,0.10)" />
            <KpiCard icon={Calendar}   value={`₪${revPerDay.toLocaleString()}`} label="ממוצע ליום"      tint="#6B8CB8" bg="rgba(107,140,184,0.10)" />
            <KpiCard icon={UserPlus}   value={newClientsPerMonth}            label="לקוחות חדשות/חודש" tint="#9C6FBB" bg="rgba(156,111,187,0.10)" />
            <KpiCard icon={Repeat}     value={`${returnRate}%`}              label="שיעור חזרה"         tint="#E07B39" bg="rgba(224,123,57,0.10)" />
          </div>

          {confirmed.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <InsightCard icon={Clock}      tint="#C97B4B" title="שעת שיא"
                value={peakHour ? `${peakHour[0]}:00` : '—'} sub={peakHour ? `${peakHour[1]} תורים` : ''} />
              <InsightCard icon={TrendingUp} tint="#5C3D2E" title="יום שיא"
                value={peakDay ? DAYS_HE[peakDay[0]] : '—'} sub={peakDay ? `${peakDay[1]} תורים` : ''} smallValue />
              <InsightCard icon={Star}       tint="#C97B4B" title="שירות מוביל"
                value={topService ? topService[0] : '—'} sub={topService ? `${topService[1]} תורים` : ''} smallValue />
            </div>
          )}

          {topServiceByRev && (
            <GlassCard>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>✨ שירות הכי רווחי</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{topServiceByRev[0]}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-primary-ink)', marginTop: 4 }}>
                ₪{Number(topServiceByRev[1]).toLocaleString()} סה״כ · {topService?.[1] || 0} תורים
              </p>
            </GlassCard>
          )}

          {/* Cancellations — belongs here in data column */}
          {cancelled.length > 0 && (
            <GlassCard>
              <CardTitle>ביטולים בטווח</CardTitle>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)' }}>מתוך {filtered.length} תורים</span>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>
                    {cancelled.length}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {filtered.length ? Math.round(cancelled.length/filtered.length*100) : 0}% מהתורים
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* No-show counter */}
          <GlassCard>
            <CardTitle>אי הגעות</CardTitle>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
              לקוחות שלא הגיעו לתור
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 14 }}>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => setNoShowModal('manage')} disabled={noShows.length === 0}
                style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-border-dark)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'manipulation', opacity: noShows.length === 0 ? 0.4 : 1 }}>
                <Minus size={18} color="var(--color-text-muted)" />
              </motion.button>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 700, color: 'var(--color-primary-ink)', lineHeight: 1 }}>{noShowCount}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>אי-הגעות</p>
              </div>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => { setNoShowModal('add'); setSearchQ(''); setNsDate(toDS(new Date())); }}
                style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-border-dark)', backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'manipulation' }}>
                <Plus size={18} color="var(--color-surface)" />
              </motion.button>
            </div>
            {noShowCount > 0 && avgPerApt > 0 && (
              <div style={{ backgroundColor: 'var(--color-error-07)', border: '1px solid var(--color-error-15)', borderRadius: 'var(--radius-md)', padding: '10px 14px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>הפסד משוער</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--color-accent)' }}>
                  ₪{(noShowCount * avgPerApt).toLocaleString()}
                </p>
              </div>
            )}
          </GlassCard>

          <SectionHeader title="📈 גרפים" />

          {confirmed.length > 0 && (
            <GlassCard>
              <CardTitle>תורים לפי יום בשבוע</CardTitle>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90, marginTop: 4 }}>
                {dayBarData.map(({ name, count }) => (
                  <div key={name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: count ? `${Math.round((count/maxDayCount)*70)}px` : '2px' }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ width: '100%', backgroundColor: count ? 'var(--color-primary)' : 'var(--color-border-soft)', borderRadius: '4px 4px 0 0', minHeight: 2 }}
                    />
                    <span style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', fontSize: 9, textAlign: 'center' }}>{name.slice(0,3)}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {pieData.length > 1 && (
            <GlassCard>
              <CardTitle>פילוח לפי שירות</CardTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <PieChart data={pieData} total={pieTotal} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {pieData.map(([name, count], i) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', backgroundColor: WARM[i % WARM.length], flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text-muted)' }}>{Math.round(count/pieTotal*100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          )}

          {lineData.length > 2 && (
            <GlassCard>
              <CardTitle>מגמת תורים לאורך זמן</CardTitle>
              <div style={{ position: 'relative', height: 80, marginTop: 6 }}>
                <svg width="100%" height="80" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5C3D2E" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#5C3D2E" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points={[
                      ...lineData.map((d, i) => `${(i / (lineData.length-1)) * 100}%,${80 - (d.v / maxLine) * 70}`),
                      '100%,80', '0%,80',
                    ].join(' ')}
                    fill="url(#lineGrad)"
                  />
                  <polyline
                    points={lineData.map((d, i) => `${(i / (lineData.length-1)) * 100}%,${80 - (d.v / maxLine) * 70}`).join(' ')}
                    fill="none" stroke="#5C3D2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  />
                  {lineData.map((d, i) => (
                    <circle key={i} cx={`${(i / (lineData.length-1)) * 100}%`} cy={80 - (d.v / maxLine) * 70} r="3" fill="#5C3D2E" />
                  ))}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {(lineData.length > 6
                    ? [lineData[0], lineData[Math.floor(lineData.length/2)], lineData[lineData.length-1]]
                    : lineData
                  ).map((d, i) => (
                    <span key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--color-text-muted)' }}>{d.label}</span>
                  ))}
                </div>
              </div>
            </GlassCard>
          )}

          {/* ── Chart 4: הכנסות לפי שיטת תשלום ── */}
          {totalAllRev > 0 && (
            <GlassCard>
              <CardTitle>הכנסות לפי שיטת תשלום</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                {payMethodData.map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', backgroundColor: color, display: 'inline-block' }} />
                        {label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>₪{value.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: 'rgba(212,184,150,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((value / maxPayMethod) * 100)}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        style={{ height: '100%', backgroundColor: color, borderRadius: 3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* ── שירותים מובילים ── */}
          {baseServiceStats.length > 0 && (
            <GlassCard>
              <CardTitle>שירותים מובילים</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 6 }}>
                {baseServiceStats.map((svc, i) => (
                  <ServiceStatRow key={svc.name + i} svc={svc} />
                ))}
              </div>
            </GlassCard>
          )}

          {/* ── Chart 5: לקוחות מובילות ── */}
          {topClientsData.length > 0 && (
            <GlassCard>
              <CardTitle>לקוחות מובילות</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                {topClientsData.map(({ name, count }, i) => (
                  <div key={name + i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                        {name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>{count} תורים</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: 'rgba(212,184,150,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((count / maxTopClient) * 100)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.08 }}
                        style={{ height: '100%', backgroundColor: WARM[i % WARM.length], borderRadius: 3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {!filtered.length && (
            <div style={S.emptyState}>
              <p style={S.emptyEmoji}>📊</p>
              <p style={S.emptyText}>אין נתונים בטווח זה</p>
            </div>
          )}
        </div>}

      {/* ── No-show modal ── */}
      <AnimatePresence>
        {noShowModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setNoShowModal(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', padding: '22px 20px', width: '100%', maxWidth: 360, maxHeight: '80vh', overflowY: 'auto', direction: 'rtl' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ ...S.heading, margin: 0 }}>
                  {noShowModal === 'add' ? 'הוסיפי אי-הגעה' : 'ניהול אי-הגעות'}
                </p>
                <button onClick={() => setNoShowModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <span style={{ fontSize: 18, color: 'var(--color-text-muted)' }}>✕</span>
                </button>
              </div>
              {noShowModal === 'add' ? (
                <>
                  <label style={S.label}>חיפוש לקוחה</label>
                  <input type="text" autoFocus style={{ ...S.input, marginBottom: 12 }} value={searchQ}
                    onChange={e => setSearchQ(e.target.value)} placeholder="הקלידי שם או טלפון..." />
                  <label style={S.label}>תאריך אי-ההגעה</label>
                  <input type="date" style={{ ...S.input, marginBottom: 12 }} value={nsDate} onChange={e => setNsDate(e.target.value)} />
                  <div style={{ maxHeight: 240, overflowY: 'auto', borderTop: '1px solid var(--color-border-soft)', paddingTop: 8 }}>
                    {allClients.length === 0 ? (
                      <p style={{ ...S.emptyText, padding: '12px 0', textAlign: 'center' }}>אין לקוחות</p>
                    ) : (
                      allClients.filter(c => {
                        if (!searchQ.trim()) return true;
                        const q = searchQ.trim().toLowerCase();
                        return String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').includes(q);
                      }).slice(0, 30).map(c => (
                        <button key={c.id || c.phone} onClick={() => addNoShow(c)}
                          style={{ width: '100%', textAlign: 'right', padding: '10px 12px', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-soft)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', fontWeight: 600 }}>{c.name || '(ללא שם)'}</span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', direction: 'ltr' }}>{c.phone}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div>
                  {noShows.length === 0 ? (
                    <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>אין אי-הגעות רשומות</p>
                  ) : noShows.map((ns, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border-soft)' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', fontWeight: 600 }}>{ns.clientName || '(ללא שם)'}</p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)' }}>{ns.clientPhone} · {ns.date}</p>
                      </div>
                      <button onClick={() => removeNoShow(i)}
                        style={{ padding: '6px 10px', backgroundColor: 'transparent', border: '1px solid var(--color-error-40)', color: 'var(--color-accent)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 11, cursor: 'pointer' }}>
                        הסירי
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expense modal ── */}
      <AnimatePresence>
        {expenseModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setExpenseModal(null); setExpenseAmount(''); }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', padding: '24px 20px', width: '100%', maxWidth: 320, direction: 'rtl' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ ...S.heading, margin: 0 }}>{expenseModal === 'add' ? 'הוסיפי הוצאה' : 'הורידי הוצאה'}</p>
                <button onClick={() => { setExpenseModal(null); setExpenseAmount(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X size={18} color="var(--color-text-muted)" />
                </button>
              </div>
              <label style={S.label}>סכום (₪)</label>
              <input type="number" inputMode="decimal" autoFocus value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitExpense()}
                style={{ ...S.input, fontSize: 18, fontFamily: 'var(--font-body)', fontWeight: 700 }}
                placeholder="0" />
              <motion.button whileTap={{ scale: 0.97 }} onClick={submitExpense}
                style={{ ...S.primaryBtn, marginTop: 10, backgroundColor: expenseModal === 'add' ? 'var(--color-primary)' : 'var(--color-accent)', backgroundImage: expenseModal === 'add' ? 'var(--demo-primary-mat-overlay, none)' : 'none', border: expenseModal === 'add' ? 'var(--demo-primary-mat-border, none)' : undefined }}>
                {expenseModal === 'add' ? <Plus size={16} /> : <Minus size={16} />}
                {expenseModal === 'add' ? 'הוסיפי' : 'הורידי'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function ServiceStatRow({ svc }) {
  const [open, setOpen] = useState(false);
  const combos = Object.values(svc.addonCombos).sort((a, b) => b.count - a.count);
  return (
    <div style={{ borderBottom: '1px solid var(--color-border-soft)' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right' }}
      >
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{svc.name}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{svc.count} תורים · ₪{Number(svc.revenue).toLocaleString()}</p>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-hint)', paddingInlineStart: 8 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ paddingBottom: 10, paddingInlineStart: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {combos.map(c => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'var(--color-brown-07)', borderRadius: 'var(--radius-sm)', borderInlineStart: '2px solid var(--color-primary)' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text)' }}>
                {c.label === 'ללא תוספות' ? c.label : `+ ${c.label}`}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0, paddingInlineStart: 8 }}>
                {c.count} תורים{c.revenue > 0 ? ` · +₪${Number(c.revenue).toLocaleString()}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GlassCard({ children, style }) {
  return (
    <div style={{
      backgroundColor: 'rgba(253,250,247,0.82)',
      backdropFilter: 'blur(18px) saturate(170%)',
      WebkitBackdropFilter: 'blur(18px) saturate(170%)',
      border: '1px solid rgba(212,184,150,0.35)',
      borderRadius: 'var(--radius-xl)', padding: 16,
      boxShadow: '0 2px 12px rgba(92,61,46,0.07)',
      marginBottom: 10, ...style,
    }}>
      {children}
    </div>
  );
}

function CardTitle({ children, style }) {
  return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10, ...style }}>
      {children}
    </p>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 12, paddingInline: 2 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--color-primary-ink)', letterSpacing: '0.03em', lineHeight: 1, margin: 0 }}>
        {title}
      </h3>
      <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(92,61,46,0.8) 0%, rgba(92,61,46,0.15) 60%, transparent 100%)', borderRadius: 1, marginTop: 8 }} />
    </div>
  );
}

function RevenueRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: bold ? '1px solid var(--color-border)' : 'none', marginTop: bold ? 4 : 0 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: bold ? 14 : 12, color: bold ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: bold ? 700 : 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {!bold && <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', backgroundColor: color, display: 'inline-block' }} />}
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: bold ? 17 : 14, fontWeight: bold ? 800 : 700, color }}>
        ₪{Number(value || 0).toLocaleString()}
      </span>
    </div>
  );
}

function KpiCard({ icon: Icon, value, label, tint, bg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ backgroundColor: 'rgba(253,250,247,0.85)', backdropFilter: 'blur(16px) saturate(170%)', WebkitBackdropFilter: 'blur(16px) saturate(170%)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 'var(--radius-xl)', padding: 14, boxShadow: '0 2px 8px rgba(92,61,46,0.07)', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: 0, insetInlineEnd: 0, width: 40, height: 40, backgroundColor: bg, borderBottomLeftRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={tint} strokeWidth={1.6} />
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 700, color: tint, lineHeight: 1.1, marginTop: 6 }}>{value}</p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>{label}</p>
    </motion.div>
  );
}

function InsightCard({ icon: Icon, tint, title, value, sub, smallValue }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ backgroundColor: 'rgba(253,250,247,0.85)', backdropFilter: 'blur(16px) saturate(170%)', WebkitBackdropFilter: 'blur(16px) saturate(170%)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 'var(--demo-radius-card)', padding: 12, boxShadow: '0 2px 8px rgba(92,61,46,0.07)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: `${tint}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={12} color={tint} strokeWidth={1.8} />
        </div>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text-muted)' }}>{title}</span>
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: smallValue ? 12 : 16, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
      {sub && <p style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</p>}
    </motion.div>
  );
}

function PieChart({ data, total }) {
  const size = 72, r = 26, cx = 36, cy = 36;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(([name, count], i) => {
    const pct = count / total, dash = pct * circ, gap = circ - dash;
    const rot = (offset / total) * 360 - 90;
    offset += count;
    return { name, dash, gap, rot, color: WARM[i % WARM.length] };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={11}
          strokeDasharray={`${s.dash} ${s.gap}`} transform={`rotate(${s.rot}, ${cx}, ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      ))}
      <circle cx={cx} cy={cy} r={r - 7} fill="rgba(253,250,247,0.9)" />
      <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, fill: 'var(--color-text)' }}>{total}</text>
    </svg>
  );
}
