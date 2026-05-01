import PageHeader from "../components/PageHeader";
import PlotCard from "../components/PlotCard";
import StatCard from "../components/StatCard";

const ecl = [
  { scenario: 'Baseline',     lifetimePD: 0.6106, ecl: 0.2668, color: '#10b981' },
  { scenario: 'Mild Stress',  lifetimePD: 0.6540, ecl: 0.2857, color: '#f59e0b' },
  { scenario: 'Severe Stress',lifetimePD: 0.7052, ecl: 0.3081, color: '#ef4444' },
];

const stages = [
  { stage: 'Stage 1', desc: 'PD < 5% — Performing', count: 148, pct: 3.3, ecl_type: '12-Month ECL', color: '#10b981' },
  { stage: 'Stage 2', desc: 'PD 5–20% — Significant Risk Increase', count: 2268, pct: 50.4, ecl_type: 'Lifetime ECL', color: '#f59e0b' },
  { stage: 'Stage 3', desc: 'PD > 20% — Credit Impaired', count: 2084, pct: 46.3, ecl_type: 'Lifetime ECL (Impaired)', color: '#ef4444' },
];

export default function IFRS9() {
  return (
    <div className="page-enter">
      <PageHeader
        tag="IFRS9 · Expected Credit Loss"
        title="IFRS9 Analysis"
        subtitle="Lifetime PD, ECL computation and S1/S2/S3 stage classification. All outputs driven by LR champion model. ECL computed under 3 macro scenarios."
      />

      {/* ECL stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {ecl.map(e => (
          <div key={e.scenario} style={{
            background: '#0a1628', border: '1px solid #1a2d4a',
            borderTop: `2px solid ${e.color}`, borderRadius: 6, padding: 18,
          }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: e.color, marginBottom: 12 }}>{e.scenario}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Lifetime PD</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 22, color: '#e2e8f0' }}>{(e.lifetimePD * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Mean ECL</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 22, color: e.color }}>{e.ecl.toFixed(4)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ECL change */}
      <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8', marginBottom: 14 }}>ECL Sensitivity — Scenario Impact</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ecl.map((e, i) => (
            <div key={e.scenario}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'DM Sans' }}>{e.scenario}</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: '#64748b' }}>
                    {i > 0 ? `+${((e.ecl - ecl[0].ecl) / ecl[0].ecl * 100).toFixed(1)}% vs Baseline` : 'Baseline'}
                  </span>
                  <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: e.color }}>ECL {e.ecl.toFixed(4)}</span>
                </div>
              </div>
              <div style={{ background: '#0f1e35', borderRadius: 3, height: 10 }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: e.color,
                  width: `${(e.ecl / 0.35) * 100}%`,
                }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: '#334155', fontFamily: 'DM Mono' }}>
          Severe stress ECL ({ecl[2].ecl.toFixed(4)}) is +15.5% above baseline ECL ({ecl[0].ecl.toFixed(4)}).
          ECL = Lifetime PD × LGD (0.45) / (1 + discount_rate 0.03). T=5 years.
        </div>
      </div>

      {/* Stage distribution */}
      <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a2d4a' }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8' }}>Stage Distribution — Mild Stress Scenario</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Description</th>
              <th>Threshold</th>
              <th>Count</th>
              <th>% Portfolio</th>
              <th>ECL Type</th>
            </tr>
          </thead>
          <tbody>
            {stages.map(s => (
              <tr key={s.stage}>
                <td style={{ color: s.color, fontWeight: 700 }}>{s.stage}</td>
                <td>{s.desc}</td>
                <td style={{ color: s.color }}>{s.stage === 'Stage 1' ? 'PD < 5%' : s.stage === 'Stage 2' ? 'PD 5–20%' : 'PD > 20%'}</td>
                <td>{s.count.toLocaleString()}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#0f1e35', borderRadius: 2, height: 6, width: 60 }}>
                      <div style={{ height: '100%', background: s.color, borderRadius: 2, width: `${s.pct}%` }} />
                    </div>
                    <span style={{ color: s.color }}>{s.pct}%</span>
                  </div>
                </td>
                <td><span style={{ fontFamily: 'DM Mono', fontSize: 11, color: s.color }}>{s.ecl_type}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '10px 18px', fontSize: 10, color: '#334155', fontFamily: 'DM Mono', borderTop: '1px solid #1a2d4a' }}>
          Stage thresholds: S1 &lt;5%, S2 5–20%, S3 &gt;20% per IASB (2014). Staging based on LR champion PD × 1.10 mild stress multiplier.
        </div>
      </div>

      {/* Plots */}
      <PlotCard
        title="IFRS9 — ECL by Scenario & Stage Distribution"
        src="/plots/ifrs9_ecl.png"
        caption="Left: Mean ECL under 3 macro scenarios. Right: S1/S2/S3 distribution under mild stress."
      />

      {/* IFRS9 framework */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, padding: 20 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8', marginBottom: 14 }}>ECL Computation Parameters</div>
          {[
            { label: 'PD Model', value: 'LR Champion (WoE+Scorecard)' },
            { label: 'LGD', value: '0.45' },
            { label: 'Discount Rate', value: '3%' },
            { label: 'Horizon T', value: '5 years' },
            { label: 'Macro Scenarios', value: '3 (Baseline / Mild / Severe)' },
            { label: 'Stage 1 Threshold', value: 'PD < 5% (12-month ECL)' },
            { label: 'Stage 2 Threshold', value: '5% ≤ PD < 20% (Lifetime ECL)' },
            { label: 'Stage 3 Threshold', value: 'PD ≥ 20% (Lifetime ECL)' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #0f1e35', paddingBottom: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'DM Sans' }}>{label}</span>
              <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#e2e8f0' }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 20px', background: '#10b98108', border: '1px solid #10b98122', borderLeft: '3px solid #10b981', borderRadius: 6, alignSelf: 'start' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#10b981', marginBottom: 8 }}>IFRS9 Standard Compliance</div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            LR champion produces PiT (Point-in-Time) calibrated PDs per IASB (2014) requirements.
            IsotonicCalibrator applied post-training to ensure Hosmer-Lemeshow PASS (p=0.084).
            Forward-looking lifetime PDs computed via sequential annual survival function.
            ECL variability across scenarios directly impacts P&L and regulatory capital per Bellini (2019) and Novotny-Farkas (2016).
          </div>
        </div>
      </div>
    </div>
  );
}
