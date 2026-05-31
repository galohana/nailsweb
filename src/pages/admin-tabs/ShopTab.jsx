import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, Check, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { db } from '../../utils/db';
import { notifyOwnerOrderPurchase } from '../../utils/sms';
import * as S from '../../utils/adminStyles';
import ImageUploader from '../../components/ImageUploader';

// ── ProductForm extracted OUTSIDE main component (memoized) ────────
// Stable identity across parent re-renders → React keeps inputs mounted → keyboard stays open.
const ProductForm = memo(function ProductForm({ form, onChange, onUploadMain, onUpload2, onUpload3, onSave, onCancel }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid #F0E6D6' }}>
      <ImageUploader currentUrl={form.imageUrl} onUploaded={onUploadMain} label="תמונה ראשית" />
      <ImageUploader currentUrl={form.img2}     onUploaded={onUpload2}    label="תמונה משנית #1 (אופציונלי)" />
      <ImageUploader currentUrl={form.img3}     onUploaded={onUpload3}    label="תמונה משנית #2 (אופציונלי)" />
      <label style={S.label}>שם מוצר</label>
      <input style={S.input} value={form.name} onChange={e => onChange('name', e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={S.label}>מחיר (₪)</label><input type="number" style={S.input} value={form.price} onChange={e => onChange('price', e.target.value)} /></div>
        <div><label style={S.label}>מבצע (אופ׳)</label><input type="number" style={S.input} value={form.salePrice} onChange={e => onChange('salePrice', e.target.value)} /></div>
      </div>
      <label style={S.label}>מלאי (יחידות)</label>
      <input type="number" style={S.input} value={form.stock} onChange={e => onChange('stock', e.target.value)} placeholder="השאירי ריק לאי-מעקב מלאי" />
      <label style={S.label}>תיאור מוצר</label>
      <textarea rows={3} style={{ ...S.input, resize: 'vertical' }} value={form.description} onChange={e => onChange('description', e.target.value)} placeholder="תיאור קצר שיוצג בדף המוצר..." />
      <label style={S.label}>תווית</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[['','ללא'],['recommended','מומלץ'],['new','חדש']].map(([val, lbl]) => (
          <button key={val} type="button" onClick={() => onChange('label', val)}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${form.label === val ? 'var(--color-primary)' : '#E8DCC8'}`, backgroundColor: form.label === val ? 'var(--color-primary)' : 'var(--color-surface)', backgroundImage: form.label === val ? 'var(--demo-primary-mat-overlay, none)' : 'none', color: form.label === val ? 'var(--color-surface)' : 'var(--color-section)', fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onSave} style={{ ...S.primaryBtn, flex: 1 }}><Check size={16} />שמרי</motion.button>
        <button onClick={onCancel} style={S.secondaryBtn}>ביטול</button>
      </div>
    </div>
  );
});

export default function ShopTab({ onBadgeUpdate }) {
  const [sub, setSub] = useState('products');
  const [orders, setOrders] = useState(null);
  const [pendingPayments, setPendingPayments] = useState({});

  useEffect(() => {
    db.orders.list().then(setOrders);
    db.settings.get('pendingPayments', {}).then(p => setPendingPayments(p || {}));
  }, []);

  const pendingOrderCount = (orders || []).filter(o => o.status === 'pending').length;
  const pendingPayCount   = Object.keys(pendingPayments).length;

  const onPaymentApproved = (id) => {
    setPendingPayments(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // Re-fetch pendingPayments on every click of Approvals — ensures fresh data
  const handleSubChange = (newSub) => {
    setSub(newSub);
    if (newSub === 'approvals') {
      db.settings.get('pendingPayments', {}).then(p => setPendingPayments(p || {}));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button style={{ ...S.subTab(sub === 'products'), flex: '1 0 auto' }} onClick={() => handleSubChange('products')}>מוצרים</button>
        <button style={{ ...S.subTab(sub === 'orders'), flex: '1 0 auto' }} onClick={() => handleSubChange('orders')}>הזמנות{pendingOrderCount > 0 ? ` (${pendingOrderCount})` : ''}</button>
        <button style={{ ...S.subTab(sub === 'approvals'), flex: '1 0 auto' }} onClick={() => handleSubChange('approvals')}>
          אישורים{pendingPayCount > 0 ? ` (${pendingPayCount})` : ''}
        </button>
        <button style={{ ...S.subTab(sub === 'payment'), flex: '1 0 auto' }} onClick={() => handleSubChange('payment')}>חשבונות תשלום</button>
      </div>
      {sub === 'products'  && <Products />}
      {sub === 'orders'    && <Orders orders={orders} setOrders={setOrders} onBadgeUpdate={onBadgeUpdate} />}
      {sub === 'approvals' && <Approvals pendingPayments={pendingPayments} onApproved={onPaymentApproved} onBadgeUpdate={onBadgeUpdate} />}
      {sub === 'payment'   && <Payment />}
    </div>
  );
}

function Products() {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', price: 0, salePrice: '', imageUrl: '', img2: '', img3: '', description: '', label: '', visible: true, stock: '' });
  const [descriptions, setDescs] = useState({});
  const [labels, setLabels]      = useState({});
  const [images, setImages]      = useState({});  // {id: [url1, url2, url3]}
  const [inventory, setInventory] = useState({});
  const [restockAmt, setRestockAmt] = useState({});
  useEffect(() => {
    db.products.list().then(setList);
    db.settings.get('productDescriptions', {}).then(d => setDescs(d || {}));
    db.settings.get('productLabels', {}).then(l => setLabels(l || {}));
    db.settings.get('productImages', {}).then(im => setImages(im || {}));
    db.settings.get('productInventory', {}).then(iv => setInventory(iv || {}));
  }, []);

  const restock = async (id, amount) => {
    const add = Number(amount) || 0;
    if (add <= 0) return;
    const next = { ...inventory, [id]: (Number(inventory[id]) || 0) + add };
    setInventory(next);
    await db.settings.set('productInventory', next);
    setRestockAmt(prev => ({ ...prev, [id]: '' }));
  };

  const saveDescription = async (productId, desc) => {
    const next = { ...descriptions, [productId]: desc };
    if (!desc || !desc.trim()) delete next[productId];
    setDescs(next);
    await db.settings.set('productDescriptions', next);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const p = { name: form.name, price: Number(form.price), salePrice: form.salePrice ? Number(form.salePrice) : null, imageUrl: form.imageUrl, visible: form.visible };
    let productId = edit;
    if (edit === 'new') {
      const c = await db.products.create(p);
      if (c) { setList(prev => [...prev, c]); productId = c.id; }
    } else {
      await db.products.update(edit, p);
      setList(prev => prev.map(i => i.id === edit ? { ...i, ...p } : i));
    }
    if (productId && productId !== 'new') {
      await saveDescription(productId, form.description);
      // Label
      const nextLabels = { ...labels };
      if (form.label) nextLabels[productId] = form.label;
      else delete nextLabels[productId];
      setLabels(nextLabels);
      await db.settings.set('productLabels', nextLabels);
      // Extra images
      const extras = [form.img2, form.img3].filter(s => s && s.trim());
      const nextImages = { ...images };
      if (extras.length > 0) nextImages[productId] = extras;
      else delete nextImages[productId];
      setImages(nextImages);
      await db.settings.set('productImages', nextImages);
      // Inventory (only if user entered a value)
      if (form.stock !== '' && form.stock != null) {
        const nextInv = { ...inventory, [productId]: Number(form.stock) || 0 };
        setInventory(nextInv);
        await db.settings.set('productInventory', nextInv);
      }
    }
    setEdit(null);
  };
  const del = async (id) => {
    if (!confirm('למחוק?')) return;
    await db.products.delete(id);
    setList(prev => prev.filter(i => i.id !== id));
    if (descriptions[id]) { const next = { ...descriptions }; delete next[id]; setDescs(next); await db.settings.set('productDescriptions', next); }
  };
  const toggleVis = async (id) => {
    const item = list.find(i => i.id === id); const nv = !item.visible;
    await db.products.update(id, { ...item, visible: nv });
    setList(prev => prev.map(i => i.id === id ? { ...i, visible: nv } : i));
  };
  const startEdit = p => {
    const extras = images[p.id] || [];
    setEdit(p.id);
    setForm({
      name: p.name, price: p.price, salePrice: p.salePrice || '',
      imageUrl: p.imageUrl || '',
      img2: extras[0] || '',
      img3: extras[1] || '',
      description: descriptions[p.id] || '',
      label: labels[p.id] || '',
      visible: p.visible,
      stock: inventory[p.id] != null ? inventory[p.id] : '',
    });
  };

  // Stable callbacks so memoized ProductForm doesn't re-render on parent state churn.
  const handleChange     = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const handleUploadMain = useCallback((url) => setForm(p => ({ ...p, imageUrl: url })), []);
  const handleUpload2    = useCallback((url) => setForm(p => ({ ...p, img2: url })), []);
  const handleUpload3    = useCallback((url) => setForm(p => ({ ...p, img3: url })), []);
  const handleCancel     = useCallback(() => setEdit(null), []);

  if (list === null) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  return (
    <div>
      {list.length === 0 && edit !== 'new' && <div style={S.emptyState}><p style={S.emptyEmoji}>🛍️</p><p style={S.emptyText}>אין מוצרים</p></div>}
      {list.map(p => {
        const stock = inventory[p.id];
        const trackingStock = stock != null;
        return (
          <div key={p.id} style={{ ...S.card, opacity: p.visible ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 8, border: '1px solid #F0E6D6' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontWeight: 600, fontSize: 14 }}>{p.name}</p>
                <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 12, marginTop: 3 }}>
                  ₪{p.price}{p.salePrice ? ` → ₪${p.salePrice}` : ''}
                  {trackingStock && (
                    <span style={{ marginInlineStart: 8, color: stock <= 0 ? '#C9302C' : stock <= 2 ? '#E69E2C' : 'var(--color-section)', fontWeight: 600 }}>
                      · מלאי: {stock}
                    </span>
                  )}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => toggleVis(p.id)} style={{ ...S.secondaryBtn, padding: '8px 10px' }}>{p.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                <button onClick={() => startEdit(p)} style={{ ...S.secondaryBtn, padding: '8px 10px' }}><Edit2 size={14} /></button>
                <button onClick={() => del(p.id)} style={{ ...S.deleteBtn, padding: '8px 10px' }}><Trash2 size={14} /></button>
              </div>
            </div>
            {trackingStock && edit !== p.id && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <input
                  type="number" min="1" placeholder="+ כמות"
                  value={restockAmt[p.id] || ''}
                  onChange={e => setRestockAmt(prev => ({ ...prev, [p.id]: e.target.value }))}
                  style={{ ...S.input, flex: 1, fontSize: 13, padding: '8px 10px', marginBottom: 0 }}
                />
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => restock(p.id, restockAmt[p.id])}
                  style={{ padding: '8px 14px', backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)', border: 'var(--demo-primary-mat-border, none)', borderRadius: 8, color: 'var(--color-surface)', fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={12} />חדש מלאי
                </motion.button>
              </div>
            )}
            {edit === p.id && (
              <ProductForm
                form={form} onChange={handleChange}
                onUploadMain={handleUploadMain} onUpload2={handleUpload2} onUpload3={handleUpload3}
                onSave={save} onCancel={handleCancel}
              />
            )}
          </div>
        );
      })}
      {edit === 'new' ? (
        <div style={S.card}><p style={S.heading}>מוצר חדש</p>
          <ProductForm
            form={form} onChange={handleChange}
            onUploadMain={handleUploadMain} onUpload2={handleUpload2} onUpload3={handleUpload3}
            onSave={save} onCancel={handleCancel}
          />
        </div>
      ) : (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setEdit('new'); setForm({ name: '', price: 0, salePrice: '', imageUrl: '', visible: true }); }} style={S.primaryBtn}><Plus size={18} />הוסיפי מוצר</motion.button>
      )}
    </div>
  );
}

function Orders({ orders, setOrders, onBadgeUpdate }) {
  const [busy, setBusy] = useState(null);
  // Ref guard — prevents double-tap before React re-renders the disabled state
  const actionInFlightRef = useRef(false);

  const approve = async (o) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setBusy(o.id);
    await db.orders.updateStatus(o.id, 'approved');
    // Client SMS removed — she sees updated status on the website
    notifyOwnerOrderPurchase({ clientName: o.clientName, clientPhone: o.clientPhone, items: o.items, total: o.total, orderId: o.id });
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'approved' } : x));
    onBadgeUpdate?.();

    // Send receipt email for cash orders
    const orderPayments = await db.settings.get('orderPayments', {});
    const method = orderPayments[o.id] || 'cash';
    const userRecord = await db.users.findByDigits(o.clientPhone);
    if (userRecord?.email) {
      fetch('/api/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: userRecord.email,
          name: o.clientName,
          items: (o.items || []).map(i => ({ name: `${i.name} ×${i.quantity}`, price: (i.price || 0) * (i.quantity || 1) })),
          total: o.total,
          method,
        }),
      }).catch(() => {});
    }

    setBusy(null);
    actionInFlightRef.current = false;
  };
  const reject = async (o) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setBusy(o.id);
    await db.orders.updateStatus(o.id, 'rejected');
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'rejected' } : x));
    onBadgeUpdate?.();
    setBusy(null);
    actionInFlightRef.current = false;
  };

  if (orders === null) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;
  if (!orders.length) return <div style={S.emptyState}><p style={S.emptyEmoji}>📦</p><p style={S.emptyText}>אין הזמנות עדיין</p></div>;

  const pending = orders.filter(o => o.status === 'pending');
  const past = orders.filter(o => o.status !== 'pending');
  const statusColor = { pending: 'var(--color-primary)', approved: '#4CAF50', rejected: '#A85A4A' };
  const statusLabel = { pending: 'ממתינה', approved: 'אושרה ✓', rejected: 'נדחתה' };

  return (
    <div>
      {pending.length > 0 && (
        <div style={S.card}>
          <p style={S.heading}>ממתינות לאישור ({pending.length})</p>
          {pending.map(o => (
            <div key={o.id} style={{ padding: '12px 0', borderBottom: '1px solid #F0E6D6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontWeight: 600, fontSize: 14 }}>{o.clientName}</p>
                  <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 12 }}>{o.clientPhone}</p>
                </div>
                <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, padding: '3px 10px', borderRadius: 20, backgroundColor: `${statusColor[o.status]}18`, color: statusColor[o.status], fontWeight: 600, height: 'fit-content' }}>{statusLabel[o.status]}</span>
              </div>
              <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 12, marginBottom: 8 }}>{(o.items || []).map(i => `${i.name} ×${i.quantity}`).join(' · ')}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--demo-heading-font)', color: 'var(--color-primary)', fontWeight: 700, fontSize: 18 }}>₪{o.total}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={!!busy} onClick={() => reject(o)} style={S.deleteBtn}>דחיה</button>
                  <button disabled={!!busy} onClick={() => approve(o)} style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>אישור ✓</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div style={S.card}>
          <p style={S.heading}>היסטוריה</p>
          {past.map(o => (
            <div key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid #F0E6D6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontSize: 13, fontWeight: 500 }}>{o.clientName}</p>
                <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 11 }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}</p>
              </div>
              <div style={{ textAlign: 'end' }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, backgroundColor: `${statusColor[o.status]}18`, color: statusColor[o.status], fontFamily: 'var(--demo-body-font)', fontWeight: 600 }}>{statusLabel[o.status]}</span>
                <p style={{ fontFamily: 'var(--demo-heading-font)', color: 'var(--color-primary)', fontWeight: 700, fontSize: 15, marginTop: 3 }}>₪{o.total}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Approvals — pending payments waiting for admin confirmation ──────
function Approvals({ pendingPayments, onApproved, onBadgeUpdate }) {
  const [busy, setBusy]     = useState(null);
  const [done, setDone]     = useState({});

  const todayDS = new Date().toISOString().slice(0, 10);

  const entries = Object.entries(pendingPayments).sort(([, a], [, b]) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  const todayEntries = entries.filter(([, p]) => p.aptDate === todayDS);

  const approve = async (id, payment) => {
    if (busy) return;
    setBusy(id);

    try {
      if (payment.type === 'shop') {
        // ── Shop Bit: no DB order was created — just approve & receipt ──
        // (cash/pickup orders are in the Orders tab separately)
      } else {
        // ── Appointment payment: mark in appointmentPayments ──
        const cur = await db.settings.get('appointmentPayments', {});
        await db.settings.set('appointmentPayments', { ...(cur || {}), [id]: payment.method });
      }

      // Remove from pendingPayments (same for both types)
      const pend = await db.settings.get('pendingPayments', {});
      const next = { ...pend }; delete next[id];
      await db.settings.set('pendingPayments', next);

      // Send receipt (same for both types)
      const userRecord = await db.users.findByDigits(payment.clientPhone);
      if (userRecord?.email) {
        const items = payment.items
          ? payment.items.map(i => ({ name: `${i.name} ×${i.quantity}`, price: (i.price || 0) * (i.quantity || 1) }))
          : [{ name: payment.serviceName || 'טיפול', price: payment.amount }];
        fetch('/api/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientEmail: userRecord.email,
            name: payment.clientName,
            items,
            total: payment.amount,
            method: payment.method,
          }),
        }).catch(() => {});
      }

      setDone(p => ({ ...p, [id]: true }));
      onApproved(id);
      onBadgeUpdate?.();
    } catch (e) {
      console.error('[approvals] approve failed:', e);
    } finally {
      setBusy(null);
    }
  };

  const approveToday = async () => {
    for (const [id, payment] of todayEntries) {
      await approve(id, payment);
    }
  };

  const methodLabel = (m) => m === 'bit' ? 'Bit' : m || '—';
  const methodColor = (m) => m === 'bit' ? '#0099FF' : 'var(--color-section)';

  if (entries.length === 0) {
    return (
      <div style={S.emptyState}>
        <p style={S.emptyEmoji}>✅</p>
        <p style={S.emptyText}>אין תשלומים ממתינים לאישור</p>
      </div>
    );
  }

  return (
    <div>
      {todayEntries.length > 1 && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={approveToday} disabled={!!busy}
          style={{ ...S.primaryBtn, marginBottom: 12, opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <CheckCircle2 size={16} />אשרי את כל התשלומים של היום ({todayEntries.length})
        </motion.button>
      )}

      <div style={S.card}>
        <p style={S.heading}>תשלומים לאישור ({entries.length})</p>
        {entries.map(([id, payment]) => {
          const isDone = done[id];
          return (
            <div key={id} style={{ padding: '12px 0', borderBottom: '1px solid #F0E6D6', opacity: isDone ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontWeight: 600, fontSize: 14 }}>{payment.clientName}</p>
                  <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 12, marginTop: 2 }}>
                    {payment.serviceName || (payment.items?.map(i => i.name).join(', ')) || '—'}
                  </p>
                  {payment.aptDate && (
                    <p style={{ fontFamily: 'var(--demo-body-font)', color: '#A89580', fontSize: 11, marginTop: 1 }}>
                      {payment.aptDate}{payment.aptTime ? ` · ${payment.aptTime.slice(0, 5)}` : ''}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'end', flexShrink: 0 }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--demo-radius-card)', backgroundColor: `${methodColor(payment.method)}18`, color: methodColor(payment.method), fontFamily: 'var(--demo-body-font)', fontSize: 11, fontWeight: 700 }}>
                    {methodLabel(payment.method)}
                  </span>
                  <p style={{ fontFamily: 'var(--demo-heading-font)', color: 'var(--color-primary)', fontWeight: 700, fontSize: 18, marginTop: 4 }}>₪{payment.amount}</p>
                </div>
              </div>
              {!isDone && (
                <motion.button whileTap={{ scale: 0.97 }}
                  disabled={busy === id}
                  onClick={() => approve(id, payment)}
                  style={{ width: '100%', height: 40, backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy === id ? 0.6 : 1 }}>
                  <Check size={15} />{busy === id ? 'מאשרת...' : 'אשרי תשלום ושלחי קבלה'}
                </motion.button>
              )}
              {isDone && (
                <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: '#4CAF50', textAlign: 'center' }}>✓ אושר ונשלחה קבלה</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Payment() {
  const [bit, setBit]                = useState('');
  const [visibility, setVisibility]  = useState({ bit: true });
  const [saved, setSaved]            = useState('');

  useEffect(() => {
    db.settings.get('bitAccount', '').then(v => setBit(String(v || '')));
    db.settings.get('paymentVisibility', { bit: true }).then(pv => setVisibility({ bit: pv?.bit !== false }));
  }, []);

  const flash = (k) => { setSaved(k); setTimeout(() => setSaved(''), 1500); };
  const saveBit    = (v) => { db.settings.set('bitAccount', v); flash('bit'); };
  const toggleVis  = (key) => {
    const next = { ...visibility, [key]: !visibility[key] };
    setVisibility(next);
    db.settings.set('paymentVisibility', next);
    flash('visBit');
  };

  // זיהוי האם הערך הנוכחי הוא URL (קישור Bit) או טלפון
  const isUrl = /^https?:\/\//i.test((bit || '').trim());

  return (
    <div style={S.card}>
      <p style={S.heading}>חשבון תשלום</p>
      <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: 'var(--color-section)', marginBottom: 14, lineHeight: 1.5 }}>
        הזיני <b>מספר טלפון</b> מקושר ל-Bit, או <b>קישור Bit אישי</b> שלך (אם יצרת דרך Grow/Hyp/בנק הפועלים). הלקוחות יראו את הסכום והמספר/הקישור בעת התשלום.
      </p>

      <label style={{ ...S.label, marginBottom: 4 }}>חשבון Bit</label>
      <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: '#A89580', marginBottom: 6 }}>
        טלפון (05X-XXXXXXX) או קישור (https://...)
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          type="text" dir="ltr"
          inputMode={isUrl ? 'url' : 'tel'}
          style={{ ...S.input, flex: 1, marginBottom: 0 }}
          value={bit}
          onChange={e => setBit(e.target.value)}
          onBlur={e => saveBit(e.target.value)}
          placeholder="05X-XXXXXXX או https://..."
        />
        {saved === 'bit' && <span style={{ color: '#4CAF50', fontSize: 13, alignSelf: 'center' }}>✓</span>}
      </div>
      {bit && (
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: isUrl ? '#5C8CBB' : 'var(--color-section)', marginBottom: 14 }}>
          {isUrl ? '🔗 זוהה כקישור — לחיצה תפתח את הקישור ישירות' : '📱 זוהה כטלפון — הלקוחות יעתיקו את המספר ידנית'}
        </p>
      )}
      {!bit && <div style={{ marginBottom: 14 }} />}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #F0E6D6' }}>
        <p style={{ ...S.label, marginBottom: 8 }}>הצגת אמצעי תשלום בסל ובאתר</p>
        {[
          { key: 'bit', label: 'הצג Bit', cur: visibility.bit, savedKey: 'visBit' },
        ].map(({ key, label, cur, savedKey }) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: 'var(--color-primary)' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {saved === savedKey && <span style={{ color: '#4CAF50', fontSize: 12 }}>✓</span>}
              <button
                onClick={() => toggleVis(key)}
                aria-pressed={cur}
                style={{
                  width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  position: 'relative', backgroundColor: cur ? '#4CAF50' : '#C8A882',
                  transition: 'background-color 0.2s', touchAction: 'manipulation',
                }}>
                <span style={{
                  position: 'absolute', top: 3, insetInlineStart: cur ? 23 : 3,
                  width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--color-surface)',
                  transition: 'inset-inline-start 0.2s',
                }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, padding: 10, backgroundColor: 'rgba(125,90,71,0.06)', borderRadius: 8, fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)', lineHeight: 1.6 }}>
        💡 הסכום תמיד יוצג גדול עם כפתור "העתיקי סכום" — Bit לא מאפשר הזרקת סכום אוטומטית בקישור. לאחר התשלום הלקוחה מסמנת אישור וההזמנה תופיע כ"שולם" אצלך בלוח השבועי.
      </div>
    </div>
  );
}
