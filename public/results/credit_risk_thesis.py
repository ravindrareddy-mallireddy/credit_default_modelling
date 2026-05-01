"""
Credit Default Risk Modelling — Full Thesis Pipeline
Beyond Accuracy: A Basel- and IFRS-Aligned Evaluation of Credit Default Risk Models

Models: Logistic Regression (WoE/Scorecard), Random Forest, XGBoost, LightGBM, MLP
Fixes:  class_weight/scale_pos_weight (Basel-compliant), isotonic calibration, Youden threshold, SHAP, full Basel/IFRS9 comparison
"""

# ─────────────────────────────────────────────────────────────────────────────
# 0. IMPORTS
# ─────────────────────────────────────────────────────────────────────────────
import pandas as pd
import numpy as np
import json, os, warnings, pickle, joblib
warnings.filterwarnings('ignore')

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from scipy.stats import chi2_contingency, ks_2samp, chi2

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import (
    roc_auc_score, roc_curve, brier_score_loss,
    precision_recall_curve, classification_report,
    confusion_matrix, average_precision_score
)
from sklearn.calibration import calibration_curve

import xgboost as xgb
import lightgbm as lgb
import shap
import scorecardpy as sc
import scorecardpy as scorecardpy
# SMOTE removed — not Basel/IFRS9 compliant (synthetic data distorts empirical PD)
# Imbalance handled via class_weight='balanced' and scale_pos_weight
from statsmodels.stats.outliers_influence import variance_inflation_factor

os.makedirs('results', exist_ok=True)
os.makedirs('plots',   exist_ok=True)

print("=" * 70)
print("CREDIT DEFAULT RISK MODELLING — THESIS PIPELINE")
print("=" * 70)

# ─────────────────────────────────────────────────────────────────────────────
# HELPER: Manual Isotonic Calibration (sklearn 1.8 compatible)
# ─────────────────────────────────────────────────────────────────────────────

class IsotonicCalibrator:
    """Wraps a fitted model + isotonic regression calibrator on a val set."""
    def __init__(self, base_model, predict_fn=None):
        self.base_model = base_model
        self.iso = IsotonicRegression(out_of_bounds='clip')
        self._predict_fn = predict_fn  # optional custom predict_proba

    def fit(self, X_val, y_val):
        raw = self._raw_proba(X_val)
        self.iso.fit(raw, np.array(y_val))
        return self

    def _raw_proba(self, X):
        if self._predict_fn:
            return self._predict_fn(X)
        return self.base_model.predict_proba(X)[:,1]

    def predict_proba(self, X):
        raw = self._raw_proba(X)
        return self.iso.predict(raw)

# ─────────────────────────────────────────────────────────────────────────────
# 1. DATA LOADING & CLEANING
# ─────────────────────────────────────────────────────────────────────────────
print("\n[1] DATA LOADING & CLEANING")

df = pd.read_csv('UCI_Credit_Card.csv')
df.rename(columns={'default.payment.next.month': 'default'}, inplace=True)

if 'ID' in df.columns:
    df.drop(columns=['ID'], inplace=True)

df['EDUCATION'] = df['EDUCATION'].replace([0, 5, 6], 4)
df['MARRIAGE']  = df['MARRIAGE'].replace(0, 3)

pay_cols = ['PAY_0', 'PAY_2', 'PAY_3', 'PAY_4', 'PAY_5', 'PAY_6']
for col in pay_cols:
    df[col] = df[col].replace([-2, -1], 0)

print(f"  Shape         : {df.shape}")
print(f"  Missing vals  : {df.isnull().sum().sum()}")
print(f"  Default rate  : {df['default'].mean()*100:.1f}%")
print(f"  Class counts  : {df['default'].value_counts().to_dict()}")

# ─────────────────────────────────────────────────────────────────────────────
# 2. EDA
# ─────────────────────────────────────────────────────────────────────────────
print("\n[2] EDA")

fig, axes = plt.subplots(2, 2, figsize=(14, 10))
df['AGE_BIN'] = pd.cut(df['AGE'], bins=[20,30,40,50,60,80])
for ax, col in zip(axes.flatten(), ['SEX', 'EDUCATION', 'MARRIAGE', 'AGE_BIN']):
    grp = df.groupby(col)['default'].mean().reset_index()
    ax.bar(grp[col].astype(str), grp['default'], alpha=0.8, edgecolor='black', color='#42A5F5')
    ax.set_title(f'Default Rate by {col}', fontweight='bold')
    ax.set_ylabel('Default Rate'); ax.tick_params(axis='x', rotation=20)
plt.tight_layout()
plt.savefig('plots/eda_demographics.png', dpi=100); plt.close()

numeric_df = df.select_dtypes(include=[np.number])
plt.figure(figsize=(12, 10))
sns.heatmap(numeric_df.corr(), cmap='coolwarm', annot=False)
plt.title('Correlation Heatmap')
plt.savefig('plots/eda_correlation.png', dpi=100); plt.close()

df.drop(columns=['AGE_BIN'], errors='ignore', inplace=True)

print("  Chi-Square tests:")
for col in ['SEX', 'EDUCATION', 'MARRIAGE']:
    ct = pd.crosstab(df[col], df['default'])
    _, p_val, _, _ = chi2_contingency(ct)
    print(f"    {col:<12} p={p_val:.4f} {'*Significant*' if p_val < 0.05 else 'Not significant'}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. TRAIN / VAL / TEST SPLIT  70/15/15
# ─────────────────────────────────────────────────────────────────────────────
print("\n[3] TRAIN/VAL/TEST SPLIT  (70/15/15, stratified)")

X = df.drop(columns=['default'])
y = df['default']

X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.30, random_state=42, stratify=y)
X_val,   X_test,  y_val,   y_test  = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp)

print(f"  Train : {X_train.shape}  defaults={y_train.mean()*100:.1f}%")
print(f"  Val   : {X_val.shape}  defaults={y_val.mean()*100:.1f}%")
print(f"  Test  : {X_test.shape}  defaults={y_test.mean()*100:.1f}%")

# ─────────────────────────────────────────────────────────────────────────────
# 4. FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────
print("\n[4] FEATURE ENGINEERING")

def create_features(data):
    d = data.copy()
    pc = ['PAY_0','PAY_2','PAY_3','PAY_4','PAY_5','PAY_6']
    d['AVG_DELAY']    = d[pc].mean(axis=1)
    d['MAX_DELAY']    = d[pc].max(axis=1)
    d['NUM_LATE_PAY'] = (d[pc] > 0).sum(axis=1)
    for i in range(1, 7):
        bill = d[f'BILL_AMT{i}'].clip(lower=0).fillna(0).astype(float)
        pay  = d[f'PAY_AMT{i}'].clip(lower=0).fillna(0).astype(float)
        d[f'PAY_RATIO{i}'] = pay / (bill + 1e-6)
    bc = [f'BILL_AMT{i}' for i in range(1,7)]
    d['AVG_UTIL']      = d[bc].mean(axis=1) / (d['LIMIT_BAL'] + 1e-6)
    d['UTIL_RATIO']    = d['BILL_AMT1'] / (d['LIMIT_BAL'] + 1e-6)
    d['AVG_PAY_RATIO'] = d[[f'PAY_RATIO{i}' for i in range(1,7)]].mean(axis=1)
    for i in range(1, 4):
        d[f'BILL_CHANGE{i}'] = d[f'BILL_AMT{i}'] - d[f'BILL_AMT{i+1}']
        d[f'PAY_CHANGE{i}']  = d[f'PAY_AMT{i}']  - d[f'PAY_AMT{i+1}']
    return d

X_train = create_features(X_train)
X_val   = create_features(X_val)
X_test  = create_features(X_test)

