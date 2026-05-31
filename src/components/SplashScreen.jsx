import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SplashScreen({ onDone }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(t);
  }, []);

  const handleExitComplete = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#F5EFE6');
    onDone?.();
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
          transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: '#100806',
            backgroundImage: "url('/splash.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
    </AnimatePresence>
  );
}
