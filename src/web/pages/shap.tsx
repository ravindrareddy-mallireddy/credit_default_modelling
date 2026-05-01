import PageHeader from "../components/PageHeader";
import PlotCard from "../components/PlotCard";

export default function Shap() {
  return (
    <div className="page-enter">
      <PageHeader
        tag="Basel Model Risk · SR 11-7"
        title="SHAP Explainability"
        subtitle="SHapley Additive exPlanations applied to XGBoost and Random Forest challengers. LR champion interpretability via WoE coefficients and odds ratios."
      />

      {/* Explainability framework */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { model: 'LR (Champion)', method: 'WoE Coefficients + Odds Ratios', note: 'Directly auditable. Each coefficient = log-odds contribution per WoE bin group. Fully transparent under SR 11-7/EBA.', color: '#00d4ff' },
          { model: 'XGBoost', method: 'SHAP TreeExplainer', note: 'Beeswarm, bar, dependence plots. Force plots for individual borrowers. Shapley values guarantee local accuracy.', color: '#3b82f6' },
          { model: 'Random Forest', method: 'SHAP TreeExplainer', note: 'Same framework. class_weight=balanced ensures fair attribution across default/non-default classes.', color: '#8b5cf6' },
        ].map(({ model, method, note, color }) => (
          <div key={model} style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderTop: `2px solid ${color}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color, marginBottom: 6 }}>{model}</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#64748b', marginBottom: 8 }}>{method}</div>
            <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'DM Sans', lineHeight: 1.5 }}>{note}</div>
          </div>
        ))}
      </div>

      {/* XGBoost SHAP */}
      <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#3b82f6', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        ◈ XGBoost SHAP
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <PlotCard
          title="XGBoost — SHAP Beeswarm (Feature Impact)"
          src="/plots/shap_xgb_summary.png"
          caption="Each dot = one borrower. Color = feature value. X = SHAP value (impact on default probability)."
        />
        <PlotCard
          title="XGBoost — Mean |SHAP| Feature Importance"
          src="/plots/shap_xgb_bar.png"
          caption="Average absolute SHAP values. PAY_0 and payment delay features dominate."
        />
      </div>

      {/* Dependence plots */}
      <div style={{ marginBottom: 24 }}>
        <PlotCard
          title="SHAP Dependence Plots — Non-linear Feature Effects (XGBoost)"
          src="/plots/shap_dependence.png"
          caption="Top 3 features. X = feature value, Y = SHAP value. Reveals non-linear relationships LR cannot capture."
        />
      </div>

      {/* Force plots */}
      <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#3b82f6', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        ◈ Individual Borrower Explanations (Force Plots)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <PlotCard
          title="Force Plot — Highest PD Borrower"
          src="/plots/shap_force_highest_pd.png"
          caption="Features pushing this borrower's PD above baseline (red = increases risk, blue = decreases risk)."
        />
        <PlotCard
          title="Force Plot — Lowest PD Borrower"
          src="/plots/shap_force_lowest_pd.png"
          caption="Features pulling this borrower's PD below baseline. Strong payment history dominates."
        />
      </div>

      {/* RF SHAP */}
      <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#8b5cf6', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        ◈ Random Forest SHAP
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <PlotCard
          title="Random Forest — SHAP Beeswarm"
          src="/plots/shap_rf_summary.png"
          caption="RF SHAP values for default class. TreeExplainer with shap_values[1] for class 1 (default)."
        />
        <PlotCard
          title="Random Forest — Mean |SHAP| Bar"
          src="/plots/shap_rf_bar.png"
          caption="Feature importance ranking from RF. Consistent with XGBoost — PAY_0 dominates."
        />
      </div>

      {/* LR Coefficients */}
      <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        ◎ LR Champion — Coefficients & Odds Ratios
      </div>
      <PlotCard
        title="LR Champion — WoE Coefficients & Odds Ratios"
        src="/plots/lr_coefficients.png"
        caption="Each feature's log-odds contribution. Odds ratio > 1 = increases default risk. Fully auditable — no black box."
      />

      {/* SR 11-7 note */}
      <div style={{ marginTop: 20, padding: '16px 20px', background: '#00d4ff08', border: '1px solid #00d4ff22', borderLeft: '3px solid #00d4ff', borderRadius: 6 }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#00d4ff', marginBottom: 6 }}>Basel SR 11-7 / EBA Compliance Note</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          SR 11-7 (US Federal Reserve) and EBA model risk guidance require that models be explainable to regulators and auditors.
          SHAP satisfies this for ML challengers (Moscato et al., 2021). LR champion satisfies it directly via WoE coefficients — no SHAP required.
          The 2.6% AUC gap between LR and RF does not justify switching to a model that requires SHAP approximation for regulatory documentation.
        </div>
      </div>
    </div>
  );
}
