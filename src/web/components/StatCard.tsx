interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'cyan' | 'green' | 'amber' | 'red';
  pass?: boolean | null;
}

const accentColors = {
  cyan:  '#00d4ff',
  green: '#10b981',
  amber: '#f59e0b',
  red:   '#ef4444',
};

export default function StatCard({ label, value, sub, accent = 'cyan', pass }: StatCardProps) {
  const color = accentColors[accent];
  return (
    <div style={{
      background: '#0a1628',
      border: '1px solid #1a2d4a',
      borderTop: `2px solid ${color}`,
      borderRadius: 6,
      padding: '16px 18px',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = color + '66';
      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${color}18`;
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = '#1a2d4a';
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
    }}
    >
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'DM Sans' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: 26, fontWeight: 500, color: '#e2e8f0', letterSpacing: '-0.02em' }}>
          {value}
        </div>
        {pass !== undefined && pass !== null && (
          <span className={pass ? 'badge-pass' : 'badge-fail'}>
            {pass ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#334155', marginTop: 6, fontFamily: 'DM Mono' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
