import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCircle, Star } from 'lucide-react';
import ClientsTab from './ClientsTab';
import ReviewsTab from './ReviewsTab';
import * as S from '../../utils/adminStyles';

export default function ClientsReviewsTab({ onBadgeUpdate }) {
  const [view, setView] = useState('clients'); // 'clients' | 'reviews'

  return (
    <div>
      {/* Sub-tab toggle */}
      <div style={{ ...S.card, padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setView('clients')}
            style={{
              ...S.subTab(view === 'clients'),
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <UserCircle size={15} />לקוחות
          </button>
          <button
            onClick={() => setView('reviews')}
            style={{
              ...S.subTab(view === 'reviews'),
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Star size={15} />ביקורות
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {view === 'clients' ? (
            <ClientsTab />
          ) : (
            <ReviewsTab onBadgeUpdate={onBadgeUpdate} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
