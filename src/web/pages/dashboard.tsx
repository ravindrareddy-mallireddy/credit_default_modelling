import StatCard from "../components/StatCard";
import PlotCard from "../components/PlotCard";
import PageHeader from "../components/PageHeader";

const models = [
  { name: "LR (WoE+Scorecard)", auc: 0.7392, gini: 0.4785, ks: 0.394, brier: 0.1462, psi: 0.0005, hl: 0.0837, recall: 0.6074, f1: 0.5151, champion: true },
  { name: "Random Forest",       auc: 0.7664, gini: 0.5328, ks: 0.4068, brier: 0.1414, psi: 0.0033, hl: 0.3112, recall: 0.6014, f1: 0.5261, champion: false },
  { name: "XGBoost",             auc: 0.7580, gini: 0.5159, ks: 0.4063, brier: 0.1424, psi: 0.0074, hl: 0.3185, recall: 0.6526, f1: 0.5181, champion: false },
  { name: "LightGBM",            auc: 0.7618, gini: 0.5236, ks: 0.4041, brier: 0.1416, psi: 0.0003, hl: 0.1432, recall: 0.6606, f1: 0.5155, champion: false },
  { name: "MLP",                 auc: 0.7505, gini: 0.5011, ks: 0.3956, brier: 0.1436, psi: 0.0021, hl: 0.0539, recall: 0.5894, f1: 0.5190, champion: false },
];

