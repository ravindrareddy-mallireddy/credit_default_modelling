import PageHeader from "../components/PageHeader";
import PlotCard from "../components/PlotCard";
import StatCard from "../components/StatCard";

export default function MonteCarlo() {
  return (
    <div className="page-enter">
      <PageHeader
        tag="Portfolio Tail Risk"
        title="Monte Carlo Simulation"
        subtitle="2,000 correlated loss scenarios using bivariate normal shocks (ρ=0.6). VaR and CVaR computed from LR champion PD outputs."
      />

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Mean EL" value="0.0946" sub="Expected Loss per borrower" accent="cyan" />
        <StatCard label="VaR 95%" value="0.1128" sub="95th percentile loss" accent="amber" />
        <StatCard label="VaR 99%" value="0.1202" sub="99th percentile loss" accent="amber" />
        <StatCard label="CVaR 95%" value="0.1173" sub="Expected Shortfall 95%" accent="red" />
        <StatCard label="CVaR 99%" value="0.1222" sub="Expected Shortfall 99%" accent="red" />
      </div>

      {/* Main plot */}
      <PlotCard
        title="Monte Carlo Expected Loss Distribution — LR Champion (2,000 runs)"
        src="/plots/monte_carlo.png"
        caption="EL distribution from 2,000 correlated simulation runs. Orange dashed = VaR 95%, Red dashed = VaR 99%, Dark red dotted = CVaR 99%."
      />

      {/* Simulation methodology */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, padding: 20 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8', marginBottom: 14 }}>Simulation Design</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Runs', value: '2,000' },
              { label: 'Shock 1 — Utilisation (σ=0.15)', value: 'Normal' },
              { label: 'Shock 2 — Payment Delay (σ=0.20)', value: 'Normal' },
              { label: 'Shock 3 — Pay Ratio (σ=0.05)', value: 'Normal' },
              { label: 'Correlation (util ↔ delay)', value: 'ρ = 0.60' },
              { label: 'PD Model', value: 'LR Champion (WoE)' },
              { label: 'LGD', value: '0.45 (Basel standard)' },
              { label: 'Random Seed', value: '42 (reproducible)' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #0f1e35', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'DM Sans' }}>{label}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: '#e2e8f0' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, padding: 20 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8', marginBottom: 14 }}>Risk Metrics Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Mean EL', value: '0.0946', note: 'Average loss across all 2,000 runs', color: '#e2e8f0' },
              { label: 'VaR 95%', value: '0.1128', note: '95% of runs below this loss level', color: '#f59e0b' },
              { label: 'VaR 99%', value: '0.1202', note: '99% of runs below this loss level', color: '#f59e0b' },
              { label: 'CVaR 95%', value: '0.1173', note: 'Average loss in worst 5% of scenarios', color: '#ef4444' },
              { label: 'CVaR 99%', value: '0.1222', note: 'Average loss in worst 1% of scenarios', color: '#ef4444' },
              { label: 'VaR/Mean ratio', value: '1.27×', note: 'Thin tail — not fat-tailed asset losses', color: '#64748b' },
            ].map(({ label, value, note, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #0f1e35', paddingBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: '#e2e8f0' }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#334155', fontFamily: 'DM Sans', marginTop: 2 }}>{note}</div>
                </div>
                <span style={{ fontFamily: 'DM Mono', fontSize: 16, color, fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div style={{ marginTop: 20, padding: '16px 20px', background: '#f59e0b08', border: '1px solid #f59e0b22', borderLeft: '3px solid #f59e0b', borderRadius: 6 }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#f59e0b', marginBottom: 6 }}>Interpretation — Basel III / CVaR</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          CVaR99 (0.1222) is coherent per Artzner et al. (1999) and Tasche (2002) — it is monotonic, sub-additive, and translation invariant (properties VaR violates).
          The VaR-to-mean ratio of ~1.27× indicates a relatively thin tail, consistent with correlated but bounded credit shocks on a consumer card portfolio.
          Basel Committee (2016) adopted CVaR as the primary capital metric under FRTB — this simulation bridges that framework to PD model stress outputs.
        </div>
      </div>
    </div>
  );
}
