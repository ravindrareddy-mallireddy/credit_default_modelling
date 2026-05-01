interface PlotCardProps {
  title: string;
  src: string;
  caption?: string;
}

export default function PlotCard({ title, src, caption }: PlotCardProps) {
  return (
    <div style={{
      background: '#0a1628',
      border: '1px solid #1a2d4a',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1a2d4a',
        fontFamily: 'Syne',
        fontSize: 13,
        fontWeight: 600,
        color: '#94a3b8',
        letterSpacing: '0.05em',
      }}>
        {title}
      </div>
      <div style={{ background: '#fff', lineHeight: 0 }}>
        <img src={src} alt={title} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      {caption && (
        <div style={{ padding: '10px 16px', fontSize: 11, color: '#334155', fontFamily: 'DM Mono' }}>
          {caption}
        </div>
      )}
    </div>
  );
}