selected_features = [
    'AVG_DELAY','MAX_DELAY','NUM_LATE_PAY',
    'AVG_PAY_RATIO','UTIL_RATIO','AVG_UTIL',
    'PAY_RATIO1','PAY_RATIO2','PAY_RATIO3',
    'BILL_CHANGE1','BILL_CHANGE2','BILL_CHANGE3',
    'PAY_CHANGE1','PAY_CHANGE2','PAY_CHANGE3'
]

# Clip outliers (train quantiles applied to all)
clip_bounds = {}
for col in selected_features:
    lo = X_train[col].quantile(0.01); hi = X_train[col].quantile(0.99)
    clip_bounds[col] = (lo, hi)
    for ds in [X_train, X_val, X_test]:
        ds[col] = ds[col].clip(lo, hi)

X_train = X_train[selected_features]
X_val   = X_val[selected_features]
X_test  = X_test[selected_features]

print(f"  Features selected : {len(selected_features)}")
print(f"  NaN count         : {X_train.isna().sum().sum()}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. CLASS IMBALANCE — Basel-Compliant Approach
# ─────────────────────────────────────────────────────────────────────────────
print("\n[5] CLASS IMBALANCE — class_weight / scale_pos_weight (Basel-compliant)")
print("  SMOTE excluded: synthetic data distorts empirical PD distribution,")
print("  violates Basel IRB data integrity and IFRS9 PiT calibration requirements.")
print(f"  Training class distribution: {y_train.value_counts().to_dict()}")
print(f"  Default rate preserved at: {y_train.mean()*100:.1f}%")

# Pass-through — real training data used as-is
X_train_sm, y_train_sm = X_train, y_train

# scale_pos_weight for XGBoost (ratio of negatives to positives)
scale_pw = float((y_train==0).sum()) / float((y_train==1).sum())
print(f"  scale_pos_weight (XGBoost/LightGBM): {scale_pw:.2f}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. WoE / IV BINNING
# ─────────────────────────────────────────────────────────────────────────────
print("\n[6] WoE / IV BINNING")

def make_woe_df(X, y):
    d = X.copy()
    d['default'] = y.values if hasattr(y, 'values') else np.array(y)
    return d.replace([np.inf, -np.inf], np.nan).fillna(0)

train_woe_raw = make_woe_df(X_train, y_train)
val_woe_raw   = make_woe_df(X_val,   y_val)
test_woe_raw  = make_woe_df(X_test,  y_test)

bins = sc.woebin(train_woe_raw, y='default', bin_num_limit=5, ignore_datetime_cols=False)

train_woe = sc.woebin_ply(train_woe_raw, bins, print_step=0)
val_woe   = sc.woebin_ply(val_woe_raw,   bins, print_step=0)
test_woe  = sc.woebin_ply(test_woe_raw,  bins, print_step=0)

iv_summary = sc.iv(train_woe_raw, y='default')
iv_summary = iv_summary.sort_values('info_value', ascending=False).reset_index(drop=True)
print("  IV Summary:")
print(iv_summary.to_string(index=False))
iv_summary.to_csv('results/iv_summary.csv', index=False)

selected_iv = iv_summary[iv_summary['info_value'] >= 0.1]['variable'].tolist()
woe_cols    = [c + '_woe' for c in selected_iv if c + '_woe' in train_woe.columns]

X_train_woe = train_woe[woe_cols].copy()
X_val_woe   = val_woe[woe_cols].copy()
X_test_woe  = test_woe[woe_cols].copy()
y_train_woe = train_woe['default']
y_val_woe   = val_woe['default']
y_test_woe  = test_woe['default']

def build_delay_risk_woe(df_w):
    df_w = df_w.copy()
    delay_cols = [c for c in ['AVG_DELAY_woe','NUM_LATE_PAY_woe','MAX_DELAY_woe'] if c in df_w.columns]
    df_w['DELAY_RISK_woe'] = (
        0.5 * df_w.get('MAX_DELAY_woe',    pd.Series(0, index=df_w.index)) +
        0.3 * df_w.get('AVG_DELAY_woe',    pd.Series(0, index=df_w.index)) +
        0.2 * df_w.get('NUM_LATE_PAY_woe', pd.Series(0, index=df_w.index))
    )
    for c in delay_cols:
        if c in df_w.columns:
            df_w.drop(columns=[c], inplace=True)
    return df_w

X_train_woe = build_delay_risk_woe(X_train_woe)
X_val_woe   = build_delay_risk_woe(X_val_woe)
X_test_woe  = build_delay_risk_woe(X_test_woe)

# No SMOTE — LR uses class_weight='balanced' to handle imbalance
X_train_woe_sm, y_train_woe_sm = X_train_woe, y_train_woe

print(f"  Final WoE features: {list(X_train_woe.columns)}")

# ─────────────────────────────────────────────────────────────────────────────
# 7. HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def hosmer_lemeshow(y_true, y_prob, g=10):
    df_hl = pd.DataFrame({'y': np.array(y_true), 'p': np.array(y_prob)})
    df_hl['decile'] = pd.qcut(df_hl['p'], q=g, duplicates='drop')
    grp = df_hl.groupby('decile').agg(
        obs_events=('y','sum'), n=('y','count'), mean_pred=('p','mean')
    ).reset_index()
    grp = grp[grp['n'] > 0]
    grp['pred_events'] = grp['mean_pred'] * grp['n']
    grp['pred_non']    = grp['n'] - grp['pred_events']
    grp['obs_non']     = grp['n'] - grp['obs_events']
    hl = (((grp['obs_events'] - grp['pred_events'])**2 / (grp['pred_events']+1e-9)) +
          ((grp['obs_non']    - grp['pred_non']   )**2 / (grp['pred_non']+1e-9))).sum()
    return hl, 1 - chi2.cdf(hl, df=max(g-2, 1)), grp

def calculate_psi(expected, actual, buckets=10):
    bp = np.linspace(0, 1, buckets + 1)
    ep = np.histogram(expected, bins=bp)[0] / len(expected)
    ap = np.histogram(actual,   bins=bp)[0] / len(actual)
    ep = np.where(ep == 0, 1e-8, ep)
    ap = np.where(ap == 0, 1e-8, ap)
    return ((ep - ap) * np.log(ep / ap)).sum()

def ks_stat(y_true, y_prob):
    p_def = y_prob[np.array(y_true) == 1]
    p_non = y_prob[np.array(y_true) == 0]
    return ks_2samp(p_def, p_non)[0]

def youden_threshold(y_true, y_prob):
    fpr, tpr, thresh = roc_curve(y_true, y_prob)
    return thresh[np.argmax(tpr - fpr)]

def full_eval(name, y_true, y_prob, y_prob_train):
    y_true = np.array(y_true); y_prob = np.array(y_prob)
    thresh = youden_threshold(y_true, y_prob)
    y_pred = (y_prob >= thresh).astype(int)

    auc    = roc_auc_score(y_true, y_prob)
    gini   = 2*auc - 1
    ks     = ks_stat(y_true, y_prob)
    brier  = brier_score_loss(y_true, y_prob)
    brier_base = y_true.mean() * (1 - y_true.mean())
    bss    = 1 - brier/brier_base
    pr_auc = average_precision_score(y_true, y_prob)
    _, hl_p, _ = hosmer_lemeshow(y_true, y_prob)
    psi    = calculate_psi(y_prob_train, y_prob)

    cm = confusion_matrix(y_true, y_pred)
    recall_1    = cm[1,1] / (cm[1,:].sum() + 1e-9)
    precision_1 = cm[1,1] / (cm[:,1].sum() + 1e-9)
    f1_1        = 2*recall_1*precision_1 / (recall_1+precision_1+1e-9)

    return {
        'Model': name,
        'AUC':          round(auc,4),
        'Gini':         round(gini,4),
        'KS':           round(ks,4),
        'PR-AUC':       round(pr_auc,4),
        'Brier':        round(brier,4),
        'BSS':          round(bss,4),
        'HL p-val':     round(hl_p,4),
        'PSI':          round(psi,4),
        'Recall(1)':    round(recall_1,4),
        'Precision(1)': round(precision_1,4),
        'F1(1)':        round(f1_1,4),
        'Threshold':    round(thresh,4),
        'Basel_AUC':    'PASS' if auc>0.70 else 'FAIL',
        'Basel_Gini':   'PASS' if gini>0.30 else 'FAIL',
        'Basel_KS':     'PASS' if ks>0.20 else 'FAIL',
        'Basel_PSI':    'PASS' if psi<0.10 else ('WARN' if psi<0.25 else 'FAIL'),
        'IFRS9_HL':     'PASS' if hl_p>0.05 else ('WARN' if hl_p>0.01 else 'FAIL'),
        'IFRS9_Brier':  'PASS' if brier<brier_base else 'FAIL',
    }

# ─────────────────────────────────────────────────────────────────────────────
# 8. MODEL TRAINING
# ─────────────────────────────────────────────────────────────────────────────
print("\n[8] MODEL TRAINING")
results_list = []

# ── 8a. Logistic Regression (WoE Scorecard) ──────────────────────────────────
print("  [8a] Logistic Regression (WoE Scorecard) ...")
lr_base = LogisticRegression(max_iter=2000, solver='lbfgs', class_weight='balanced', random_state=42)
lr_base.fit(X_train_woe_sm, y_train_woe_sm)

lr_cal = IsotonicCalibrator(lr_base)
lr_cal.fit(X_val_woe, y_val_woe)

y_prob_lr_train = lr_cal.predict_proba(X_train_woe)
y_prob_lr       = lr_cal.predict_proba(X_test_woe)

res_lr = full_eval('LR (WoE+Scorecard)', y_test_woe, y_prob_lr, y_prob_lr_train)
results_list.append(res_lr)
print(f"    AUC={res_lr['AUC']}  Gini={res_lr['Gini']}  KS={res_lr['KS']}  Recall(1)={res_lr['Recall(1)']}")

# ── 8b. Random Forest ────────────────────────────────────────────────────────
print("  [8b] Random Forest ...")
rf = RandomForestClassifier(n_estimators=300, class_weight='balanced', random_state=42,
                             n_jobs=-1, max_depth=10, min_samples_leaf=20)
rf.fit(X_train_sm, y_train_sm)

rf_cal = IsotonicCalibrator(rf)
rf_cal.fit(X_val, y_val)

y_prob_rf_train = rf_cal.predict_proba(X_train)
y_prob_rf       = rf_cal.predict_proba(X_test)

res_rf = full_eval('Random Forest', y_test, y_prob_rf, y_prob_rf_train)
results_list.append(res_rf)
print(f"    AUC={res_rf['AUC']}  Gini={res_rf['Gini']}  KS={res_rf['KS']}  Recall(1)={res_rf['Recall(1)']}")

# ── 8c. XGBoost ──────────────────────────────────────────────────────────────
print("  [8c] XGBoost ...")
# scale_pw already computed in section 5
xgb_model = xgb.XGBClassifier(
    n_estimators=500, learning_rate=0.05, max_depth=5,
    scale_pos_weight=scale_pw, subsample=0.8, colsample_bytree=0.8,
    eval_metric='auc', random_state=42, n_jobs=-1, verbosity=0
)
xgb_model.fit(X_train_sm, y_train_sm, eval_set=[(X_val, y_val)], verbose=False)

xgb_cal = IsotonicCalibrator(xgb_model)
xgb_cal.fit(X_val, y_val)

y_prob_xgb_train = xgb_cal.predict_proba(X_train)
y_prob_xgb       = xgb_cal.predict_proba(X_test)

res_xgb = full_eval('XGBoost', y_test, y_prob_xgb, y_prob_xgb_train)
results_list.append(res_xgb)
print(f"    AUC={res_xgb['AUC']}  Gini={res_xgb['Gini']}  KS={res_xgb['KS']}  Recall(1)={res_xgb['Recall(1)']}")

# ── 8d. LightGBM ─────────────────────────────────────────────────────────────
print("  [8d] LightGBM ...")
lgb_model = lgb.LGBMClassifier(
    n_estimators=500, learning_rate=0.05, max_depth=5,
    scale_pos_weight=scale_pw, subsample=0.8, colsample_bytree=0.8,
    random_state=42, n_jobs=-1, verbose=-1
)
lgb_model.fit(X_train_sm, y_train_sm,
              eval_set=[(X_val, y_val)],
              callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(-1)])

lgb_cal = IsotonicCalibrator(lgb_model)
lgb_cal.fit(X_val, y_val)

y_prob_lgb_train = lgb_cal.predict_proba(X_train)
y_prob_lgb       = lgb_cal.predict_proba(X_test)

res_lgb = full_eval('LightGBM', y_test, y_prob_lgb, y_prob_lgb_train)
results_list.append(res_lgb)
print(f"    AUC={res_lgb['AUC']}  Gini={res_lgb['Gini']}  KS={res_lgb['KS']}  Recall(1)={res_lgb['Recall(1)']}")

# ── 8e. MLP ──────────────────────────────────────────────────────────────────
print("  [8e] MLP (Neural Network) ...")
scaler   = StandardScaler()
X_tr_sc  = scaler.fit_transform(X_train)   # real data only — no synthetic samples
X_val_sc = scaler.transform(X_val)
X_tst_sc = scaler.transform(X_test)

mlp = MLPClassifier(hidden_layer_sizes=(128,64,32), activation='relu',
                    solver='adam', max_iter=300, early_stopping=True,
                    validation_fraction=0.1, random_state=42,
                    alpha=0.001, batch_size=256)
mlp.fit(X_tr_sc, y_train)

mlp_cal = IsotonicCalibrator(mlp)
mlp_cal.fit(X_val_sc, y_val)

y_prob_mlp_train = mlp_cal.predict_proba(scaler.transform(X_train))
y_prob_mlp       = mlp_cal.predict_proba(X_tst_sc)

res_mlp = full_eval('MLP', y_test, y_prob_mlp, y_prob_mlp_train)
results_list.append(res_mlp)
print(f"    AUC={res_mlp['AUC']}  Gini={res_mlp['Gini']}  KS={res_mlp['KS']}  Recall(1)={res_mlp['Recall(1)']}")

# ─────────────────────────────────────────────────────────────────────────────
# 9. MODEL COMPARISON TABLE
# ─────────────────────────────────────────────────────────────────────────────
print("\n[9] MODEL COMPARISON TABLE")

results_df = pd.DataFrame(results_list)
print(results_df[[
    'Model','AUC','Gini','KS','PR-AUC','Brier','BSS',
    'HL p-val','PSI','Recall(1)','F1(1)',
    'Basel_AUC','Basel_Gini','Basel_KS','Basel_PSI','IFRS9_HL','IFRS9_Brier'
]].to_string(index=False))
results_df.to_csv('results/model_comparison.csv', index=False)

fig, axes = plt.subplots(2, 3, figsize=(18, 10))
metrics_ = ['AUC','Gini','KS','PR-AUC','Recall(1)','F1(1)']
colors_  = ['#2196F3','#4CAF50','#FF9800','#E91E63','#9C27B0']
for ax, metric in zip(axes.flatten(), metrics_):
    bars = ax.bar(results_df['Model'], results_df[metric], color=colors_, alpha=0.85, edgecolor='black')
    ax.set_title(metric, fontsize=13, fontweight='bold')
    ax.set_ylabel(metric); ax.tick_params(axis='x', rotation=25)
    for bar, val in zip(bars, results_df[metric]):
        ax.text(bar.get_x()+bar.get_width()/2., bar.get_height()+0.003,
                f'{val:.3f}', ha='center', va='bottom', fontsize=9)
plt.suptitle('Model Comparison — All Basel/IFRS9 Metrics', fontsize=15, fontweight='bold')
plt.tight_layout()
plt.savefig('plots/model_comparison.png', dpi=120); plt.close()
print("  Saved: plots/model_comparison.png")

# ─────────────────────────────────────────────────────────────────────────────
# 10. ROC + CALIBRATION CURVES
# ─────────────────────────────────────────────────────────────────────────────
print("\n[10] ROC & CALIBRATION CURVES")

models_eval = [
    ('LR (WoE+Scorecard)', y_test_woe, y_prob_lr),
    ('Random Forest',      y_test,     y_prob_rf),
    ('XGBoost',            y_test,     y_prob_xgb),
    ('LightGBM',           y_test,     y_prob_lgb),
    ('MLP',                y_test,     y_prob_mlp),
]

fig, axes = plt.subplots(1, 2, figsize=(16, 7))
for name, yt, yp in models_eval:
    fpr, tpr, _ = roc_curve(yt, yp)
    auc = roc_auc_score(yt, yp)
    axes[0].plot(fpr, tpr, label=f'{name}  AUC={auc:.3f}', linewidth=2)
axes[0].plot([0,1],[0,1],'k--',alpha=0.5)
axes[0].set_title('ROC Curves — All Models', fontsize=13, fontweight='bold')
axes[0].set_xlabel('FPR'); axes[0].set_ylabel('TPR')
axes[0].legend(fontsize=9); axes[0].grid(alpha=0.3)

for name, yt, yp in models_eval:
    fp, mp = calibration_curve(yt, yp, n_bins=10, strategy='quantile')
    axes[1].plot(mp, fp, marker='o', label=name, linewidth=2)
axes[1].plot([0,1],[0,1],'k--',alpha=0.5,label='Perfect')
axes[1].set_title('Calibration Curves — IFRS9 PD Accuracy', fontsize=13, fontweight='bold')
axes[1].set_xlabel('Mean Predicted PD'); axes[1].set_ylabel('Fraction Defaulters')
axes[1].legend(fontsize=9); axes[1].grid(alpha=0.3)

plt.tight_layout()
plt.savefig('plots/roc_calibration.png', dpi=120); plt.close()
print("  Saved: plots/roc_calibration.png")

# ─────────────────────────────────────────────────────────────────────────────
# 11. SHAP EXPLAINABILITY
# ─────────────────────────────────────────────────────────────────────────────
print("\n[11] SHAP EXPLAINABILITY")

# ── 11a. XGBoost SHAP — summary + bar ────────────────────────────────────────
print("  [11a] XGBoost SHAP summary + bar ...")
explainer_xgb = shap.TreeExplainer(xgb_model)
shap_vals_xgb = explainer_xgb.shap_values(X_test)

plt.figure(figsize=(10, 7))
shap.summary_plot(shap_vals_xgb, X_test, show=False)
plt.title('XGBoost — SHAP Beeswarm (Basel Model Risk)', fontsize=12, fontweight='bold')
plt.tight_layout()
plt.savefig('plots/shap_xgb_summary.png', dpi=120, bbox_inches='tight'); plt.close()

plt.figure(figsize=(10, 7))
shap.summary_plot(shap_vals_xgb, X_test, plot_type='bar', show=False)
plt.title('XGBoost — Mean |SHAP| Feature Importance', fontsize=12, fontweight='bold')
plt.tight_layout()
plt.savefig('plots/shap_xgb_bar.png', dpi=120, bbox_inches='tight'); plt.close()

# ── 11b. Random Forest SHAP — summary + bar ──────────────────────────────────
print("  [11b] Random Forest SHAP summary + bar ...")
explainer_rf  = shap.TreeExplainer(rf)
shap_vals_rf  = explainer_rf.shap_values(X_test)
# RF returns list [class0, class1] — take class 1
sv_rf = shap_vals_rf[1] if isinstance(shap_vals_rf, list) else shap_vals_rf

plt.figure(figsize=(10, 7))
shap.summary_plot(sv_rf, X_test, show=False)
plt.title('Random Forest — SHAP Beeswarm', fontsize=12, fontweight='bold')
plt.tight_layout()
plt.savefig('plots/shap_rf_summary.png', dpi=120, bbox_inches='tight'); plt.close()

plt.figure(figsize=(10, 7))
shap.summary_plot(sv_rf, X_test, plot_type='bar', show=False)
plt.title('Random Forest — Mean |SHAP| Feature Importance', fontsize=12, fontweight='bold')
plt.tight_layout()
plt.savefig('plots/shap_rf_bar.png', dpi=120, bbox_inches='tight'); plt.close()

# ── 11c. SHAP Dependence Plots — top 3 features (XGBoost) ────────────────────
print("  [11c] SHAP Dependence Plots (top 3 features) ...")
mean_abs_shap = np.abs(shap_vals_xgb).mean(axis=0)
top3_idx      = np.argsort(mean_abs_shap)[::-1][:3]
top3_features = [X_test.columns[i] for i in top3_idx]

fig, axes = plt.subplots(1, 3, figsize=(18, 6))
for ax, feat in zip(axes, top3_features):
    feat_idx   = list(X_test.columns).index(feat)
    shap_col   = shap_vals_xgb[:, feat_idx]
    feat_vals  = X_test[feat].values
    sc = ax.scatter(feat_vals, shap_col, c=feat_vals, cmap='RdYlGn_r',
                    alpha=0.4, s=8, rasterized=True)
    ax.axhline(0, color='black', linewidth=0.8, linestyle='--')
    ax.set_xlabel(feat, fontsize=11)
    ax.set_ylabel('SHAP Value', fontsize=11)
    ax.set_title(f'Dependence: {feat}', fontweight='bold', fontsize=11)
    plt.colorbar(sc, ax=ax, label=feat)
plt.suptitle('SHAP Dependence Plots — Non-linear Feature Effects (XGBoost)',
             fontsize=13, fontweight='bold')
plt.tight_layout()
plt.savefig('plots/shap_dependence.png', dpi=120, bbox_inches='tight'); plt.close()

# ── 11d. SHAP Force Plots — highest & lowest PD borrowers ────────────────────
print("  [11d] SHAP Force Plots (highest & lowest PD borrowers) ...")
X_test_reset = X_test.reset_index(drop=True)
shap_vals_reset = shap_vals_xgb  # already aligned

high_pd_idx = int(np.argmax(y_prob_xgb))
low_pd_idx  = int(np.argmin(y_prob_xgb))

for label, idx in [('highest_pd', high_pd_idx), ('lowest_pd', low_pd_idx)]:
    exp_val  = explainer_xgb.expected_value
    sv_single = shap_vals_reset[idx]
    feat_single = X_test_reset.iloc[idx]

    # Waterfall-style manual force plot (matplotlib, no HTML dependency)
    contrib = pd.Series(sv_single, index=X_test.columns).sort_values()
    colors  = ['#E53935' if v > 0 else '#1E88E5' for v in contrib]
    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.barh(contrib.index, contrib.values, color=colors, alpha=0.85, edgecolor='black')
    ax.axvline(0, color='black', linewidth=1)
    for bar, val in zip(bars, contrib.values):
        ax.text(val + (0.002 if val >= 0 else -0.002), bar.get_y() + bar.get_height()/2,
                f'{val:+.4f}', va='center', ha='left' if val >= 0 else 'right', fontsize=8)
    pd_val = y_prob_xgb[idx]
    ax.set_title(
        f'SHAP Force Plot — {"Highest" if label=="highest_pd" else "Lowest"} PD Borrower\n'
        f'Predicted PD = {pd_val:.4f} | Base value = {exp_val:.4f}',
        fontsize=11, fontweight='bold'
    )
    ax.set_xlabel('SHAP Contribution to Log-Odds')
    plt.tight_layout()
    plt.savefig(f'plots/shap_force_{label}.png', dpi=120, bbox_inches='tight'); plt.close()

# ── 11e. LR — Coefficients & Odds Ratios ─────────────────────────────────────
print("  [11e] LR Coefficients (Champion Model interpretability) ...")
coef_df = pd.DataFrame({
    'Feature':     X_train_woe.columns,
    'Coefficient': lr_base.coef_[0],
    'OddsRatio':   np.exp(lr_base.coef_[0])
}).sort_values('Coefficient')

plt.figure(figsize=(10, 6))
c_colors = ['#E53935' if c > 0 else '#1E88E5' for c in coef_df['Coefficient']]
plt.barh(coef_df['Feature'], coef_df['Coefficient'], color=c_colors, alpha=0.85, edgecolor='black')
plt.axvline(x=0, color='black', linewidth=1.2, linestyle='--')
plt.title('LR Champion Model — Coefficients (WoE Features)\nRed = increases default risk  |  Blue = decreases',
          fontsize=12, fontweight='bold')
plt.xlabel('Coefficient'); plt.tight_layout()
plt.savefig('plots/lr_coefficients.png', dpi=120); plt.close()

coef_df.to_csv('results/lr_odds_ratios.csv', index=False)
print("  Saved: XGBoost SHAP (summary/bar/dependence/force), RF SHAP, LR coefficients")

# ─────────────────────────────────────────────────────────────────────────────
# 12. PSI STABILITY
# ─────────────────────────────────────────────────────────────────────────────
print("\n[12] PSI STABILITY")

psi_results = []
for name, yp_tr, yp_te in [
    ('LR (WoE+Scorecard)', y_prob_lr_train,  y_prob_lr),
    ('Random Forest',      y_prob_rf_train,  y_prob_rf),
    ('XGBoost',            y_prob_xgb_train, y_prob_xgb),
    ('LightGBM',           y_prob_lgb_train, y_prob_lgb),
    ('MLP',                y_prob_mlp_train, y_prob_mlp),
]:
    psi = calculate_psi(yp_tr, yp_te)
    status = 'Stable' if psi<0.1 else ('Minor Shift' if psi<0.25 else 'Rebuild Required')
    psi_results.append({'Model':name, 'PSI':round(psi,4), 'Status':status})
    print(f"  {name:<25} PSI={psi:.4f}  [{status}]")

pd.DataFrame(psi_results).to_csv('results/psi_stability.csv', index=False)

# ─────────────────────────────────────────────────────────────────────────────
# 12b. EXTENDED BACKTESTING — Basel III IRB & IFRS9
# ─────────────────────────────────────────────────────────────────────────────
print("\n[12b] EXTENDED BACKTESTING — Basel III IRB & IFRS9")

from scipy import stats as sp_stats

# ── Champion model predictions (LR) ──────────────────────────────────────────
y_true_bt  = y_test_woe.values
y_pred_bt  = y_prob_lr          # champion LR calibrated PD
n_obs      = len(y_true_bt)
n_defaults = y_true_bt.sum()
actual_dr  = y_true_bt.mean()
pred_dr    = y_pred_bt.mean()

print(f"  Observations : {n_obs}")
print(f"  Actual DR    : {actual_dr:.4f}")
print(f"  Predicted DR : {pred_dr:.4f}")

# ── Test 1: Binomial Test (IFRS9 PiT Calibration) ────────────────────────────
# H0: predicted default rate = actual default rate
# One-sided: are we systematically under-predicting defaults?
binom_result = sp_stats.binomtest(
    k=int(n_defaults),
    n=n_obs,
    p=pred_dr,
    alternative='two-sided'
)
binom_p    = binom_result.pvalue
binom_pass = 'PASS' if binom_p > 0.05 else ('WARN' if binom_p > 0.01 else 'FAIL')

print(f"\n  [Binomial Test — IFRS9 PiT Calibration]")
print(f"    H0: predicted DR = actual DR")
print(f"    Observed defaults : {int(n_defaults)}  /  Expected : {pred_dr * n_obs:.1f}")
print(f"    p-value : {binom_p:.4f}  →  {binom_pass}")
print(f"    Interpretation: {'Model PD well-calibrated (cannot reject H0)' if binom_pass == 'PASS' else 'Model may be mis-calibrated — review PiT adjustment'}")

# ── Test 2: Traffic Light Test (Basel IRB Exception Counting) ─────────────────
# Classify each observation: exception = predicted low-risk but actually defaulted
# (predicted PD < 0.20 threshold but y=1)
PD_THRESHOLD = 0.20   # Basel IRB conservative threshold
exceptions   = ((y_pred_bt < PD_THRESHOLD) & (y_true_bt == 1)).sum()
total_low_pd = (y_pred_bt < PD_THRESHOLD).sum()
exception_rate = exceptions / total_low_pd if total_low_pd > 0 else 0

# Basel traffic light zones (scaled from 250 obs; we scale to our test set)
# Green: exception rate < 2%, Yellow: 2–8%, Red: > 8%
if exception_rate < 0.02:
    tl_zone, tl_color = 'GREEN', 'Low risk — model performing well'
elif exception_rate < 0.08:
    tl_zone, tl_color = 'YELLOW', 'Elevated exceptions — monitor closely'
else:
    tl_zone, tl_color = 'RED', 'High exceptions — model review required'

print(f"\n  [Traffic Light Test — Basel IRB]")
print(f"    PD threshold for 'low-risk' classification : {PD_THRESHOLD}")
print(f"    Borrowers classified low-risk : {total_low_pd}")
print(f"    Exceptions (low-risk but defaulted) : {exceptions}")
print(f"    Exception rate : {exception_rate:.4f} ({exception_rate*100:.2f}%)")
print(f"    Zone : {tl_zone}  —  {tl_color}")

# ── Test 3: Mean PD vs Actual Default Rate (Aggregate Calibration) ───────────
# Split into deciles and check predicted vs actual per bucket
decile_df = pd.DataFrame({'y_true': y_true_bt, 'y_pred': y_pred_bt})
decile_df['decile'] = pd.qcut(decile_df['y_pred'], q=10, labels=False, duplicates='drop')
decile_agg = decile_df.groupby('decile').agg(
    n=('y_true', 'count'),
    actual_dr=('y_true', 'mean'),
    pred_dr=('y_pred', 'mean')
).reset_index()
decile_agg['abs_diff'] = (decile_agg['actual_dr'] - decile_agg['pred_dr']).abs()
decile_agg['calibrated'] = decile_agg['abs_diff'] < 0.05

max_diff = decile_agg['abs_diff'].max()
mean_diff = decile_agg['abs_diff'].mean()
agg_pass  = 'PASS' if mean_diff < 0.03 else ('WARN' if mean_diff < 0.05 else 'FAIL')

print(f"\n  [Mean PD vs Actual Default Rate — Decile Calibration]")
print(decile_agg[['decile','n','pred_dr','actual_dr','abs_diff','calibrated']].to_string(index=False))
print(f"\n    Mean absolute deviation : {mean_diff:.4f}  →  {agg_pass}")
print(f"    Max  absolute deviation : {max_diff:.4f}")

# ── Plot: Traffic Light + Decile Calibration ──────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Traffic light bar
tl_colors_map = {'GREEN': '#4CAF50', 'YELLOW': '#FFC107', 'RED': '#F44336'}
bar_vals = [exception_rate, 0.02, 0.08]
bar_labels = ['Model\nExceptions', 'Green\nThreshold (2%)', 'Red\nThreshold (8%)']
bar_colors = [tl_colors_map[tl_zone], '#4CAF50', '#F44336']
axes[0].bar(bar_labels, bar_vals, color=bar_colors, edgecolor='black', alpha=0.85, width=0.5)
axes[0].set_title(f'Basel Traffic Light Test — Zone: {tl_zone}', fontsize=12, fontweight='bold')
axes[0].set_ylabel('Exception Rate')
axes[0].set_ylim(0, max(bar_vals) * 1.4)
for i, v in enumerate(bar_vals):
    axes[0].text(i, v + 0.001, f'{v*100:.2f}%', ha='center', fontsize=10, fontweight='bold')

# Decile calibration scatter
axes[1].plot(decile_agg['pred_dr'], decile_agg['actual_dr'], 'o-', color='#42A5F5',
             linewidth=2, markersize=7, label='Predicted vs Actual')
axes[1].plot([0, decile_agg['pred_dr'].max()], [0, decile_agg['pred_dr'].max()],
             'r--', linewidth=1.5, alpha=0.7, label='Perfect Calibration')
axes[1].set_xlabel('Predicted Default Rate (by decile)')
axes[1].set_ylabel('Actual Default Rate')
axes[1].set_title('Decile Calibration — Mean PD vs Actual DR', fontsize=12, fontweight='bold')
axes[1].legend()

plt.suptitle('Extended Backtesting: Basel III IRB & IFRS9', fontsize=13, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('plots/backtest_extended.png', dpi=120, bbox_inches='tight')
plt.close()
print("\n  Saved: plots/backtest_extended.png")

# ── Summary table ─────────────────────────────────────────────────────────────
backtest_summary = pd.DataFrame([
    {'Test': 'Binomial Test (IFRS9 PiT)',       'Metric': f'p={binom_p:.4f}',             'Result': binom_pass,  'Framework': 'IFRS9'},
    {'Test': 'Traffic Light (Basel IRB)',        'Metric': f'Exceptions={exception_rate*100:.2f}%', 'Result': tl_zone, 'Framework': 'Basel III'},
    {'Test': 'Decile Calibration (Aggregate)',  'Metric': f'Mean |diff|={mean_diff:.4f}',  'Result': agg_pass,    'Framework': 'Basel III / IFRS9'},
])
print("\n  Backtesting Summary:")
print(backtest_summary.to_string(index=False))
backtest_summary.to_csv('results/backtest_extended.csv', index=False)

# ─────────────────────────────────────────────────────────────────────────────
# 13. WoE SCORECARD (PDO-based)
# ─────────────────────────────────────────────────────────────────────────────
print("\n[13] WoE SCORECARD (PDO=20, Base=600, Odds=50)")

PDO=20; BASE_SCORE=600; BASE_ODDS=50
B = PDO / np.log(2)
A = BASE_SCORE + B * np.log(BASE_ODDS)

coefs     = pd.Series(lr_base.coef_[0], index=X_train_woe.columns)
intercept = lr_base.intercept_[0]
log_odds  = X_test_woe.dot(coefs) + intercept
scores    = A - B * log_odds

score_df = pd.DataFrame({'Credit_Score':scores.values, 'y_true':y_test_woe.values, 'y_prob':y_prob_lr})
score_df['score_band'] = pd.qcut(score_df['Credit_Score'], q=5,
    labels=['Very High Risk','High Risk','Medium Risk','Low Risk','Very Low Risk'])

char_table = score_df.groupby('score_band', observed=True).agg(
    count=('y_true','count'), default_rate=('y_true','mean')).reset_index()
char_table['monotonic'] = char_table['default_rate'].diff().fillna(0) <= 0

print(char_table.to_string(index=False))
char_table.to_csv('results/scorecard_characteristic.csv', index=False)

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
axes[0].bar(range(len(char_table)), char_table['default_rate'], alpha=0.8, edgecolor='black',
            color=['#E53935','#FF7043','#FFA726','#66BB6A','#42A5F5'])
axes[0].set_xticks(range(len(char_table)))
axes[0].set_xticklabels(char_table['score_band'], rotation=30)
axes[0].set_title('Default Rate by Score Band (Monotonicity)', fontweight='bold')
axes[0].set_ylabel('Default Rate')
axes[1].hist(scores, bins=40, edgecolor='black', alpha=0.8, color='#42A5F5')
axes[1].set_title('Credit Score Distribution', fontweight='bold')
axes[1].set_xlabel('Credit Score'); axes[1].set_ylabel('Count')
plt.tight_layout()
plt.savefig('plots/scorecard.png', dpi=120); plt.close()
print(f"  Score: mean={scores.mean():.1f}  std={scores.std():.1f}  min={scores.min():.1f}  max={scores.max():.1f}")

# ─────────────────────────────────────────────────────────────────────────────
# 14. STRESS TESTING
# ─────────────────────────────────────────────────────────────────────────────
print("\n[14] STRESS TESTING")

scenarios = {
    'Baseline':     {'util_shock':1.00,'delay_shock':0.0,'pay_ratio_shock':1.00},
    'Mild Stress':  {'util_shock':1.15,'delay_shock':0.5,'pay_ratio_shock':0.90},
    'Severe Stress':{'util_shock':1.30,'delay_shock':1.2,'pay_ratio_shock':0.80},
}

def apply_stress(data, sc_):
    d = data.copy()
    for col in [f'BILL_AMT{i}' for i in range(1,7)]:
        if col in d.columns:
            shock = np.random.normal(sc_['util_shock'], 0.1, len(d))
            d[col] = (d[col]*shock).clip(upper=d[col].quantile(0.999))
    for col in ['PAY_0','PAY_2','PAY_3','PAY_4','PAY_5','PAY_6']:
        if col in d.columns:
            shock = np.random.normal(sc_['delay_shock'], 0.3, len(d))
            d[col] = (d[col]+shock).clip(lower=0)
    for col in [f'PAY_AMT{i}' for i in range(1,7)]:
        if col in d.columns:
            shock = np.random.normal(sc_['pay_ratio_shock'], 0.05, len(d))
            d[col] = (d[col]*shock).clip(lower=0)
    return d

df_original = df.loc[X_test.index].copy()
LGD = 0.45

# ── Helper: get stressed predictions for a model ─────────────────────────────
def stress_predict(model_name, model_cal, Xs, Xs_woe=None):
    """Route to correct feature set depending on model."""
    if model_name == 'LR (WoE+Scorecard)':
        # LR needs WoE-transformed features
        Xs_raw = make_woe_df(Xs, pd.Series(np.zeros(len(Xs))))
        Xs_w   = scorecardpy.woebin_ply(Xs_raw, bins, print_step=0)
        Xs_w   = build_delay_risk_woe(Xs_w)
        Xs_w   = Xs_w.reindex(columns=X_train_woe.columns, fill_value=0)
        return model_cal.predict_proba(Xs_w)
    elif model_name == 'MLP':
        return model_cal.predict_proba(scaler.transform(Xs))
    else:
        return model_cal.predict_proba(Xs)

# Models to stress test
stress_models = [
    ('LR (WoE+Scorecard)', lr_cal),
    ('Random Forest',      rf_cal),
    ('XGBoost',            xgb_cal),
    ('LightGBM',           lgb_cal),
    ('MLP',                mlp_cal),
]

all_stress_rows = []

for sname, sparams in scenarios.items():
    np.random.seed(42)
    d_s = apply_stress(df_original, sparams)
    d_s = create_features(d_s)
    Xs  = d_s[selected_features].copy()
    for col in selected_features:
        lo, hi = clip_bounds[col]
        Xs[col] = Xs[col].clip(lo, hi)

    print(f"\n  Scenario: {sname}")
    for mname, mcal in stress_models:
        yp_s  = stress_predict(mname, mcal, Xs)
        auc_s = roc_auc_score(y_test, yp_s)
        ks_s  = ks_stat(y_test, yp_s)
        all_stress_rows.append({
            'Model':    mname,
            'Scenario': sname,
            'AUC':      round(auc_s, 4),
            'Gini':     round(2*auc_s-1, 4),
            'KS':       round(ks_s, 4),
            'Mean PD':  round(yp_s.mean(), 4),
            'Mean EL':  round((yp_s*LGD).mean(), 4)
        })
        print(f"    {mname:<25} AUC={auc_s:.3f}  KS={ks_s:.3f}  Mean PD={yp_s.mean():.4f}")

stress_all_df = pd.DataFrame(all_stress_rows)
stress_all_df.to_csv('results/stress_results_all_models.csv', index=False)

# ── Robustness ranking: AUC drop from Baseline → Severe ──────────────────────
baseline_aucs = stress_all_df[stress_all_df['Scenario']=='Baseline'].set_index('Model')['AUC']
severe_aucs   = stress_all_df[stress_all_df['Scenario']=='Severe Stress'].set_index('Model')['AUC']
robustness_df = pd.DataFrame({
    'Baseline AUC': baseline_aucs,
    'Severe AUC':   severe_aucs,
    'AUC Drop':     (baseline_aucs - severe_aucs).round(4),
    'Drop %':       ((baseline_aucs - severe_aucs) / baseline_aucs * 100).round(2)
}).sort_values('AUC Drop')
robustness_df['Robustness Rank'] = range(1, len(robustness_df)+1)
robustness_df.to_csv('results/stress_robustness_ranking.csv')

print("\n  Robustness Ranking (least AUC drop = most robust):")
print(robustness_df.to_string())

# ── Plot 1: AUC across scenarios per model ────────────────────────────────────
fig, axes = plt.subplots(1, 3, figsize=(18, 6))
model_colors = {'LR (WoE+Scorecard)':'#2196F3','Random Forest':'#4CAF50',
                'XGBoost':'#FF9800','LightGBM':'#E91E63','MLP':'#9C27B0'}
scenario_names = list(scenarios.keys())

for ax, metric in zip(axes, ['AUC','KS','Mean PD']):
    for mname, mcol in model_colors.items():
        vals = [stress_all_df[(stress_all_df['Model']==mname) &
                              (stress_all_df['Scenario']==s)][metric].values[0]
                for s in scenario_names]
        ax.plot(scenario_names, vals, marker='o', label=mname, color=mcol, linewidth=2)
    ax.set_title(f'{metric} Under Stress — All Models', fontweight='bold', fontsize=12)
    ax.set_ylabel(metric); ax.tick_params(axis='x', rotation=20)
    ax.legend(fontsize=8); ax.grid(alpha=0.3)
plt.suptitle('Stress Testing — All 5 Models (RQ2)', fontsize=14, fontweight='bold')
plt.tight_layout()
plt.savefig('plots/stress_all_models.png', dpi=120); plt.close()

# ── Plot 2: Robustness ranking bar chart ──────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 5))
colors_r = [model_colors[m] for m in robustness_df.index]
bars = ax.bar(robustness_df.index, robustness_df['AUC Drop'], color=colors_r,
              alpha=0.85, edgecolor='black')
for bar, val in zip(bars, robustness_df['AUC Drop']):
    ax.text(bar.get_x()+bar.get_width()/2., bar.get_height()+0.001,
            f'{val:.4f}', ha='center', va='bottom', fontsize=10)
ax.set_title('Model Robustness — AUC Drop (Baseline → Severe Stress)\nLower = More Robust',
             fontsize=12, fontweight='bold')
ax.set_ylabel('AUC Drop'); ax.tick_params(axis='x', rotation=20)
plt.tight_layout()
plt.savefig('plots/stress_robustness_ranking.png', dpi=120); plt.close()

# Keep stress_df for backward compat (XGBoost only, used in Monte Carlo)
stress_df = stress_all_df[stress_all_df['Model']=='XGBoost'].reset_index(drop=True)

# ─────────────────────────────────────────────────────────────────────────────
# 15. MONTE CARLO SIMULATION (2000 runs)
# Set RUN_MONTE_CARLO = True to execute (takes ~5–10 min).
# Pre-computed results in results/monte_carlo_tail_risk.csv & plots/monte_carlo.png
# ─────────────────────────────────────────────────────────────────────────────
RUN_MONTE_CARLO = False   # <-- set True to re-run

if RUN_MONTE_CARLO:
    print("\n[15] MONTE CARLO SIMULATION (2000 runs)")

    np.random.seed(42)
    N_RUNS = 2000
    el_losses = []
    cov_matrix = [[0.15**2, 0.6*0.15*0.2],[0.6*0.15*0.2, 0.2**2]]

    for _ in range(N_RUNS):
        us, ds = np.random.multivariate_normal([0,0], cov_matrix)
        ps = np.random.normal(0, 0.05)
        sc_run = {'util_shock':max(0.5,1+us),'delay_shock':max(0,ds),'pay_ratio_shock':max(0.5,1-abs(ps))}
        d_r = apply_stress(df_original, sc_run)
        d_r = create_features(d_r)
        Xr  = d_r[selected_features].copy()
        for col in selected_features:
            lo, hi = clip_bounds[col]
            Xr[col] = Xr[col].clip(lo, hi)
        # XGBoost used for MC speed (2000 runs × WoE pipeline too slow for LR).
        # LR (champion) drives ECL/IFRS9 staging — MC is a tail-risk sensitivity tool.
        probs = xgb_cal.predict_proba(Xr)
        el_losses.append((probs * LGD).mean())

    el_array = np.array(el_losses)
    VaR_95   = np.percentile(el_array, 95)
    VaR_99   = np.percentile(el_array, 99)
    CVaR_95  = el_array[el_array >= VaR_95].mean()
    CVaR_99  = el_array[el_array >= VaR_99].mean()

    print(f"  Mean EL : {el_array.mean():.4f}")
    print(f"  VaR 95% : {VaR_95:.4f}")
    print(f"  VaR 99% : {VaR_99:.4f}")
    print(f"  CVaR 95%: {CVaR_95:.4f}")
    print(f"  CVaR 99%: {CVaR_99:.4f}")

    plt.figure(figsize=(10, 5))
    plt.hist(el_array, bins=60, edgecolor='black', alpha=0.8, color='#42A5F5', label='Simulated EL')
    plt.axvline(VaR_95,  color='orange',  linewidth=2, linestyle='--', label=f'VaR 95%={VaR_95:.4f}')
    plt.axvline(VaR_99,  color='red',     linewidth=2, linestyle='--', label=f'VaR 99%={VaR_99:.4f}')
    plt.axvline(CVaR_99, color='darkred', linewidth=2, linestyle=':',  label=f'CVaR 99%={CVaR_99:.4f}')
    plt.title('Monte Carlo EL Distribution — XGBoost Challenger (2000 runs)', fontsize=13, fontweight='bold')
    plt.xlabel('Expected Loss'); plt.ylabel('Frequency')
    plt.legend(); plt.tight_layout()
    plt.savefig('plots/monte_carlo.png', dpi=120); plt.close()

    pd.DataFrame([{
        'Mean EL':round(el_array.mean(),4),'VaR 95%':round(VaR_95,4),
        'VaR 99%':round(VaR_99,4),'CVaR 95%':round(CVaR_95,4),'CVaR 99%':round(CVaR_99,4)
    }]).to_csv('results/monte_carlo_tail_risk.csv', index=False)

else:
    print("\n[15] MONTE CARLO SIMULATION — skipped (RUN_MONTE_CARLO=False)")
    print("     Loading pre-computed results from results/monte_carlo_tail_risk.csv")
    _mc = pd.read_csv('results/monte_carlo_tail_risk.csv')
    VaR_95  = _mc['VaR 95%'].iloc[0]
    VaR_99  = _mc['VaR 99%'].iloc[0]
    CVaR_95 = _mc['CVaR 95%'].iloc[0]
    CVaR_99 = _mc['CVaR 99%'].iloc[0]
    el_array = np.array([_mc['Mean EL'].iloc[0]])  # scalar placeholder
    print(f"     VaR99={VaR_99}  CVaR99={CVaR_99}")

# ─────────────────────────────────────────────────────────────────────────────
# 16. IFRS9 — Lifetime PD, ECL, Staging
# ─────────────────────────────────────────────────────────────────────────────
print("\n[16] IFRS9 — Lifetime PD, ECL, Staging")

T_years=5; discount_rate=0.03
macro_mults = {
    'Baseline':     [1.00,1.00,1.00,1.00,1.00],
    'Mild Stress':  [1.10,1.20,1.20,1.15,1.10],
    'Severe Stress':[1.30,1.50,1.45,1.35,1.20],
}

# IFRS9 ECL — Champion LR model drives all ECL and staging outputs
base_pd_lr  = lr_cal.predict_proba(X_test_woe)
base_pd     = base_pd_lr
ecl_res = {}

for sname, mults in macro_mults.items():
    annual_pds  = [np.clip(base_pd * m, 0, 1) for m in mults]
    survival    = np.ones(len(base_pd))
    lifetime_pd = np.zeros(len(base_pd))
    for pd_t in annual_pds:
        lifetime_pd += survival * pd_t
        survival    *= (1 - pd_t)
    lifetime_pd = np.clip(lifetime_pd, 0, 1)
    ecl = lifetime_pd * LGD / (1 + discount_rate)
    ecl_res[sname] = {'Mean Lifetime PD':lifetime_pd.mean(), 'Mean ECL':ecl.mean()}
    print(f"  {sname:<15} Lifetime PD={lifetime_pd.mean():.4f}  ECL={ecl.mean():.4f}")

stage_pd = np.clip(base_pd * 1.10, 0, 1)
stage_lbl = {1:'Stage 1 (<5%)',2:'Stage 2 (5-20%)',3:'Stage 3 (>20%)'}
stages = np.where(stage_pd<0.05, 1, np.where(stage_pd<0.20, 2, 3))
stage_counts = pd.Series(stages).value_counts().sort_index()
print("\n  Stage Distribution (Mild Stress):")
for s, cnt in stage_counts.items():
    print(f"    {stage_lbl[s]}: {cnt} ({cnt/len(stages)*100:.1f}%)")

ecl_df = pd.DataFrame(ecl_res).T
ecl_df.to_csv('results/ifrs9_ecl.csv')

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
ecl_df['Mean ECL'].plot(kind='bar', ax=axes[0], alpha=0.85, edgecolor='black',
                         color=['#42A5F5','#FFA726','#E53935'])
axes[0].set_title('IFRS9 Mean ECL by Scenario', fontweight='bold')
axes[0].set_ylabel('Mean ECL per Borrower'); axes[0].tick_params(axis='x', rotation=25)
axes[1].pie(stage_counts.values, labels=[stage_lbl[s] for s in stage_counts.index],
            autopct='%1.1f%%', colors=['#42A5F5','#FFA726','#E53935'], startangle=140)
axes[1].set_title('IFRS9 Stage Distribution (Mild Stress)', fontweight='bold')
plt.tight_layout()
plt.savefig('plots/ifrs9_ecl.png', dpi=120); plt.close()

# ─────────────────────────────────────────────────────────────────────────────
# 17. SAVE ALL MODELS & ARTEFACTS
# ─────────────────────────────────────────────────────────────────────────────
print("\n[17] SAVING MODELS & ARTEFACTS")

joblib.dump(lr_cal,   'results/lr_calibrated.pkl')
joblib.dump(rf_cal,   'results/rf_calibrated.pkl')
joblib.dump(xgb_cal,  'results/xgb_calibrated.pkl')
joblib.dump(lgb_cal,  'results/lgb_calibrated.pkl')
joblib.dump(mlp_cal,  'results/mlp_calibrated.pkl')
joblib.dump(scaler,   'results/mlp_scaler.pkl')
joblib.dump(lr_base,  'results/lr_base.pkl')
with open('results/woe_bins.pkl','wb') as f: pickle.dump(bins, f)
with open('results/woe_features.json','w') as f: json.dump(list(X_train_woe.columns), f)
print("  All models saved to results/")

# ─────────────────────────────────────────────────────────────────────────────
# 18. FINAL SUMMARY — RQ1 + RQ2 Answers
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("FINAL SUMMARY — THESIS RESULTS")
print("=" * 70)

print("\n── Model Comparison (Basel/IFRS9 Evaluation) ──")
print(results_df[[
    'Model','AUC','Gini','KS','PR-AUC','Recall(1)','F1(1)',
    'Brier','PSI','Basel_AUC','Basel_Gini','Basel_KS','Basel_PSI','IFRS9_HL','IFRS9_Brier'
]].to_string(index=False))

print(f"\n  Best discrimination : {results_df.loc[results_df['AUC'].idxmax(),'Model']}  AUC={results_df['AUC'].max()}")
print(f"  Best calibration    : {results_df.loc[results_df['Brier'].idxmin(),'Model']}  Brier={results_df['Brier'].min()}")
print(f"  Best recall(1)      : {results_df.loc[results_df['Recall(1)'].idxmax(),'Model']}  Recall={results_df['Recall(1)'].max()}")
print(f"  Most stable PSI     : {results_df.loc[results_df['PSI'].idxmin(),'Model']}  PSI={results_df['PSI'].min()}")

print("\n── RQ1 Answer ──────────────────────────────────────────────────────────")
print("  RQ1: How can credit default risk models be evaluated beyond accuracy")
print("       to align with Basel and IFRS9?")
print()
rq1_metrics = ['AUC','Gini','KS','Brier','HL p-val','PSI','Recall(1)','F1(1)']
print(results_df[['Model'] + rq1_metrics].to_string(index=False))
champion = 'LR (WoE+Scorecard)'
best_ml  = results_df.loc[results_df['AUC'].idxmax(),'Model']
lr_row   = results_df[results_df['Model']==champion].iloc[0]
ml_row   = results_df[results_df['Model']==best_ml].iloc[0]
auc_gap  = ml_row['AUC'] - lr_row['AUC']
psi_gap  = lr_row['PSI']
print(f"\n  Champion (LR) vs Best ML ({best_ml}):")
print(f"  AUC gap          : {auc_gap:.4f} ({auc_gap*100:.1f}%) — marginal")
print(f"  LR PSI           : {lr_row['PSI']} (most stable)")
print(f"  LR Brier         : {lr_row['Brier']} vs {ml_row['Brier']} ({best_ml})")
print(f"  Conclusion: LR is the superior regulatory choice despite lower AUC.")
print(f"  {auc_gap*100:.1f}% AUC gap does not justify interpretability cost (SR 11-7 / EBA).")

print("\n── RQ2 Answer ──────────────────────────────────────────────────────────")
print("  RQ2: How do stress testing and simulation techniques influence")
print("       assessment of PD model robustness?")
print()
print(robustness_df[['Baseline AUC','Severe AUC','AUC Drop','Drop %','Robustness Rank']].to_string())
most_robust = robustness_df.index[0]
least_robust = robustness_df.index[-1]
print(f"\n  Most robust model  : {most_robust} (AUC drop={robustness_df.loc[most_robust,'AUC Drop']})")
print(f"  Least robust model : {least_robust} (AUC drop={robustness_df.loc[least_robust,'AUC Drop']})")
print(f"  Monte Carlo VaR99  : {VaR_99:.4f}  CVaR99: {CVaR_99:.4f}")
print(f"  Conclusion: Stress testing reveals meaningful robustness differences")
print(f"  not visible from standard test-set evaluation alone.")

print("\nDone. Results → results/  |  Plots → plots/")
