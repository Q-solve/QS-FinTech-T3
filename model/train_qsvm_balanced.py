#!/usr/bin/env python3
"""
================================================================================
Balanced All-Fraud Quantum Support Vector Machine (QSVM) Pipeline
Optimized exclusively for execution on qBraid multi-core CPU instances (8/32 vCPU)
================================================================================
Incorporates ALL 8,213 fraud cases from PaySim with a 50:50 balanced legitimate sample:
  * N_train = 13,140 (6,570 Fraud + 6,570 Legit)
  * N_test  =  3,286 (1,643 Fraud + 1,643 Legit)
  * Total   = 16,426 transactions (100% of PaySim fraud cases)
"""

import os
import sys
import time
import argparse
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from joblib import Parallel, delayed
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_curve,
    precision_recall_curve,
    confusion_matrix
)
from qiskit.circuit.library import zz_feature_map
from qiskit.quantum_info import Statevector

RANDOM_STATE = 42

def parse_args():
    parser = argparse.ArgumentParser(description="Run 50:50 Balanced QSVM on qBraid with ALL Frauds")
    parser.add_argument("--all_frauds", action="store_true", default=True, help="Include ALL 8,213 frauds (13,140 train / 3,286 test)")
    parser.add_argument("--n_train", type=int, default=None, help="Custom balanced train size (e.g. 8000 for 4k fraud + 4k legit)")
    parser.add_argument("--n_test", type=int, default=None, help="Custom balanced test size (e.g. 2000 for 1k fraud + 1k legit)")
    parser.add_argument("--data_path", type=str, default="model/data/processed_train_test.npz", help="Path to processed npz data")
    parser.add_argument("--output_dir", type=str, default="model/data", help="Output artifact directory")
    parser.add_argument("--n_jobs", type=int, default=-1, help="Parallel CPU workers (-1 for all vCPU cores)")
    return parser.parse_args()

