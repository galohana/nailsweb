# Skill: Framer Motion UI

## Install

```bash
npm install framer-motion
```

Import:
```js
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
```

## Always check reduced motion first

```jsx
function MyComponent() {
  const prefersReduced = useReducedMotion();

  const variants = prefersReduced
    ? { hidden: {}, visible: {} }  // no animation
    : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
}
```

## Buttons

Every button gets `whileTap` + spring transition:

```jsx
<motion.button
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
  style={{ /* your styles */ }}
>
  לחצי כאן
</motion.button>
```

Optional hover (desktop-only — use `@media (hover: hover)` guard):
```jsx
whileHover={{ scale: 1.02 }}
```

## Cards — scroll-triggered fade-in + slide-up

```jsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-40px' }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
>
  {/* card content */}
</motion.div>
```

Staggered children:
```jsx
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map(i => <motion.li key={i.id} variants={item}>...</motion.li>)}
</motion.ul>
```

## Modals — AnimatePresence required

```jsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{ /* modal box */ }}
      >
        {/* content */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

## Animate ONLY transform + opacity

| ✅ Safe (GPU-accelerated) | ❌ Avoid (causes layout reflow) |
|---|---|
| `opacity` | `width` / `height` |
| `scale` | `padding` / `margin` |
| `x` / `y` | `fontSize` |
| `rotate` | `maxHeight` (for accordion — use `scaleY` instead) |

## Slide-up panel (UrgentBooking pattern)

```jsx
<motion.div
  initial={{ y: '100%' }}
  animate={{ y: 0 }}
  exit={{ y: '100%' }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  style={{ position: 'fixed', bottom: 0, insetInline: 0 }}
>
  {/* panel content */}
</motion.div>
```
