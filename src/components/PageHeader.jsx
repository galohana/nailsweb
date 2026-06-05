import { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { DEFAULT_CLINIC_INFO } from '../utils/defaults';

export default function PageHeader() {
  const [name, setName] = useState('');

  useEffect(() => {
    db.settings.get('clinicInfo', DEFAULT_CLINIC_INFO).then(ci => {
      if (ci?.name) setName(ci.name);
    });
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 90,
      backgroundColor: 'var(--color-primary)',
      backgroundImage: 'var(--demo-navbar-mat-overlay, none)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'var(--shadow-sm)',
      direction: 'rtl',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 21, fontWeight: 400, letterSpacing: '0.1em',
        color: 'var(--color-surface)', whiteSpace: 'nowrap',
      }}>
        {name}
      </span>
    </nav>
  );
}