export default function Dashboard() {
  return (
    <div className="page-enter">
      <PageHeader
        tag="Overview"
        title="Credit Risk Dashboard"
        subtitle="Basel III / IFRS9 aligned evaluation — 5 models, 8 regulatory metrics, UCI Credit Card Dataset (n=30,000)"
      />

      {/* Champion model stat cards */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
          ◎ Champion Model — LR (WoE+Scorecard)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="AUC" value="0.7392" sub="Threshold >0.70 ✓" accent="cyan" pass={true} />
          <StatCard label="Gini" value="0.4785" sub="Threshold >0.40 ✓" accent="cyan" pass={true} />
          <StatCard label="KS Statistic" value="0.394" sub="Threshold >0.30 ✓" accent="cyan" pass={true} />
          <StatCard label="PSI" value="0.0005" sub="Most stable (< 0.10)" accent="green" pass={true} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
          <StatCard label="Brier Score" value="0.1462" sub="vs baseline 0.172" accent="cyan" pass={true} />
          <StatCard label="HL p-value" value="0.0837" sub="p > 0.05 PASS" accent="green" pass={true} />
          <StatCard label="Recall (Default)" value="60.74%" sub="Youden's J threshold" accent="cyan" />
          <StatCard label="Stress Robustness" value="#1 / 5" sub="AUC drop 2.4% only" accent="green" />
        </div>
      </div>

      {/* Model comparison table */}
      <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, marginTop: 24, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a2d4a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8' }}>All Models — Regulatory Metric Comparison</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff', background: '#00d4ff11', border: '1px solid #00d4ff33', padding: '2px 8px', borderRadius: 4 }}>Basel IRB · IFRS9</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>AUC</th>
                <th>Gini</th>
                <th>KS</th>
                <th>Brier</th>
                <th>PSI</th>
                <th>HL p-val</th>
                <th>Recall↑</th>
                <th>F1</th>
                <th>Basel</th>
                <th>IFRS9</th>
              </tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.name} className={m.champion ? 'champion' : ''}>
                  <td style={{ fontWeight: m.champion ? 700 : 400 }}>
                    {m.name}
                    {m.champion && <span style={{ marginLeft: 6, fontSize: 9, color: '#00d4ff', background: '#00d4ff11', border: '1px solid #00d4ff33', padding: '1px 6px', borderRadius: 3 }}>CHAMPION</span>}
                  </td>
                  <td>{m.auc.toFixed(4)}</td>
                  <td>{m.gini.toFixed(4)}</td>
                  <td>{m.ks.toFixed(4)}</td>
                  <td>{m.brier.toFixed(4)}</td>
                  <td>{m.psi.toFixed(4)}</td>
                  <td>{m.hl.toFixed(4)}</td>
                  <td>{(m.recall * 100).toFixed(1)}%</td>
                  <td>{m.f1.toFixed(4)}</td>
                  <td><span className="badge-pass">PASS</span></td>
                  <td><span className="badge-pass">PASS</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 18px', fontSize: 10, color: '#334155', fontFamily: 'DM Mono', borderTop: '1px solid #1a2d4a' }}>
          All models pass Basel IRB thresholds (AUC &gt;0.70, Gini &gt;0.40, KS &gt;0.30, PSI &lt;0.10) and IFRS9 calibration tests. LR selected as champion: 2.6% AUC gap does not justify interpretability cost under SR 11-7/EBA.
        </div>
      </div>

      {/* Plots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        <PlotCard
          title="Model Comparison — All Basel/IFRS9 Metrics"
          src="/plots/model_comparison.png"
          caption="6-panel comparison across all regulatory metrics for all 5 models"
        />
        <PlotCard
          title="ROC Curves & Calibration — All 5 Models"
          src="/plots/roc_calibration.png"
          caption="Left: ROC curves. Right: Calibration curves showing IFRS9 PD accuracy"
        />
      </div>

      {/* EDA plots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <PlotCard
          title="EDA — Default Rate by Demographics"
          src="/plots/eda_demographics.png"
          caption="Default rate by sex, education, marriage, age group"
        />
        <PlotCard
          title="EDA — Correlation Heatmap"
          src="/plots/eda_correlation.png"
          caption="Feature correlation with default indicator"
        />
      </div>

      {/* Extended Backtesting Results */}
      <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, marginTop: 24, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a2d4a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8' }}>Extended Backtesting — Basel III IRB & IFRS9</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#10b981', background: '#10b98111', border: '1px solid #10b98133', padding: '2px 8px', borderRadius: 4 }}>ALL PASS</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Framework</th>
                <th>Metric</th>
                <th>Result</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Binomial Test (PiT Calibration)</td>
                <td><span style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff' }}>IFRS9</span></td>
                <td><span style={{ fontFamily: 'DM Mono', fontSize: 12 }}>p = 0.9143</span></td>
                <td><span className="badge-pass">PASS</span></td>
                <td style={{ color: '#64748b', fontSize: 11 }}>Predicted DR 22.21% ≈ Actual DR 22.13% — no significant difference</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Traffic Light Test</td>
                <td><span style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff' }}>Basel III IRB</span></td>
                <td><span style={{ fontFamily: 'DM Mono', fontSize: 12 }}>Z = −0.12, p = 0.90</span></td>
                <td><span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#10b981', background: '#10b98111', border: '1px solid #10b98133', padding: '2px 8px', borderRadius: 3 }}>GREEN</span></td>
                <td style={{ color: '#64748b', fontSize: 11 }}>996 actual vs 999 expected defaults — within 1σ, deep GREEN zone</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Decile Calibration</td>
                <td><span style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff' }}>Basel III / IFRS9</span></td>
                <td><span style={{ fontFamily: 'DM Mono', fontSize: 12 }}>Mean |diff| = 2.13%</span></td>
                <td><span className="badge-pass">PASS</span></td>
                <td style={{ color: '#64748b', fontSize: 11 }}>8/9 deciles within ±5% tolerance. Max deviation 8.4% in mid-risk band</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 18px', fontSize: 10, color: '#334155', fontFamily: 'DM Mono', borderTop: '1px solid #1a2d4a' }}>
          Champion model (LR WoE+Scorecard) passes ALL Basel III IRB and IFRS9 backtesting requirements. Ref: Basel II Annex 11 / EBA GL on PD estimation.
        </div>
      </div>

      {/* Key finding callout */}
      <div style={{
        marginTop: 24, padding: '16px 20px',
        background: '#00d4ff08', border: '1px solid #00d4ff22',
        borderLeft: '3px solid #00d4ff', borderRadius: 6,
      }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#00d4ff', marginBottom: 6 }}>Key Finding — RQ1</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          RF achieves the highest AUC (0.7664) but under severe stress its AUC drops 9.17% — the worst of all 5 models.
          LR drops only 2.42%, is most stable (PSI=0.0005), and passes all Basel/IFRS9 tests.
          The 2.6% AUC gap does not justify the interpretability cost under SR 11-7/EBA guidance.
          <strong style={{ color: '#00d4ff' }}> LR is the regulatory champion.</strong>
        </div>
      </div>
    </div>
  );
}
