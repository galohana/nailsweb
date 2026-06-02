import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Class-based ErrorBoundary — catches render errors in any admin tab and shows a
// friendly recovery UI instead of a white screen.
export default class TabBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null, info: null, expanded: false };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error('[TabBoundary] crash:', err, info);
    this.setState({ info });
  }

  reset = () => this.setState({ err: null, info: null, expanded: false });

  render() {
    if (!this.state.err) return this.props.children;

    const msg = String(this.state.err?.message || this.state.err);
    const stack = String(this.state.info?.componentStack || this.state.err?.stack || '').slice(0, 800);

    return (
      <div style={{ padding: 18, backgroundColor: 'rgba(168,90,74,0.06)', border: '1px solid rgba(168,90,74,0.25)', borderRadius: 'var(--demo-radius-card)', direction: 'rtl', margin: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <AlertTriangle size={18} color="#A85A4A" />
          <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 20, color: '#A85A4A', margin: 0, fontWeight: 600 }}>
            הטאב קרס
          </p>
        </div>
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: 'var(--color-section)', marginBottom: 12, lineHeight: 1.6 }}>
          משהו השתבש בעת הצגת הטאב. אפשר לנסות שוב או לעבור לטאב אחר.
        </p>
        <pre style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: '#A85A4A', backgroundColor: 'rgba(168,90,74,0.06)', padding: '8px 10px', borderRadius: 8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg}
        </pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={this.reset}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 8, fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={13} /> נסי שוב
          </button>
          <button
            onClick={() => this.setState({ expanded: !this.state.expanded })}
            style={{ padding: '8px 14px', backgroundColor: 'transparent', color: 'var(--color-section)', border: '1px solid #E8DCC8', borderRadius: 8, fontFamily: 'var(--demo-body-font)', fontSize: 12, cursor: 'pointer' }}
          >
            {this.state.expanded ? 'הסתר טכני' : 'הצג מידע טכני'}
          </button>
        </div>
        {this.state.expanded && stack && (
          <pre style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 10, color: 'var(--color-section)', backgroundColor: 'var(--color-surface)', border: '1px solid #E8DCC8', padding: 10, borderRadius: 8, maxHeight: 240, overflow: 'auto', direction: 'ltr', textAlign: 'left' }}>
            {stack}
          </pre>
        )}
      </div>
    );
  }
}
