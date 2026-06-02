export const card = {
  backgroundColor: 'rgba(253,250,247,0.78)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  borderRadius: 'var(--radius-xl)',
  padding: '20px',
  marginBottom: '12px',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-surface-50)',
};
export const heading = { fontFamily: 'var(--font-display)', fontSize: 'var(--text-4xl)', color: 'var(--color-text)', marginBottom: '4px', fontWeight: 600 };
export const subText = { fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', marginBottom: '16px' };
export const input = { width: '100%', padding: '12px 14px', marginBottom: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-lg)', textAlign: 'right', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' };
export const label = { display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--color-primary-ink)', marginBottom: '6px', fontWeight: 500 };
export const primaryBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-lg)', fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-btn)' };
export const secondaryBtn = { padding: '8px 14px', backgroundColor: 'transparent', color: 'var(--color-primary-ink)', border: '1px solid var(--color-border-dark)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', cursor: 'pointer' };
export const deleteBtn = { padding: '8px 14px', backgroundColor: 'transparent', color: 'var(--color-accent)', border: '1px solid #E8C8C0', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', cursor: 'pointer' };
export const subTab = (active) => ({ padding: '10px 16px', backgroundColor: active ? 'var(--color-primary)' : 'transparent', color: active ? 'var(--color-on-primary)' : 'var(--color-text-muted)', border: active ? 'none' : '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)', fontWeight: active ? 600 : 400, cursor: 'pointer' });
export const divider = { height: '1px', backgroundColor: 'var(--color-border)', margin: '20px 0' };
export const emptyState = {
  backgroundColor: 'rgba(253,250,247,0.78)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  borderRadius: 'var(--radius-xl)',
  padding: '40px 20px',
  marginBottom: '12px',
  border: '1px solid var(--color-surface-50)',
  boxShadow: 'var(--shadow-card)',
  textAlign: 'center',
};
export const emptyEmoji = { fontSize: '32px', marginBottom: '8px' };
export const emptyText = { fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)', color: 'var(--color-text-muted)' };
export const toggleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-border-soft)' };
export const toggleLabel = { fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)', color: 'var(--color-text)', fontWeight: 500 };
