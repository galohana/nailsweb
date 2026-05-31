import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Wraps any clickable element with a ripple-on-click overlay.
// Usage:
//   <Ripple><motion.button ...>...</motion.button></Ripple>
//
// The wrapper element is `position: relative` so the ripple is contained.
export default function Ripple({ children, color = 'rgba(255,255,255,0.55)' }) {
  const [ripples, setRipples] = useState([]);
  const counter = useRef(0);

  const addRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0]?.clientX) || rect.left + rect.width / 2) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0]?.clientY) || rect.top + rect.height / 2) - rect.top;
    const size = Math.max(rect.width, rect.height) * 1.4;
    const id = ++counter.current;
    setRipples(r => [...r, { id, x, y, size }]);
    setTimeout(() => setRipples(r => r.filter(p => p.id !== id)), 700);
  };

  return (
    <div
      onPointerDown={addRipple}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 'inherit' }}
    >
      {children}
      <AnimatePresence>
        {ripples.map(r => (
          <motion.span
            key={r.id}
            initial={{ opacity: 0.55, scale: 0 }}
            animate={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'absolute', pointerEvents: 'none',
              left: r.x - r.size / 2, top: r.y - r.size / 2,
              width: r.size, height: r.size, borderRadius: '50%',
              backgroundColor: color,
              mixBlendMode: 'overlay',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
