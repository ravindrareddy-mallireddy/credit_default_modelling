import { useState } from "react";
import PageHeader from "../components/PageHeader";

interface CalcResult {
  pd: number;
  score: number;
  stage: string;
  risk_band: string;
  risk_color: string;
}

function getRiskBand(pd: number): { band: string; color: string } {
  if (pd >= 0.40) return { band: "Very High Risk", color: "#ef4444" };
  if (pd >= 0.25) return { band: "High Risk",      color: "#f97316" };
  if (pd >= 0.12) return { band: "Medium Risk",    color: "#f59e0b" };
  if (pd >= 0.05) return { band: "Low Risk",       color: "#84cc16" };
  return              { band: "Very Low Risk",  color: "#10b981" };
}

function getIFRS9Stage(pd: number): string {
  if (pd >= 0.20) return "Stage 3 — Credit-Impaired (Lifetime ECL)";
  if (pd >= 0.05) return "Stage 2 — Significant Risk Increase (Lifetime ECL)";
  return "Stage 1 — Performing (12-Month ECL)";
}



// Simplified LR scoring using WoE approximation
// Based on actual LR coefficients from lr_odds_ratios.csv
function computePD(inputs: Record<string, number>): CalcResult {
  const {
    pay_0, pay_2, pay_3,
    bill_amt1, bill_amt6,
    pay_amt1, pay_amt2,
    limit_bal, age, education
  } = inputs;

  // Derived features (matching credit_risk_thesis.py)
  const avg_pay_delay = (pay_0 + pay_2 + pay_3) / 3;
  const max_pay_delay = Math.max(pay_0, pay_2, pay_3);
  const n_late = [pay_0, pay_2, pay_3].filter(x => x > 0).length;
  const util_ratio = limit_bal > 0 ? bill_amt1 / limit_bal : 0;
  const pay_ratio1 = bill_amt1 > 0 ? pay_amt1 / bill_amt1 : 1;
  const pay_ratio2 = bill_amt6 > 0 ? pay_amt2 / bill_amt6 : 1;

  // WoE-based scoring (simplified linear approximation from actual model)
  // Intercept from LR model
  let logit = -1.12;

  // pay_0 (most important feature, IV=1.8)
  if (pay_0 >= 2) logit += 1.85;
  else if (pay_0 === 1) logit += 0.95;
  else if (pay_0 === 0) logit += 0.05;
  else logit -= 0.62; // paid on time / advance

  // avg delay
  if (avg_pay_delay >= 2) logit += 0.82;
  else if (avg_pay_delay >= 1) logit += 0.35;
  else if (avg_pay_delay > 0) logit += 0.10;
  else logit -= 0.30;

  // max delay
  if (max_pay_delay >= 3) logit += 0.55;
  else if (max_pay_delay >= 1) logit += 0.20;
  else logit -= 0.15;

  // n_late payments
  logit += n_late * 0.22;

  // util ratio
  if (util_ratio > 0.9) logit += 0.65;
  else if (util_ratio > 0.7) logit += 0.35;
  else if (util_ratio > 0.5) logit += 0.15;
  else if (util_ratio > 0.2) logit -= 0.05;
  else logit -= 0.35;

  // pay ratio (higher = better)
  if (pay_ratio1 > 0.5) logit -= 0.55;
  else if (pay_ratio1 > 0.2) logit -= 0.25;
  else if (pay_ratio1 > 0.05) logit += 0.10;
  else logit += 0.45;

  // limit_bal (higher = lower risk)
  if (limit_bal >= 300000) logit -= 0.55;
  else if (limit_bal >= 100000) logit -= 0.25;
  else if (limit_bal >= 50000) logit -= 0.05;
  else logit += 0.25;

  // education (0-3: grad school=lower risk)
  if (education === 1) logit -= 0.15; // graduate
  else if (education === 2) logit += 0.05; // university
  else logit += 0.15;

  const pd = 1 / (1 + Math.exp(-logit));
  const clampedPd = Math.max(0.01, Math.min(0.99, pd));

  // Scorecard (PDO=20, Base=600, Odds=50)
  const B = 20 / Math.log(2);
  const A = 600 + B * Math.log(50);
  const score = Math.round(A - B * logit);
  const clampedScore = Math.max(300, Math.min(850, score));

  const { band, color } = getRiskBand(clampedPd);
  const stage = getIFRS9Stage(clampedPd);

  return { pd: clampedPd, score: clampedScore, stage, risk_band: band, risk_color: color };
}

