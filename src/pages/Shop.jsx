import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Plus, Minus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { storage } from '../utils/storage';
import { db } from '../utils/db';
import { notifyOwnerNewOrder } from '../utils/sms';
import PageHeader from '../components/PageHeader';
import PayButtons from '../components/PayButtons';
import PaymentConfirmModal from '../components/PaymentConfirmModal';

const C = {
  bg:      'var(--color-bg)',
  surface: 'var(--color-surface)',
  accent:  '#6B4F3A',
  text:    'var(--color-text)',
  muted:   '#8B6E52',
  border:  '#D4B896',
};

const SHADOW = '0 6px 20px rgba(92,61,46,0.10)';
const GLASS  = { backgroundColor: 'rgba(253,250,247,0.7)', backdropFilter: 'blur(16px) saturate(170%)', WebkitBackdropFilter: 'blur(16px) saturate(170%)' };

export default function Shop({ user, onNavigate }) {
  const [products, setProducts]       = useState([]);
  const [descriptions, setDescs]      = useState({});
  const [labels, setLabels]           = useState({});
  const [images, setImages]           = useState({});  // {productId: [url1, url2, url3]}
  const [inventory, setInventory]     = useState({});  // {productId: count}
  const [ownerPhone, setOwnerPhone]   = useState('');
  const [bitAccount, setBitAccount]   = useState('');
  const [paySettingsReady, setPaySettingsReady] = useState(false);
  const [cart, setCart]               = useState([]);
  const [cartOpen, setCartOpen]       = useState(false);
  const [selected, setSelected]       = useState(null);  // product object
  const [detailQty, setDetailQty]     = useState(1);
  const [justAdded, setJustAdded]     = useState(false);
  const [myOrders, setMyOrders]       = useState([]);
  const [highlightOrderId, setHighlightOrderId] = useState(null);
  const [payVisible, setPayVisible]   = useState({ bit: true });

  // Pickup states
  const [pickup, setPickup]                 = useState(false);
  const [pickupSuccess, setPickupSuccess]   = useState(false);
  const [pickupName, setPickupName]         = useState(user?.firstName || user?.name || '');
  const [pickupPhone, setPickupPhone]       = useState(user?.phone || '');
  const [pickupLoading, setPickupLoading]   = useState(false);
  // Ref guard: prevents double-submit race condition before React re-renders disabled state
  const pickupSubmittingRef = useRef(false);

  useEffect(() => {
    db.products.list(true).then(setProducts);
    db.settings.get('productDescriptions', {}).then(d => setDescs(d || {}));
    db.settings.get('productLabels', {}).then(l => setLabels(l || {}));
    db.settings.get('productImages', {}).then(im => setImages(im || {}));
    db.settings.get('productInventory', {}).then(iv => setInventory(iv || {}));
    db.settings.get('clinicInfo').then(ci => {
      const p = ci?.ownerPhone || ci?.ownerWhatsapp || ci?.phone || ci?.whatsapp || '';
      setOwnerPhone(String(p).replace(/\D/g, ''));
    });
    // Bit account now lives at root settings (set via ShopTab → Payment).
    // string חופשי — יכול להיות טלפון או URL. PayButtons מזהה ומטפל.
    db.settings.get('bitAccount', '').then(v => setBitAccount(String(v || '').trim()));
    db.settings.get('paymentVisibility', { bit: true }).then(pv => {
      setPayVisible({ bit: pv?.bit !== false });
      setPaySettingsReady(true);
    });
    if (user?.phone) {
      const digits = String(user.phone).replace(/\D/g, '');
      db.orders.list().then(all => {
        const mine = (all || []).filter(o => String(o.clientPhone || '').replace(/\D/g, '').endsWith(digits.slice(-9)));
        setMyOrders(mine.slice(0, 10));
      }).catch(() => {});
    }
    setCart(storage.get('cart', []));
  }, []);

  // Sync pickup fields when user prop loads asynchronously after mount
  useEffect(() => {
    if (!user) return;
    setPickupName(prev => prev || user?.firstName || user?.name || '');
    setPickupPhone(prev => prev || user?.phone || '');
  }, [user]);

  const openProduct = (p) => { setSelected(p); setDetailQty(1); setJustAdded(false); };
  const closeProduct = () => { setSelected(null); setJustAdded(false); };

  const addToCart = (product, qty) => {
    const cur = [...cart];
    const idx = cur.findIndex(i => i.productId === product.id);
    if (idx >= 0) cur[idx] = { ...cur[idx], quantity: cur[idx].quantity + qty };
    else cur.push({ productId: product.id, name: product.name, price: product.salePrice ?? product.price, quantity: qty });
    storage.set('cart', cur); setCart(cur);
    try { navigator.vibrate?.(15); } catch {}
  };

  const updateQty = (id, delta) => {
    const cur = cart.map(i => i.productId === id ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0);
    storage.set('cart', cur); setCart(cur);
  };

  const clearCart = () => { storage.set('cart', []); setCart([]); };

  const addLocalOrder = (order) => {
    const id = order.id || `local-${Date.now()}`;
    setMyOrders(prev => [{ ...order, id }, ...prev].slice(0, 10));
    setHighlightOrderId(id);
    setTimeout(() => setHighlightOrderId(null), 1800);
  };

  const placePickupOrder = async () => {
    if (!pickupName.trim() || !pickupPhone.trim()) return;
    // Synchronous ref guard — prevents double-submit before React re-renders the disabled state
    if (pickupSubmittingRef.current) return;
    pickupSubmittingRef.current = true;
    setPickupLoading(true);
    const payload = { clientName: pickupName.trim(), clientPhone: pickupPhone.trim(), items: cart, total };
    // Create DB row first to get orderId for the Telegram button
    let createdOrderId = null;
    try {
      const created = await db.orders.create(payload);
      createdOrderId = created?.id || created?.data?.id || null;
    } catch (e) { console.error('[Shop] orders.create:', e); }
    // Notify owner with orderId (enables "אשר הזמנה" button in Telegram)
    try { await notifyOwnerNewOrder({ ...payload, orderId: createdOrderId }); } catch (e) { console.error('[Shop] SMS:', e); }
    clearCart(); setPickupSuccess(true);
    try { navigator.vibrate?.([30, 20, 30]); } catch {}
    pickupSubmittingRef.current = false;
    setPickupLoading(false);
  };

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  // ── Gate: must be registered to order ─────────────────────────
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat' }}>
        <PageHeader />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 24px', textAlign: 'center', minHeight: '100vh' }}>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, boxShadow: SHADOW }}
          >
            <ShoppingBag size={30} color={C.accent} strokeWidth={1.7} />
          </motion.div>
          <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, color: C.text, fontWeight: 600, marginBottom: 10 }}>
            כדי לבצע הזמנה יש להירשם תחילה
          </h2>
          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>
            ההרשמה מהירה ומאפשרת לנו ליצור איתך קשר על ההזמנה 💕
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }}
            onClick={() => onNavigate?.('register')}
            style={{ width: '100%', maxWidth: 320, height: 52, borderRadius: 'var(--demo-radius-card)', border: 'none', backgroundColor: C.accent, color: 'var(--color-surface)', fontFamily: 'var(--demo-body-font)', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: SHADOW, marginBottom: 12 }}
          >
            הירשמי עכשיו ✨
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate?.('home')}
            style={{ width: '100%', maxWidth: 320, height: 46, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--demo-body-font)' }}
          >
            חזרה לדף הבית
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat' }}>
      <PageHeader />

      {/* ── Floating cart badge ── */}
      <motion.button
        onClick={() => setCartOpen(true)}
        whileTap={{ scale: 0.93 }}
        whileHover={{ scale: 1.05 }}
        style={{
          position: 'fixed', top: 75, insetInlineEnd: 16, zIndex: 90,
          width: 48, height: 48, borderRadius: '50%',
          ...GLASS, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: SHADOW,
        }}
      >
        <ShoppingBag size={20} color={C.accent} strokeWidth={1.8} />
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              style={{
                position: 'absolute', top: -4, insetInlineEnd: -4,
                width: 22, height: 22, borderRadius: '50%',
                backgroundColor: C.accent, color: 'var(--color-surface)',
                fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--demo-body-font)',
                boxShadow: '0 2px 6px rgba(107,79,58,0.35)',
              }}
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Hero header ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ padding: '88px 20px 20px' }}
      >
        <h1 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 32, fontWeight: 600, color: C.text, letterSpacing: '0.02em' }}>
          חנות
        </h1>
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted, marginTop: 4 }}>
          מוצרי טיפוח נבחרים 💕
        </p>
      </motion.div>

      {/* ── My orders strip ── */}
      {myOrders.length > 0 && (
        <OrdersStrip orders={myOrders} highlightId={highlightOrderId} />
      )}

      {/* ── Products grid 2-col ── */}
      <div style={{ padding: '0 16px 96px' }}>
        {products.length === 0 ? (
          <p style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontFamily: 'var(--demo-body-font)' }}>
            טוענת מוצרים...
          </p>
        ) : (
          <motion.div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          >
            {products.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                label={labels[p.id]}
                stock={inventory[p.id]}
                onClick={() => openProduct(p)}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Product detail (shared layoutId) ── */}
      <AnimatePresence>
        {selected && (
          <ProductDetail
            product={selected}
            description={descriptions[selected.id] || ''}
            label={labels[selected.id]}
            extraImages={images[selected.id] || []}
            stock={inventory[selected.id]}
            qty={detailQty}
            setQty={setDetailQty}
            justAdded={justAdded}
            onClose={closeProduct}
            onAdd={() => { addToCart(selected, detailQty); setJustAdded(true); setTimeout(closeProduct, 700); }}
          />
        )}
      </AnimatePresence>

      {/* ── Cart drawer (slides from right in RTL) ── */}
      <AnimatePresence>
        {cartOpen && (
          <CartDrawer
            cart={cart}
            total={total}
            user={user}
            onClose={() => setCartOpen(false)}
            onUpdateQty={updateQty}
            ownerPhone={ownerPhone}
            bitAccount={payVisible.bit ? bitAccount : ''}
            paySettingsReady={paySettingsReady}
            onOrderComplete={addLocalOrder}
            pickupName={pickupName}
            setPickupName={setPickupName}
            pickupPhone={pickupPhone}
            setPickupPhone={setPickupPhone}
            pickupLoading={pickupLoading}
            placePickupOrder={placePickupOrder}
            clearCart={clearCart}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Product card ─────────────────────────────────────────────────
function ProductCard({ product, label, stock, onClick }) {
  const price = product.salePrice ?? product.price;
  const outOfStock = stock != null && Number(stock) <= 0;
  return (
    <motion.div
      layoutId={`product-${product.id}`}
      onClick={outOfStock ? undefined : onClick}
      whileTap={outOfStock ? {} : { scale: 0.97 }}
      whileHover={outOfStock ? {} : { y: -4, boxShadow: '0 14px 32px rgba(92,61,46,0.22)' }}
      variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      style={{
        backgroundColor: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 'var(--demo-radius-card)', overflow: 'hidden',
        cursor: outOfStock ? 'not-allowed' : 'pointer',
        opacity: outOfStock ? 0.6 : 1,
        boxShadow: SHADOW, display: 'flex', flexDirection: 'column',
      }}
    >
      <motion.div layoutId={`img-${product.id}`} style={{ position: 'relative', width: '100%', aspectRatio: '1', backgroundColor: '#F0E6D6' }}>
        <img
          src={product.imageUrl}
          alt={product.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: outOfStock ? 'grayscale(40%)' : 'none' }}
          onError={e => { e.target.style.opacity = 0.4; }}
        />
        {outOfStock && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(45,27,30,0.45)' }}>
            <span style={{ backgroundColor: '#C9302C', color: '#FFFFFF', fontSize: 12, padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontFamily: 'var(--demo-body-font)', letterSpacing: '0.04em', boxShadow: '0 4px 14px rgba(201,48,44,0.4)' }}>
              אזל מלאי
            </span>
          </div>
        )}
        {!outOfStock && stock != null && stock <= 2 && (
          <span style={{ position: 'absolute', bottom: 8, insetInlineStart: 8, backgroundColor: '#E69E2C', color: '#FFFFFF', fontSize: 10, padding: '3px 8px', borderRadius: 'var(--demo-radius-card)', fontWeight: 700, fontFamily: 'var(--demo-body-font)' }}>
            אחרון! ({stock})
          </span>
        )}
        {product.salePrice && (
          <span style={{ position: 'absolute', top: 8, insetInlineStart: 8, backgroundColor: C.accent, color: 'var(--color-surface)', fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700, fontFamily: 'var(--demo-body-font)', boxShadow: '0 2px 6px rgba(107,79,58,0.3)' }}>
            מבצע
          </span>
        )}
        {label === 'recommended' && (
          <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, backgroundColor: '#C99B6C', color: 'var(--color-surface)', fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700, fontFamily: 'var(--demo-body-font)', boxShadow: '0 2px 8px rgba(201,155,108,0.4)' }}>
            ★ מומלץ
          </span>
        )}
        {label === 'new' && (
          <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, backgroundColor: '#7FA88B', color: 'var(--color-surface)', fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700, fontFamily: 'var(--demo-body-font)', boxShadow: '0 2px 8px rgba(127,168,139,0.4)' }}>
            חדש
          </span>
        )}
      </motion.div>
      <div style={{ padding: 12 }}>
        <p style={{ fontFamily: 'var(--demo-body-font)', color: C.text, fontWeight: 600, fontSize: 13, lineHeight: 1.3, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: 'var(--demo-heading-font)', color: C.accent, fontWeight: 700, fontSize: 18 }}>₪{price}</span>
          {product.salePrice && (
            <span style={{ fontFamily: 'var(--demo-body-font)', color: C.muted, textDecoration: 'line-through', fontSize: 11 }}>₪{product.price}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Product detail (fullscreen, single scrollable body) ──────────
function ProductDetail({ product, description, label, extraImages, stock, qty, setQty, justAdded, onClose, onAdd }) {
  const price = product.salePrice ?? product.price;
  const totalPrice = price * qty;
  const outOfStock = stock != null && Number(stock) <= 0;
  const maxQty = stock != null && Number(stock) > 0 ? Number(stock) : 99;

  // Build image list — main + up to 2 extras
  const allImages = [product.imageUrl, ...(extraImages || []).filter(Boolean)].filter(Boolean).slice(0, 3);
  const [activeImg, setActiveImg] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        backgroundColor: 'rgba(45,27,30,0.55)',
        display: 'flex', justifyContent: 'center', alignItems: 'stretch',
      }}
      onClick={onClose}
    >
      <motion.div
        layoutId={`product-${product.id}`}
        onClick={e => e.stopPropagation()}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        style={{
          position: 'relative', width: '100%', maxWidth: 420,
          backgroundColor: C.surface,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',  // single scrollable body — image scrolls with content
        }}
      >
        {/* Close button — sticky in viewport */}
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.9 }}
          style={{
            position: 'fixed', top: 12, insetInlineEnd: 12, zIndex: 10,
            width: 36, height: 36, borderRadius: '50%',
            ...GLASS, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: SHADOW,
          }}
        >
          <X size={16} color={C.text} />
        </motion.button>

        {/* Image carousel with rounded corners */}
        <div style={{ padding: 12, paddingTop: 12 }}>
          <motion.div layoutId={`img-${product.id}`} style={{ position: 'relative', width: '100%', aspectRatio: '1', backgroundColor: '#F0E6D6', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 24px rgba(92,61,46,0.12)' }}>
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImg}
                src={allImages[activeImg]}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                onError={e => { e.target.style.opacity = 0.4; }}
              />
            </AnimatePresence>
            {product.salePrice && (
              <span style={{ position: 'absolute', top: 14, insetInlineStart: 14, backgroundColor: C.accent, color: 'var(--color-surface)', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontFamily: 'var(--demo-body-font)', boxShadow: '0 2px 8px rgba(107,79,58,0.35)', zIndex: 2 }}>
                מבצע
              </span>
            )}
            {outOfStock && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(45,27,30,0.55)', zIndex: 2 }}>
                <span style={{ backgroundColor: '#C9302C', color: '#FFFFFF', fontSize: 16, padding: '10px 20px', borderRadius: 24, fontWeight: 700, fontFamily: 'var(--demo-body-font)', letterSpacing: '0.04em', boxShadow: '0 6px 20px rgba(201,48,44,0.45)' }}>
                  אזל מלאי
                </span>
              </div>
            )}

            {/* Image navigation arrows — only if more than one image */}
            {allImages.length > 1 && (
              <>
                {/* Prev (right side in RTL) */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setActiveImg(i => (i - 1 + allImages.length) % allImages.length)}
                  style={{
                    position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    backgroundColor: 'rgba(253,250,247,0.85)', backdropFilter: 'blur(8px)',
                    border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(45,27,30,0.18)',
                    zIndex: 3,
                  }}
                >
                  <ChevronRight size={18} color={C.accent} />
                </motion.button>

                {/* Next (left side in RTL) */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setActiveImg(i => (i + 1) % allImages.length)}
                  style={{
                    position: 'absolute', insetInlineStart: 10, top: '50%', transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    backgroundColor: 'rgba(253,250,247,0.85)', backdropFilter: 'blur(8px)',
                    border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(45,27,30,0.18)',
                    zIndex: 3,
                  }}
                >
                  <ChevronLeft size={18} color={C.accent} />
                </motion.button>
              </>
            )}
          </motion.div>

          {/* Dots — only if more than one image */}
          {allImages.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
              {allImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  style={{ width: i === activeImg ? 22 : 8, height: 8, borderRadius: 4, border: 'none', backgroundColor: i === activeImg ? C.accent : C.border, cursor: 'pointer', transition: 'width 0.25s', padding: 0 }}
                />
              ))}
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ padding: '6px 24px 32px' }}
        >
          <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 28, fontWeight: 600, color: C.text, lineHeight: 1.2, marginBottom: 8 }}>
            {product.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--demo-heading-font)', color: C.accent, fontWeight: 700, fontSize: 26 }}>₪{price}</span>
            {product.salePrice && (
              <span style={{ fontFamily: 'var(--demo-body-font)', color: C.muted, textDecoration: 'line-through', fontSize: 14 }}>₪{product.price}</span>
            )}
            {stock != null && !outOfStock && (
              <span style={{ marginInlineStart: 'auto', fontFamily: 'var(--demo-body-font)', fontSize: 11, color: stock <= 2 ? '#E69E2C' : C.muted, fontWeight: 600 }}>
                במלאי: {stock}
              </span>
            )}
          </div>

          {description && (
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
              {description}
            </p>
          )}

          {/* Quantity selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '12px 14px', backgroundColor: C.bg, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted }}>כמות</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setQty(q => Math.max(1, q - 1))}
                disabled={outOfStock}
                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', opacity: outOfStock ? 0.4 : 1 }}
              >
                <Minus size={14} color={C.text} />
              </motion.button>
              <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 16, fontWeight: 700, color: C.text, minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setQty(q => Math.min(maxQty, q + 1))}
                disabled={outOfStock || qty >= maxQty}
                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', backgroundColor: C.accent, color: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', opacity: (outOfStock || qty >= maxQty) ? 0.4 : 1 }}
              >
                <Plus size={14} />
              </motion.button>
            </div>
          </div>

          {/* CTA */}
          <motion.button
            whileTap={outOfStock ? {} : { scale: 0.97 }}
            whileHover={outOfStock ? {} : { scale: 1.02 }}
            onClick={outOfStock ? undefined : onAdd}
            disabled={justAdded || outOfStock}
            style={{
              width: '100%', height: 54, borderRadius: 'var(--demo-radius-card)', border: 'none',
              backgroundColor: outOfStock ? '#A89580' : justAdded ? '#4CAF50' : C.accent,
              color: 'var(--color-surface)',
              fontFamily: 'var(--demo-body-font)', fontSize: 16, fontWeight: 700,
              cursor: outOfStock ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: outOfStock ? 'none' : '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
              transition: 'background-color 0.25s',
            }}
          >
            {outOfStock ? (
              <span>אזל מלאי</span>
            ) : (
              <AnimatePresence mode="wait">
                {justAdded ? (
                  <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={18} /> נוסף לסל
                  </motion.span>
                ) : (
                  <motion.span key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingBag size={18} /> הוסיפי לסל · ₪{totalPrice}
                  </motion.span>
                )}
              </AnimatePresence>
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ── Orders strip + detail modal ───────────────────────────────────
function OrdersStrip({ orders, highlightId }) {
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const fmtDateFull = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const statusColor = (s) => {
    if (s === 'paid')      return { bg: 'rgba(76,175,80,0.10)', fg: '#388E3C', label: '✓ שולם' };
    if (s === 'approved')  return { bg: 'rgba(76,175,80,0.10)', fg: '#388E3C', label: '✓ אושר' };
    if (s === 'rejected')  return { bg: 'rgba(229,115,115,0.10)', fg: '#C62828', label: '✕ נדחה' };
    return                     { bg: 'rgba(230,158,44,0.10)', fg: '#A06A1A', label: '⏳ ממתין' };
  };
  const methodLabel = (m) => m === 'bit' ? 'Bit' : 'מזומן';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ padding: '0 16px 8px' }}>
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '0.04em', marginBottom: 8, textAlign: 'start' }}>
          ההזמנות שלי
        </p>
        <div style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: 4 }}>
          <style>{`.gavot-orders-strip::-webkit-scrollbar{display:none}`}</style>
          <div className="gavot-orders-strip" style={{ display: 'flex', gap: 10, width: 'fit-content', paddingBottom: 2 }}>
            <AnimatePresence initial={false}>
              {orders.map(o => {
                const st = statusColor(o.status);
                const isNew = highlightId === o.id;
                return (
                  <motion.div key={o.id}
                    layout
                    initial={isNew ? { opacity: 0, scale: 0.6, x: 60 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                    onClick={() => setSelectedOrder(o)}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      flexShrink: 0, width: 130, padding: 12, borderRadius: 'var(--demo-radius-card)',
                      backgroundColor: C.surface, cursor: 'pointer',
                      border: `1px solid ${isNew ? C.accent : C.border}`,
                      boxShadow: isNew ? `0 0 0 2px rgba(107,79,58,0.15), 0 4px 18px rgba(92,61,46,0.12)` : '0 2px 10px rgba(92,61,46,0.06)',
                    }}>
                    {/* Date only as main title */}
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                      {fmtDate(o.createdAt)}
                    </p>
                    <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 17, fontWeight: 700, color: C.accent }}>
                      ₪{o.total}
                    </p>
                    <span style={{ display: 'inline-block', marginTop: 6, fontFamily: 'var(--demo-body-font)', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, backgroundColor: st.bg, color: st.fg }}>
                      {st.label}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ── Order detail modal (bottom sheet) ── */}
      <AnimatePresence>
        {selectedOrder && (() => {
          const o = selectedOrder;
          const st = statusColor(o.status);
          const ml = methodLabel(o.method);
          return (
            <motion.div
              key="order-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedOrder(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(45,27,30,0.52)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            >
              <motion.div
                initial={{ y: 80, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 80, opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', maxWidth: 420,
                  backgroundColor: C.surface,
                  borderRadius: '20px 20px 0 0',
                  padding: '8px 20px 48px',
                  direction: 'rtl',
                  boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
                }}
              >
                {/* Drag handle */}
                <div style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.border, margin: '10px auto 18px' }} />

                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 24, fontWeight: 600, color: C.text, lineHeight: 1 }}>
                      {fmtDateFull(o.createdAt)}
                    </p>
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: C.muted, marginTop: 4 }}>
                      שיטת תשלום: {ml || '—'}
                    </p>
                  </div>
                  <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--demo-radius-card)', backgroundColor: st.bg, color: st.fg }}>
                    {st.label}
                  </span>
                </div>

                {/* Items */}
                {(o.items || []).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 8, letterSpacing: '0.04em' }}>פריטים</p>
                    {o.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.text }}>
                          {item.name}
                          {item.quantity > 1 && <span style={{ color: C.muted }}> ×{item.quantity}</span>}
                        </span>
                        {item.price != null && (
                          <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 15, color: C.accent, fontWeight: 700 }}>
                            ₪{item.price * (item.quantity || 1)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
                  <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14, color: C.muted, fontWeight: 600 }}>סה״כ</span>
                  <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 28, fontWeight: 700, color: C.accent }}>₪{o.total}</span>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedOrder(null)}
                  style={{ width: '100%', height: 46, marginTop: 18, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.muted, fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  סגירה
                </motion.button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
}

function CartDrawer({ cart, total, user, onClose, onUpdateQty, ownerPhone, bitAccount, paySettingsReady, onOrderComplete, pickupName, setPickupName, pickupPhone, setPickupPhone, pickupLoading, placePickupOrder, clearCart }) {
  // result: null | 'paid' | 'pending'
  const [result, setResult] = useState(null);
  const [paidMethod, setPaidMethod] = useState(null);
  const [askDetails, setAskDetails] = useState(false);  // for cash flow only
  const [confirmModal, setConfirmModal] = useState(null);  // { method: 'bit' } | null

  const handlePaymentConfirmed = async () => {
    const method = confirmModal?.method;
    setConfirmModal(null);
    setPaidMethod(method);

    const clientName  = user?.firstName || user?.name || '';
    const clientPhone = user?.phone || '';
    const orderItems  = cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }));
    const createdAt   = new Date().toISOString();
    const orderId     = `shop-${Date.now()}`;

    // Add to pendingPayments — admin approves in Approvals tab + sends receipt
    // No DB order created here: Bit → Approvals only; Cash → Orders only
    try {
      const pend = await db.settings.get('pendingPayments', {});
      await db.settings.set('pendingPayments', {
        ...(pend || {}),
        [orderId]: {
          type: 'shop',
          orderId,
          method,
          clientName,
          clientPhone,
          amount: total,
          items: orderItems,
          createdAt,
        },
      });
    } catch (e) { console.error('[cart] pendingPayments:', e); }

    // 3. Notify owner via Telegram (fire-and-forget); paymentId enables reject/approve buttons
    try { notifyOwnerNewOrder({ clientName, clientPhone, items: orderItems, total, paymentId: orderId }); } catch {}

    // 4. Add to local strip as pending — receipt will be sent by admin on approval
    onOrderComplete?.({ id: orderId, clientName, clientPhone, items: orderItems, total, status: 'pending', method, createdAt });
    setResult('pending');
    clearCart();
  };
  const handleCashSubmit = async () => {
    await placePickupOrder();
    onOrderComplete?.({
      clientName: pickupName || user?.firstName || '',
      clientPhone: pickupPhone || user?.phone || '',
      items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
      total,
      status: 'pending',
      method: 'cash',
      createdAt: new Date().toISOString(),
    });
    setResult('pending');
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 120, backgroundColor: 'rgba(45,27,30,0.5)' }}
    >
      <motion.aside
        onClick={e => e.stopPropagation()}
        initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        style={{
          position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
          width: '88%', maxWidth: 360,
          backgroundColor: C.surface,
          boxShadow: '4px 0 20px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column',
          direction: 'rtl',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 22, fontWeight: 600, color: C.text }}>סל קניות</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color={C.muted} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {result === 'paid' ? (
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              style={{ textAlign: 'center', padding: '32px 20px', backgroundColor: 'rgba(76,175,80,0.08)', borderRadius: 'var(--demo-radius-card)', border: '1px solid rgba(76,175,80,0.25)' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>✓</div>
              <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 22, fontWeight: 600, color: C.text }}>
                התשלום התקבל 💕
              </p>
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted, marginTop: 6 }}>
                שולם בBit — קבלה בדרך לאימייל שלך
              </p>
              <button onClick={() => { setResult(null); onClose(); }}
                style={{ marginTop: 18, padding: '10px 24px', backgroundColor: 'transparent', border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                סגרי
              </button>
            </motion.div>
          ) : result === 'pending' ? (
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              style={{ textAlign: 'center', padding: '32px 20px', backgroundColor: 'rgba(230,158,44,0.08)', borderRadius: 'var(--demo-radius-card)', border: '1px solid rgba(230,158,44,0.25)' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>⏳</div>
              <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 22, fontWeight: 600, color: C.text }}>ממתין לאישור</p>
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted, marginTop: 6 }}>
                {paidMethod
                  ? `ההזמנה נרשמה — לאחר אישור הצוות תישלח קבלה לאימייל שלך 💕`
                  : 'נחזור אליך לאישור ההזמנה 💕'}
              </p>
              <button onClick={() => { setResult(null); setAskDetails(false); onClose(); }}
                style={{ marginTop: 18, padding: '10px 24px', backgroundColor: 'transparent', border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                סגרי
              </button>
            </motion.div>
          ) : cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
              <ShoppingBag size={36} strokeWidth={1.3} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14 }}>הסל ריק</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cart.map(item => (
                <motion.div key={item.productId} layout
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: C.muted, marginTop: 2 }}>₪{item.price} × {item.quantity}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => onUpdateQty(item.productId, -1)} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.border}`, backgroundColor: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Minus size={12} color={C.text} />
                    </button>
                    <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 700, color: C.text, minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => onUpdateQty(item.productId, 1)} style={{ width: 26, height: 26, borderRadius: 7, border: 'none', backgroundColor: C.accent, color: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && !result && (
          <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, ...GLASS }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted }}>סה״כ</span>
              <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 28, fontWeight: 700, color: C.accent }}>₪{total}</span>
            </div>

            {askDetails ? (
              <div>
                <label style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: C.muted, marginBottom: 4, display: 'block' }}>שם מלא</label>
                <input value={pickupName} onChange={e => setPickupName(e.target.value)} placeholder="שם מלא"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 10, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', backgroundColor: C.surface, color: C.text, fontFamily: 'var(--demo-body-font)' }} />
                <label style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: C.muted, marginBottom: 4, display: 'block' }}>טלפון</label>
                <input type="tel" dir="ltr" value={pickupPhone} onChange={e => setPickupPhone(e.target.value)} placeholder="05X-XXXXXXX"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 12, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', backgroundColor: C.surface, color: C.text, fontFamily: 'var(--demo-body-font)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={handleCashSubmit}
                    disabled={pickupLoading || !pickupName.trim() || !pickupPhone.trim()}
                    style={{ flex: 1, height: 46, borderRadius: 'var(--demo-radius-card)', border: 'none', backgroundColor: C.accent, color: 'var(--color-surface)', fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (pickupLoading || !pickupName.trim() || !pickupPhone.trim()) ? 0.6 : 1, boxShadow: '0 4px 14px rgba(107,79,58,0.25)' }}>
                    {pickupLoading ? 'שולחת...' : 'שלחי הזמנה'}
                  </motion.button>
                  <button onClick={() => setAskDetails(false)}
                    style={{ width: 80, height: 46, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--demo-body-font)' }}>
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!paySettingsReady ? (
                  <div style={{ padding: '14px 0', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted }}>טוענת אפשרויות תשלום...</p>
                  </div>
                ) : bitAccount ? (
                  <PayButtons
                    ownerPhone={ownerPhone}
                    bitAccount={bitAccount}
                    amount={total}
                    onPaid={(method) => setConfirmModal({ method })}
                  />
                ) : (
                  <div style={{ padding: '14px 0', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted }}>אפשרויות תשלום לא הוגדרו עדיין</p>
                  </div>
                )}
                <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}
                  onClick={() => setAskDetails(true)}
                  style={{ width: '100%', height: 48, borderRadius: 'var(--demo-radius-card)', border: `1.5px solid ${C.accent}`,
                    backgroundColor: 'transparent', color: C.accent,
                    fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  📦 שריין ושלם במקום · ₪{total}
                </motion.button>
              </div>
            )}
          </div>
        )}
      </motion.aside>

    </motion.div>

      <PaymentConfirmModal
        open={!!confirmModal}
        amount={total}
        method={confirmModal?.method}
        onConfirm={handlePaymentConfirmed}
        onCancel={() => setConfirmModal(null)}
      />
    </>
  );
}
