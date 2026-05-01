import { useState } from "react";
import PageHeader from "../components/PageHeader";
import PlotCard from "../components/PlotCard";

const allModels = [
  { model: "LR (WoE+Scorecard)", baseline: 0.7177, mild: 0.7213, severe: 0.7003, drop: 0.0174, dropPct: 2.42, rank: 1, champion: true },
  { model: "MLP",                baseline: 0.7288, mild: 0.7136, severe: 0.7055, drop: 0.0233, dropPct: 3.20, rank: 2, champion: false },
  { model: "XGBoost",            baseline: 0.7415, mild: 0.7375, severe: 0.7046, drop: 0.0369, dropPct: 4.98, rank: 3, champion: false },
  { model: "LightGBM",           baseline: 0.7305, mild: 0.7378, severe: 0.6774, drop: 0.0531, dropPct: 7.27, rank: 4, champion: false },
  { model: "Random Forest",      baseline: 0.7534, mild: 0.7391, severe: 0.6843, drop: 0.0691, dropPct: 9.17, rank: 5, champion: false },
];

const scenarios = [
  { key: 'baseline', label: 'Baseline', color: '#10b981', desc: 'No shocks. Normal economic conditions.' },
  { key: 'mild',     label: 'Mild Stress', color: '#f59e0b', desc: '+10% utilisation, +0.5 month delay, −10% pay ratio.' },
  { key: 'severe',   label: 'Severe Stress', color: '#ef4444', desc: '+30% utilisation, +1.5 month delay, −25% pay ratio.' },
];

export default function Stress() {
  const [selected, setSelected] = useState<string>('all');

  return (
    <div className="page-enter">
      <PageHeader
        tag="Basel ICAAP"
        title="Stress Testing"
        subtitle="3 deterministic economic scenarios applied to all 5 models. Measures AUC degradation under stress — revealing robustness differences invisible on standard test-set evaluation."
      />

      {/* Scenario cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {scenarios.map(s => (
          <div key={s.key} style={{
            background: '#0a1628', border: '1px solid #1a2d4a',
            borderTop: `2px solid ${s.color}`, borderRadius: 6, padding: 16,
          }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: s.color, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'DM Sans', lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Robustness table */}
      <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a2d4a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8' }}>Robustness Ranking — AUC Under Stress</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Model</th>
              <th>Baseline AUC</th>
              <th>Mild AUC</th>
              <th>Severe AUC</th>
              <th>AUC Drop</th>
              <th>Drop %</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {allModels.map(m => (
              <tr key={m.model} className={m.champion ? 'champion' : ''}>
                <td>
                  <span style={{
                    fontFamily: 'DM Mono', fontWeight: 700, fontSize: 14,
                    color: m.rank === 1 ? '#10b981' : m.rank === 5 ? '#ef4444' : '#64748b',
                  }}>#{m.rank}</span>
                </td>
                <td style={{ fontWeight: m.champion ? 700 : 400 }}>
                  {m.model}
                  {m.champion && <span style={{ marginLeft: 6, fontSize: 9, color: '#00d4ff', background: '#00d4ff11', border: '1px solid #00d4ff33', padding: '1px 6px', borderRadius: 3 }}>CHAMPION</span>}
                </td>
                <td>{m.baseline.toFixed(4)}</td>
                <td>{m.mild.toFixed(4)}</td>
                <td>{m.severe.toFixed(4)}</td>
                <td style={{ color: m.drop < 0.03 ? '#10b981' : m.drop < 0.06 ? '#f59e0b' : '#ef4444' }}>
                  −{m.drop.toFixed(4)}
                </td>
                <td style={{ color: m.dropPct < 3 ? '#10b981' : m.dropPct < 6 ? '#f59e0b' : '#ef4444' }}>
                  −{m.dropPct.toFixed(2)}%
                </td>
                <td>
                  {m.rank <= 2
                    ? <span className="badge-pass">ROBUST</span>
                    : m.rank <= 3
                    ? <span className="badge-warn">MODERATE</span>
                    : <span className="badge-fail">FRAGILE</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '10px 18px', fontSize: 10, color: '#334155', fontFamily: 'DM Mono', borderTop: '1px solid #1a2d4a' }}>
          LR (WoE+Scorecard) is most robust under all stress scenarios. Random Forest — despite highest baseline AUC — degrades most severely (9.17% drop).
        </div>
      </div>

      {/* Visual bar comparison */}
      <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>AUC Drop Under Severe Stress</div>
        {allModels.map(m => (
          <div key={m.model} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: m.champion ? '#00d4ff' : '#94a3b8', fontFamily: 'DM Sans' }}>{m.model}</span>
              <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: m.dropPct < 3 ? '#10b981' : m.dropPct < 6 ? '#f59e0b' : '#ef4444' }}>
                −{m.dropPct.toFixed(2)}%
              </span>
            </div>
            <div style={{ background: '#0f1e35', borderRadius: 3, height: 8 }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: m.dropPct < 3 ? '#10b981' : m.dropPct < 6 ? '#f59e0b' : '#ef4444',
                width: `${(m.dropPct / 10) * 100}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Plots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <PlotCard
          title="Stress Testing — All 5 Models (AUC · Gini · KS)"
          src="/plots/stress_all_models.png"
          caption="AUC, Gini, KS across Baseline → Mild → Severe for all 5 models"
        />
        <PlotCard
          title="Robustness Ranking — AUC Drop Under Severe Stress"
          src="/plots/stress_robustness_ranking.png"
          caption="LR most robust (#1). RF most fragile (#5). Invisible from static AUC comparison."
        />
      </div>

      {/* Key insight */}
      <div style={{ marginTop: 20, padding: '16px 20px', background: '#ef444408', border: '1px solid #ef444422', borderLeft: '3px solid #ef4444', borderRadius: 6 }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#ef4444', marginBottom: 6 }}>Key Finding — RQ2</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          Standard test-set evaluation ranks Random Forest #1 (AUC 0.766). Stress testing reveals it is the <strong style={{ color: '#ef4444' }}>least robust model</strong> (AUC drop 9.17%).
          LR ranks last on AUC but <strong style={{ color: '#10b981' }}>first on robustness</strong> (AUC drop 2.42%).
          Stress testing reveals meaningful differences not visible from static backtesting alone — directly answering RQ2.
        </div>
      </div>
    </div>
  );
}
