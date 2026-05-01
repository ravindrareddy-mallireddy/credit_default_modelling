interface PageHeaderProps {
  title: string;
  subtitle?: string;
  tag?: string;
}

export default function PageHeader({ title, subtitle, tag }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 28, borderBottom: '1px solid #1a2d4a', paddingBottom: 20 }}>
      {tag && (
        <div style={{
          display: 'inline-block',
          fontFamily: 'DM Mono', fontSize: 10, letterSpacing: '0.15em',
          color: '#00d4ff', background: '#00d4ff11', border: '1px solid #00d4ff33',
          padding: '3px 10px', borderRadius: 4, marginBottom: 10, textTransform: 'uppercase',
        }}>
          {tag}
        </div>
      )}
      <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: '#e2e8f0', margin: 0, lineHeight: 1.2 }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 8, marginBottom: 0, fontFamily: 'DM Sans' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