def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    
    print("="*85)
    print("BALANCED ALL-FRAUD QUANTUM SUPPORT VECTOR MACHINE (QSVM) PIPELINE")
    print("Execution Target: qBraid Multi-Core Cloud Environment")
    print("="*85)
    
    # 1. Load Data
    if not os.path.exists(args.data_path):
        alt_path = os.path.join(os.path.dirname(__file__), "data", "processed_train_test.npz")
        if os.path.exists(alt_path):
            args.data_path = alt_path
        else:
            raise FileNotFoundError(f"Processed dataset not found at {args.data_path}")
            
    print(f"[1/5] Loading preprocessed data from: {args.data_path}")
    data = np.load(args.data_path)
    X_tr_full = data['X_train']
    X_te_full = data['X_test']
    y_tr_full = data['y_train']
    y_te_full = data['y_test']
    
    # 2. Construct 50:50 Balanced Dataset (Incorporating ALL Fraud Instances)
    print(f"\n[2/5] Constructing 50:50 Balanced Dataset...")
    np.random.seed(RANDOM_STATE)
    
    # Identify indices
    tr_fraud_idx = np.where(y_tr_full == 1)[0]
    tr_legit_idx = np.where(y_tr_full == 0)[0]
    te_fraud_idx = np.where(y_te_full == 1)[0]
    te_legit_idx = np.where(y_te_full == 0)[0]
    
    if args.n_train is not None and args.n_test is not None:
        # Custom balanced sizing
        n_tr_per_class = args.n_train // 2
        n_te_per_class = args.n_test // 2
        
        sel_tr_fraud = np.random.choice(tr_fraud_idx, size=n_tr_per_class, replace=False)
        sel_tr_legit = np.random.choice(tr_legit_idx, size=n_tr_per_class, replace=False)
        sel_te_fraud = np.random.choice(te_fraud_idx, size=n_te_per_class, replace=False)
        sel_te_legit = np.random.choice(te_legit_idx, size=n_te_per_class, replace=False)
    else:
        # ALL Frauds mode: 6,570 fraud in train, 1,643 fraud in test
        n_tr_per_class = len(tr_fraud_idx)
        n_te_per_class = len(te_fraud_idx)
        
        sel_tr_fraud = tr_fraud_idx
        sel_tr_legit = np.random.choice(tr_legit_idx, size=n_tr_per_class, replace=False)
        sel_te_fraud = te_fraud_idx
        sel_te_legit = np.random.choice(te_legit_idx, size=n_te_per_class, replace=False)
        
    train_indices = np.concatenate([sel_tr_fraud, sel_tr_legit])
    test_indices = np.concatenate([sel_te_fraud, sel_te_legit])
    np.random.shuffle(train_indices)
    np.random.shuffle(test_indices)
    
    X_tr = X_tr_full[train_indices]
    y_tr = y_tr_full[train_indices]
    X_te = X_te_full[test_indices]
    y_te = y_te_full[test_indices]
    
    n_total_fraud = (y_tr == 1).sum() + (y_te == 1).sum()
    print(f"  * Training Set: {len(X_tr):,} samples ({y_tr.sum():,} Fraud [50.0%] + {(y_tr == 0).sum():,} Legit [50.0%])")
    print(f"  * Testing Set:  {len(X_te):,} samples ({y_te.sum():,} Fraud [50.0%] + {(y_te == 0).sum():,} Legit [50.0%])")
    print(f"  * Total Fraud Incorporated: {n_total_fraud:,} / 8,213 ({n_total_fraud / 8213 * 100:.1f}% of PaySim)")
    
    # 3. Vectorized Statevector Computation in Parallel Across All vCPUs
    print(f"\n[3/5] Generating quantum statevectors across vCPU cores (Parallelized)...")
    fmap = zz_feature_map(feature_dimension=6, reps=1, entanglement='circular')
    print(f"  Circuit Topology: Circular ZZ-Feature Map (6 Qubits, Depth {fmap.depth()}, 6 Parameters)")
    
    t0 = time.time()
    def compute_single_sv(x):
        return Statevector(fmap.assign_parameters(x)).data
        
    sv_train = Parallel(n_jobs=args.n_jobs, batch_size=200)(delayed(compute_single_sv)(x) for x in X_tr)
    sv_test = Parallel(n_jobs=args.n_jobs, batch_size=200)(delayed(compute_single_sv)(x) for x in X_te)
    
    V_tr = np.array(sv_train).T  # Shape: (64, N_train)
    V_te = np.array(sv_test).T   # Shape: (64, N_test)
    t_sv = time.time() - t0
    total_states = len(X_tr) + len(X_te)
    print(f"  [OK] Prepared {total_states:,} statevectors in {t_sv:.2f}s ({total_states / t_sv:.1f} states/sec)")
    
    # 4. Fast Vectorized BLAS Gram Matrix Computation
    print(f"\n[4/5] Computing Quantum Kernel Gram Matrices via Vectorized BLAS...")
    t0 = time.time()
    # K_train = |V_tr^dagger V_tr|^2
    K_train = np.abs(np.dot(V_tr.conj().T, V_tr))**2
    # K_test  = |V_te^dagger V_tr|^2
    K_test = np.abs(np.dot(V_te.conj().T, V_tr))**2
    t_mat = time.time() - t0
    total_ram_mb = (K_train.nbytes + K_test.nbytes) / 1e6
    print(f"  [OK] Computed K_train {K_train.shape} and K_test {K_test.shape} in {t_mat:.3f}s!")
    print(f"  Matrix RAM Consumption: {total_ram_mb:.1f} MB (Well within instance memory)")
    
    # 5. Benchmarking: QSVM vs Classical Baselines on Balanced Dataset
    print(f"\n[5/5] Fitting Models and Evaluating on Balanced Test Set...")
    models = {
        'QSVM (Circular ZZ-Map)': (
            SVC(kernel='precomputed', probability=True, random_state=RANDOM_STATE),
            K_train, K_test
        ),
        'Classical SVM (Gaussian RBF)': (
            SVC(kernel='rbf', probability=True, random_state=RANDOM_STATE),
            X_tr, X_te
        ),
        'Classical Random Forest': (
            RandomForestClassifier(n_estimators=100, max_depth=8, random_state=RANDOM_STATE, n_jobs=args.n_jobs),
            X_tr, X_te
        )
    }
    
    benchmark_records = []
    probabilities_dict = {}
    predictions_dict = {}
    
    for name, (model, X_tr_m, X_te_m) in models.items():
        t_start = time.time()
        model.fit(X_tr_m, y_tr)
        t_fit = time.time() - t_start
        
        t_start = time.time()
        probs = model.predict_proba(X_te_m)[:, 1]
        preds = model.predict(X_te_m)
        t_inf = time.time() - t_start
        
        probabilities_dict[name] = probs
        predictions_dict[name] = preds
        
        roc_auc = roc_auc_score(y_te, probs)
        pr_auc = average_precision_score(y_te, probs)
        f1 = f1_score(y_te, preds)
        prec = precision_score(y_te, preds)
        rec = recall_score(y_te, preds)
        cm = confusion_matrix(y_te, preds)
        
        sv_count = len(model.support_) if hasattr(model, 'support_') else 'N/A'
        
        benchmark_records.append({
            'Model': name,
            'PR-AUC': pr_auc,
            'ROC-AUC': roc_auc,
            'F1-Score': f1,
            'Precision': prec,
            'Recall': rec,
            'Fit Time (s)': t_fit,
            'Inference Time (s)': t_inf,
            'Support Vectors': sv_count,
            'False Alarms (FP)': cm[0, 1],
            'Missed Fraud (FN)': cm[1, 0],
            'Caught Fraud (TP)': cm[1, 1]
        })
        print(f"  * {name:30s} | PR-AUC: {pr_auc:.4f} | F1: {f1:.4f} | Prec: {prec:.4f} | Rec: {rec:.4f} | Fit: {t_fit:.2f}s")
        
    results_df = pd.DataFrame(benchmark_records)
    
    print("\n" + "="*95)
    print(f"FINAL 50:50 BALANCED BENCHMARK RESULTS (N_train={len(X_tr):,}, N_test={len(X_te):,})")
    print("="*95)
    cols = ['Model', 'PR-AUC', 'ROC-AUC', 'F1-Score', 'Precision', 'Recall', 'False Alarms (FP)', 'Caught Fraud (TP)', 'Fit Time (s)']
    print(results_df[cols].to_string(index=False))
    
    # Export CSV
    csv_out = os.path.join(args.output_dir, "qsvm_balanced_benchmark_results.csv")
    results_df.to_csv(csv_out, index=False)
    print(f"\nSaved benchmark metrics to: {csv_out}")
    
    # Export Serialized Champion QSVM Model Artifact
    qsvm_model = models['QSVM (Circular ZZ-Map)'][0]
    model_out = os.path.join(args.output_dir, "champion_qsvm_model_balanced.joblib")
    joblib.dump({
        'model': qsvm_model,
        'feature_map_name': 'zz_circular',
        'feature_dimension': 6,
        'circuit_depth': fmap.depth(),
        'n_train': len(X_tr),
        'n_test': len(X_te),
        'support_vectors_count': len(qsvm_model.support_),
        'metrics': benchmark_records[0]
    }, model_out)
    print(f"Saved serialized model artifact to: {model_out}")
    
    # Generate Comparison Plots
    fig, axes = plt.subplots(1, 3, figsize=(18, 5), dpi=120)
    palette = {'QSVM (Circular ZZ-Map)': '#8B5CF6', 'Classical SVM (Gaussian RBF)': '#00B4D8', 'Classical Random Forest': '#10B981'}
    
    # 1. Precision-Recall Curves
    for name, probs in probabilities_dict.items():
        rec_c, prec_c, _ = precision_recall_curve(y_te, probs)
        axes[0].plot(rec_c, prec_c, label=f"{name.split('(')[0]} (PR-AUC = {average_precision_score(y_te, probs):.3f})",
                     color=palette[name], linewidth=2.0)
    axes[0].axhline(0.5, color='black', linestyle='--', alpha=0.4, label='Balanced Baseline (0.50)')
    axes[0].set_title(f"PR Curves on 50:50 Balanced Data (N={len(X_tr):,})", fontweight='bold')
    axes[0].set_xlabel("Recall (Fraud Coverage)")
    axes[0].set_ylabel("Precision")
    axes[0].legend(loc='lower left', fontsize=9)
    axes[0].grid(True, alpha=0.3)
    
    # 2. ROC Curves
    for name, probs in probabilities_dict.items():
        fpr_c, tpr_c, _ = roc_curve(y_te, probs)
        axes[1].plot(fpr_c, tpr_c, label=f"{name.split('(')[0]} (ROC-AUC = {roc_auc_score(y_te, probs):.3f})",
                     color=palette[name], linewidth=2.0)
    axes[1].plot([0, 1], [0, 1], 'k--', alpha=0.4)
    axes[1].set_title("ROC Curves on 50:50 Balanced Data", fontweight='bold')
    axes[1].set_xlabel("False Positive Rate")
    axes[1].set_ylabel("True Positive Rate")
    axes[1].legend(loc='lower right', fontsize=9)
    axes[1].grid(True, alpha=0.3)
    
    # 3. Confusion Matrix of Champion QSVM
    cm_qsvm = confusion_matrix(y_te, predictions_dict['QSVM (Circular ZZ-Map)'])
    cm_norm = cm_qsvm.astype('float') / cm_qsvm.sum(axis=1)[:, np.newaxis]
    annot_text = np.empty_like(cm_qsvm).astype(str)
    for i in range(2):
        for j in range(2):
            annot_text[i, j] = f"{cm_qsvm[i, j]:,}\n({cm_norm[i, j]*100:.1f}%)"
            
    sns.heatmap(cm_qsvm, annot=annot_text, fmt='', cmap='Purples', cbar=False, ax=axes[2],
                xticklabels=['Pred Legit', 'Pred Fraud'], yticklabels=['Actual Legit', 'Actual Fraud'])
    axes[2].set_title("Champion QSVM Confusion Matrix (Balanced)", fontweight='bold')
    axes[2].set_xlabel("Predicted Label")
    axes[2].set_ylabel("Actual Label")
    
    plt.suptitle("50:50 Balanced Fraud Detection Benchmark (qBraid Run)", fontsize=15, fontweight='bold', y=1.03)
    plt.tight_layout()
    plot_out = os.path.join(args.output_dir, "qsvm_balanced_diagnostic_plots.png")
    plt.savefig(plot_out)
    print(f"Saved diagnostic plots to: {plot_out}")
    print("\n" + "="*85)
    print(f"ALL BALANCED EXPERIMENTS COMPLETED IN {time.time() - t0:.2f}s!")
    print("="*85)

if __name__ == "__main__":
    main()
