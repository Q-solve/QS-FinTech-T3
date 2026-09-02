#!/usr/bin/env python3
"""
================================================================================
Scaled Quantum Support Vector Machine (QSVM) Training Pipeline
Optimized for multi-core CPU instances on qBraid (e.g. 8 vCPU / 32 vCPU)
================================================================================
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
from sklearn.model_selection import train_test_split
from qiskit.circuit.library import zz_feature_map
from qiskit.quantum_info import Statevector

RANDOM_STATE = 42

def parse_args():
    parser = argparse.ArgumentParser(description="Scale QSVM to N_train=5,000 on CPU/qBraid")
    parser.add_argument("--n_train", type=int, default=5000, help="Training sample size (default: 5000)")
    parser.add_argument("--n_test", type=int, default=2000, help="Test sample size (default: 2000)")
    parser.add_argument("--data_path", type=str, default="model/data/processed_train_test.npz", help="Path to processed npz data")
    parser.add_argument("--output_dir", type=str, default="model/data", help="Output artifact directory")
    parser.add_argument("--n_jobs", type=int, default=-1, help="Parallel CPU workers (-1 for all cores)")
    return parser.parse_args()

def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    
    print("="*80)
    print("SCALED QUANTUM SUPPORT VECTOR MACHINE (QSVM) OPTIMIZED PIPELINE")
    print(f"Target Configuration: N_train = {args.n_train:,} | N_test = {args.n_test:,} | Workers: {args.n_jobs}")
    print("="*80)
    
    # 1. Load Preprocessed Data
    if not os.path.exists(args.data_path):
        alt_path = os.path.join(os.path.dirname(__file__), "data", "processed_train_test.npz")
        if os.path.exists(alt_path):
            args.data_path = alt_path
        else:
            raise FileNotFoundError(f"Processed dataset not found at {args.data_path}")
            
    print(f"\n[1/5] Loading preprocessed data from: {args.data_path}")
    data = np.load(args.data_path)
    X_train_full = data['X_train']
    X_test_full = data['X_test']
    y_train_full = data['y_train']
    y_test_full = data['y_test']
    
    # 2. Stratified Subsampling
    print(f"[2/5] Creating stratified subsamples (preserving fraud ratio)...")
    X_tr, _, y_tr, _ = train_test_split(
        X_train_full, y_train_full, train_size=args.n_train, stratify=y_train_full, random_state=RANDOM_STATE
    )
    X_te, _, y_te, _ = train_test_split(
        X_test_full, y_test_full, train_size=args.n_test, stratify=y_test_full, random_state=RANDOM_STATE
    )
    print(f"  Training Set: {X_tr.shape[0]:,} samples | Frauds: {y_tr.sum():,} ({y_tr.mean()*100:.2f}%)")
    print(f"  Testing Set:  {X_te.shape[0]:,} samples | Frauds: {y_te.sum():,} ({y_te.mean()*100:.2f}%)")
    
    # 3. Vectorized Statevector Computation Across All Cores
    print(f"\n[3/5] Computing quantum statevectors across CPU cores (Parallelized)...")
    fmap = zz_feature_map(feature_dimension=6, reps=1, entanglement='circular')
    print(f"  Quantum Circuit: Circular ZZ-Feature Map (6 Qubits, Depth {fmap.depth()}, 6 Parameters)")
    
    t0 = time.time()
    def compute_single_sv(x):
        return Statevector(fmap.assign_parameters(x)).data
        
    sv_train = Parallel(n_jobs=args.n_jobs, batch_size=200)(delayed(compute_single_sv)(x) for x in X_tr)
    sv_test = Parallel(n_jobs=args.n_jobs, batch_size=200)(delayed(compute_single_sv)(x) for x in X_te)
    
    V_tr = np.array(sv_train).T  # Shape: (64, N_train)
    V_te = np.array(sv_test).T   # Shape: (64, N_test)
    t_sv = time.time() - t0
    print(f"  [OK] Prepared {args.n_train + args.n_test:,} statevectors in {t_sv:.2f}s ({((args.n_train + args.n_test)/t_sv):.1f} states/sec)")
    
    # 4. Fast Vectorized BLAS Gram Matrix Computation
    print(f"\n[4/5] Computing Quantum Kernel Gram Matrices via Vectorized Inner Products...")
    t0 = time.time()
    K_train = np.abs(np.dot(V_tr.conj().T, V_tr))**2
    K_test = np.abs(np.dot(V_te.conj().T, V_tr))**2
    t_mat = time.time() - t0
    print(f"  [OK] Computed K_train ({K_train.shape}) and K_test ({K_test.shape}) in {t_mat:.3f}s!")
    print(f"  Matrix Memory Footprint: {(K_train.nbytes + K_test.nbytes)/1e6:.1f} MB (Extremely efficient)")
    
    # 5. Model Training & Evaluation (QSVM vs Classical RBF SVM)
    print(f"\n[5/5] Training QSVM and Classical RBF SVM...")
    
    # Train QSVM
    t0 = time.time()
    qsvm = SVC(kernel='precomputed', class_weight='balanced', probability=True, random_state=RANDOM_STATE)
    qsvm.fit(K_train, y_tr)
    t_qsvm_fit = time.time() - t0
    probs_qsvm = qsvm.predict_proba(K_test)[:, 1]
    preds_qsvm = qsvm.predict(K_test)
    
    # Train Classical RBF SVM on exact same partition
    t0 = time.time()
    rbf_svm = SVC(kernel='rbf', class_weight='balanced', probability=True, random_state=RANDOM_STATE)
    rbf_svm.fit(X_tr, y_tr)
    t_rbf_fit = time.time() - t0
    probs_rbf = rbf_svm.predict_proba(X_te)[:, 1]
    preds_rbf = rbf_svm.predict(X_te)
    
    results = [
        {
            'Model': f'QSVM (Circular ZZ-Map, N={args.n_train:,})',
            'PR-AUC': average_precision_score(y_te, probs_qsvm),
            'ROC-AUC': roc_auc_score(y_te, probs_qsvm),
            'F1-Score': f1_score(y_te, preds_qsvm),
            'Precision': precision_score(y_te, preds_qsvm),
            'Recall': recall_score(y_te, preds_qsvm),
            'Fit Time (s)': t_qsvm_fit,
            'Total Time (s)': t_sv + t_mat + t_qsvm_fit,
            'Support Vectors': len(qsvm.support_)
        },
        {
            'Model': f'Classical SVM (Gaussian RBF, N={args.n_train:,})',
            'PR-AUC': average_precision_score(y_te, probs_rbf),
            'ROC-AUC': roc_auc_score(y_te, probs_rbf),
            'F1-Score': f1_score(y_te, preds_rbf),
            'Precision': precision_score(y_te, preds_rbf),
            'Recall': recall_score(y_te, preds_rbf),
            'Fit Time (s)': t_rbf_fit,
            'Total Time (s)': t_rbf_fit,
            'Support Vectors': len(rbf_svm.support_)
        }
    ]
    results_df = pd.DataFrame(results)
    
    print("\n" + "="*95)
    print(f"BENCHMARK RESULTS AT SCALE (N_train = {args.n_train:,}, N_test = {args.n_test:,})")
    print("="*95)
    print(results_df[['Model', 'PR-AUC', 'F1-Score', 'Precision', 'Recall', 'Support Vectors', 'Total Time (s)']].to_string(index=False))
    
    cm_q = confusion_matrix(y_te, preds_qsvm)
    cm_c = confusion_matrix(y_te, preds_rbf)
    print("\nConfusion Matrix Breakdown:")
    print(f"  * QSVM:          Caught {cm_q[1,1]}/{cm_q[1,1]+cm_q[1,0]} frauds | Missed: {cm_q[1,0]} | False Alarms: {cm_q[0,1]}")
    print(f"  * Classical SVM: Caught {cm_c[1,1]}/{cm_c[1,1]+cm_c[1,0]} frauds | Missed: {cm_c[1,0]} | False Alarms: {cm_c[0,1]}")
    
    # Export CSV
    csv_out = os.path.join(args.output_dir, "qsvm_5k_benchmark_results.csv")
    results_df.to_csv(csv_out, index=False)
    print(f"\nSaved benchmark metrics to: {csv_out}")
    
    # Export Model Artifact (Cross-version portable dictionary)
    model_out = os.path.join(args.output_dir, "champion_qsvm_model_5k.joblib")
    joblib.dump({
        'model': qsvm,
        'feature_map_name': 'zz_circular',
        'feature_dimension': 6,
        'circuit_depth': fmap.depth(),
        'n_train': args.n_train,
        'support_vectors_count': len(qsvm.support_),
        'metrics': results[0]
    }, model_out)
    print(f"Saved serialized model artifact to: {model_out}")
    
    # Plot Visualizations
    fig, axes = plt.subplots(1, 2, figsize=(14, 5), dpi=120)
    
    # PR Curves
    rec_q, prec_q, _ = precision_recall_curve(y_te, probs_qsvm)
    rec_c, prec_c, _ = precision_recall_curve(y_te, probs_rbf)
    axes[0].plot(rec_q, prec_q, label=f"QSVM (PR-AUC = {results[0]['PR-AUC']:.4f})", color="#8B5CF6", linewidth=2.2)
    axes[0].plot(rec_c, prec_c, label=f"Classical SVM (PR-AUC = {results[1]['PR-AUC']:.4f})", color="#00B4D8", linewidth=2.2)
    axes[0].axhline(y_te.mean(), color='black', linestyle='--', alpha=0.4)
    axes[0].set_title(f"Precision-Recall Curves at Scale (N={args.n_train:,})", fontweight='bold')
    axes[0].set_xlabel("Recall (Fraud Coverage)")
    axes[0].set_ylabel("Precision")
    axes[0].legend(loc='upper right')
    axes[0].grid(True, alpha=0.3)
    
    # ROC Curves
    fpr_q, tpr_q, _ = roc_curve(y_te, probs_qsvm)
    fpr_c, tpr_c, _ = roc_curve(y_te, probs_rbf)
    axes[1].plot(fpr_q, tpr_q, label=f"QSVM (ROC-AUC = {results[0]['ROC-AUC']:.4f})", color="#8B5CF6", linewidth=2.2)
    axes[1].plot(fpr_c, tpr_c, label=f"Classical SVM (ROC-AUC = {results[1]['ROC-AUC']:.4f})", color="#00B4D8", linewidth=2.2)
    axes[1].plot([0, 1], [0, 1], 'k--', alpha=0.4)
    axes[1].set_title(f"ROC Curves at Scale (N={args.n_train:,})", fontweight='bold')
    axes[1].set_xlabel("False Positive Rate")
    axes[1].set_ylabel("True Positive Rate")
    axes[1].legend(loc='lower right')
    axes[1].grid(True, alpha=0.3)
    
    plot_out = os.path.join(args.output_dir, "qsvm_5k_diagnostic_plots.png")
    plt.tight_layout()
    plt.savefig(plot_out)
    print(f"Saved diagnostic plots to: {plot_out}")
    print("\n" + "="*80)
    print("ALL JOBS COMPLETE!")
    print("="*80)

if __name__ == "__main__":
    main()