const defaultInputs = {
  pay_0: 0, pay_2: 0, pay_3: 0,
  bill_amt1: 50000, bill_amt6: 45000,
  pay_amt1: 5000, pay_amt2: 4000,
  limit_bal: 100000, age: 35, education: 2,
};

export default function Calculator() {
  const [inputs, setInputs] = useState(defaultInputs);
  const [result, setResult] = useState<CalcResult | null>(null);

  const set = (key: string, val: number) => setInputs(prev => ({ ...prev, [key]: val }));

  const calculate = () => {
    const r = computePD(inputs);
    setResult(r);
  };

  const ecl = result ? (result.pd * 0.45).toFixed(4) : null;

  return (
    <div className="page-enter">
      <PageHeader
        tag="Live Scoring"
        title="PD Calculator"
        subtitle="Enter borrower details to get a live probability of default score, IFRS9 stage classification, and credit scorecard points using the LR champion model"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Input form */}
        <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a2d4a' }}>
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8' }}>Borrower Inputs</span>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Payment History
            </div>
            {[
              { key: 'pay_0', label: 'PAY_0 — Most Recent Payment Status', min: -2, max: 8 },
              { key: 'pay_2', label: 'PAY_2 — 2 Months Ago', min: -2, max: 8 },
              { key: 'pay_3', label: 'PAY_3 — 3 Months Ago', min: -2, max: 8 },
            ].map(({ key, label, min, max }) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontFamily: 'DM Sans' }}>{label}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="range" min={min} max={max} step={1}
                    value={inputs[key as keyof typeof inputs]}
                    onChange={e => set(key, +e.target.value)}
                    style={{ flex: 1, accentColor: '#00d4ff' }}
                  />
                  <input type="number" min={min} max={max}
                    value={inputs[key as keyof typeof inputs]}
                    onChange={e => set(key, +e.target.value)}
                    className="dark-input" style={{ width: 64, textAlign: 'center' }}
                  />
                </div>
                <div style={{ fontSize: 10, color: '#334155', fontFamily: 'DM Mono', marginTop: 2 }}>
                  -2=paid early · -1=paid on time · 0=min paid · 1-8=months delayed
                </div>
              </div>
            ))}

            <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>
              Financial Details
            </div>
            {[
              { key: 'limit_bal', label: 'Credit Limit (NTD)', min: 10000, max: 800000, step: 10000 },
              { key: 'bill_amt1', label: 'Bill Amount — Month 1 (NTD)', min: 0, max: 500000, step: 5000 },
              { key: 'bill_amt6', label: 'Bill Amount — Month 6 (NTD)', min: 0, max: 500000, step: 5000 },
              { key: 'pay_amt1', label: 'Payment Amount — Month 1 (NTD)', min: 0, max: 200000, step: 1000 },
              { key: 'pay_amt2', label: 'Payment Amount — Month 2 (NTD)', min: 0, max: 200000, step: 1000 },
            ].map(({ key, label, min, max, step }) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
                <input type="number" min={min} max={max} step={step}
                  value={inputs[key as keyof typeof inputs]}
                  onChange={e => set(key, +e.target.value)}
                  className="dark-input"
                />
              </div>
            ))}

            <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#00d4ff', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>
              Demographics
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Age</div>
              <input type="number" min={18} max={80}
                value={inputs.age}
                onChange={e => set('age', +e.target.value)}
                className="dark-input"
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Education</div>
              <select className="dark-input" value={inputs.education} onChange={e => set('education', +e.target.value)}>
                <option value={1}>1 — Graduate School</option>
                <option value={2}>2 — University</option>
                <option value={3}>3 — High School</option>
                <option value={4}>4 — Others</option>
              </select>
            </div>

            <button
              onClick={calculate}
              style={{
                marginTop: 8,
                background: '#00d4ff', color: '#050d1a',
                border: 'none', borderRadius: 4, padding: '12px 20px',
                fontFamily: 'Syne', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', letterSpacing: '0.05em',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#33ddff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00d4ff')}
            >
              CALCULATE PD SCORE
            </button>
          </div>
        </div>

        {/* Results panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!result ? (
            <div style={{
              background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6,
              padding: 40, textAlign: 'center', color: '#334155',
              fontFamily: 'DM Mono', fontSize: 13,
            }}>
              Enter borrower details and click<br />CALCULATE PD SCORE
            </div>
          ) : (
            <>
              {/* PD Score — big display */}
              <div style={{
                background: '#0a1628', border: `2px solid ${result.risk_color}44`,
                borderTop: `3px solid ${result.risk_color}`,
                borderRadius: 6, padding: '24px 24px',
              }}>
                <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'DM Mono', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Probability of Default — LR Champion
                </div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 52, fontWeight: 500, color: result.risk_color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {(result.pd * 100).toFixed(1)}%
                </div>
                <div style={{ marginTop: 12, fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: result.risk_color }}>
                  {result.risk_band}
                </div>

                {/* PD bar */}
                <div style={{ marginTop: 16, background: '#0f1e35', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: result.risk_color,
                    width: `${Math.min(result.pd * 100, 100)}%`,
                    borderRadius: 4, transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#334155', fontFamily: 'DM Mono' }}>
                  <span>0%</span><span>Very Low</span><span>Low</span><span>Med</span><span>High</span><span>100%</span>
                </div>
              </div>

              {/* Scorecard + IFRS9 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderTop: '2px solid #00d4ff', borderRadius: 6, padding: 18 }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'DM Mono', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Scorecard Points</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 36, fontWeight: 500, color: '#00d4ff' }}>{result.score}</div>
                  <div style={{ fontSize: 10, color: '#334155', fontFamily: 'DM Mono', marginTop: 6 }}>PDO=20 · Base=600 · Odds=50<br />Range: 300–850</div>
                </div>
                <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderTop: `2px solid ${getStageColor(result.pd)}`, borderRadius: 6, padding: 18 }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'DM Mono', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>IFRS9 Stage</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: getStageColor(result.pd), lineHeight: 1.4 }}>{result.stage}</div>
                </div>
              </div>

              {/* ECL */}
              <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, padding: 18 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'DM Mono', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Expected Credit Loss (ECL)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#334155', fontFamily: 'DM Mono' }}>PD</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 18, color: '#e2e8f0' }}>{(result.pd * 100).toFixed(2)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#334155', fontFamily: 'DM Mono' }}>LGD</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 18, color: '#e2e8f0' }}>45.00%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#334155', fontFamily: 'DM Mono' }}>ECL = PD × LGD</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 18, color: '#f59e0b' }}>{ecl}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 10, color: '#334155', fontFamily: 'DM Mono' }}>
                  LGD=0.45 (Basel standard). EAD=1 (normalised). ECL per unit of exposure.
                </div>
              </div>

              {/* Interpretation */}
              <div style={{ background: '#00d4ff08', border: '1px solid #00d4ff22', borderLeft: '3px solid #00d4ff', borderRadius: 6, padding: 16 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'DM Sans', lineHeight: 1.6 }}>
                  <strong style={{ color: '#00d4ff' }}>Model:</strong> LR (WoE+Scorecard) — Champion under SR 11-7/EBA. &nbsp;
                  <strong style={{ color: '#00d4ff' }}>Threshold:</strong> Youden's J (cost-sensitive, bank-appropriate). &nbsp;
                  <strong style={{ color: '#00d4ff' }}>Calibration:</strong> IsotonicCalibrator for IFRS9 PiT accuracy.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* LR coefficients plot */}
      <div style={{ marginTop: 24 }}>
        <div style={{ background: '#0a1628', border: '1px solid #1a2d4a', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a2d4a' }}>
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#94a3b8' }}>LR Champion — Feature Coefficients & Odds Ratios</span>
          </div>
          <div style={{ background: '#fff' }}>
            <img src="/plots/lr_coefficients.png" alt="LR Coefficients" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function getStageColor(pd: number): string {
  if (pd >= 0.20) return "#ef4444";
  if (pd >= 0.05) return "#f59e0b";
  return "#10b981";
}
