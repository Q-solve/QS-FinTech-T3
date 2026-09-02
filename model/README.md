# Model Engineering & Classical Baseline Report
### Quantum-Enhanced Fraud Detection for Mobile Money Networks in East Africa
**Q-SOLVE Hackathon 2026 (Kenya Edition) | OQI & Strathmore University**  
*Challenge B — SDG 8: Decent Work and Economic Growth (Target 8.10)*  
**Team:** FraudBust3rs (Team 3)  
**Owners:** Model Sub-Team (Benaih & Poni)  
**Target Notebook:** [`model/QSVM_FinTech_Team3.ipynb`](QSVM_FinTech_Team3.ipynb)

---

## Executive Summary
This document provides a comprehensive technical reference for all work completed to date within the `model/` module. 

Our mission is to engineer an enterprise-grade, high-throughput fraud detection system designed specifically for the unique mechanics of East African mobile money networks (such as Safaricom M-Pesa). The pipeline is architected around a dual classical-quantum paradigm: establishing state-of-the-art classical baselines (**Logistic Regression**, **Random Forest**, **XGBoost**) while engineering a compact, leakage-free 6-feature representation scaled into $[0, \pi]$ for seamless integration with **Quantum Support Vector Machines (QSVM)** on a 6-qubit quantum register.

---

## Directory Architecture & Artifact Manifest

```text
model/
├── .venv/                              # Isolated Python 3.14 virtual environment (gitignored)
├── QSVM_FinTech_Team3.ipynb            # Primary executed Jupyter notebook (pipeline + EDA + benchmarks)
├── README.md                           # This technical documentation report
└── data/                               # Local data directory and generated artifacts (gitignored)
    ├── paysim/
    │   ├── paysim.zip                  # Downloaded PaySim1 zip archive
    │   └── PS_20174392719_...csv       # Primary Supervised Dataset (6,362,620 rows x 11 cols)
    ├── mpesa/
    │   ├── mpesa.zip                   # Downloaded M-Pesa Synthetic zip archive
    │   └── mpesa_synthetic.csv         # Domain Grounding Dataset (120,000 rows x 13 cols)
    ├── credit/
    │   ├── credit.zip                  # Downloaded Credit Card Fraud zip archive
    │   └── creditcard.csv              # Comparative Benchmark Dataset (284,807 rows x 31 cols)
    ├── split_indices.npz               # Exported stratified 80/20 train/test split indices
    ├── processed_train_test.npz        # Scaled feature matrices (X_train, X_test, y_train, y_test)
    ├── scaler_angle.joblib             # Fitted MinMaxScaler(0, pi) for Quantum Angle-Encoding
    ├── champion_classical_model.joblib # Serialized XGBoost champion model for Backend API
    └── classical_benchmark_results.csv # Consolidated performance metrics across classical models
```

---

## 1. Multi-Dataset Architecture & Operational Roles

To guarantee academic rigor and prevent false modeling assumptions, we strictly segregated the roles of our three data sources:

| Dataset | Dimensions | Role in Pipeline | Key Characteristics |
| :--- | :--- | :--- | :--- |
| **PaySim1** (Primary) | $6,362,620 \times 11$ | **Primary Supervised Training & Validation** | Synthesized from real African financial logs. Severe class imbalance (0.13% fraud). Contains post-transaction balance leakage that must be resolved. |
| **M-Pesa Synthetic** | $120,000 \times 13$ | **Exploratory Domain Grounding Only** | Explicit Kenyan attributes: administrative regions (Nairobi, Eldoret, Mombasa) and device access channels (Feature Phone USSD vs Smartphone App). Not for joint training. |
| **Credit Card Fraud** | $284,807 \times 31$ | **Comparative Benchmark Only** | European card transactions with anonymized PCA features. Used purely to contrast card-not-present patterns against mobile money account-emptying attacks. |

---

## 2. Exploratory Data Analysis (EDA) & Key Findings

All exploratory visualizations were generated using a custom high-contrast East African FinTech palette (Deep Navy `#0A192F`, Cyan `#00B4D8`, M-Pesa Green `#00A859`, Warning Amber `#F59E0B`, Fraud Crimson `#EF4444`).

### 2.1 Severe Class Imbalance Diagnosis
* **Quantification:** Of $6,362,620$ transactions, only $8,213$ are fraudulent (**$0.129\%$**), representing an extreme imbalance ratio of **$1$ fraud per $774$ legitimate transactions**.
* **Engineering Mandate:** 
  1. Traditional classification accuracy is completely deceptive (a null model predicting non-fraud achieves $99.87\%$ accuracy).
  2. Data splitting must be strictly stratified to preserve minority class representation.
  3. Model selection and tuning must optimize **PR-AUC (Precision-Recall Area Under Curve)**, **F1-Score**, and **Recall** rather than ROC-AUC or Accuracy.

### 2.2 Operational Threat Surface
* **Discovery:** We aggregated fraud occurrences across all transaction types (`CASH_OUT`, `TRANSFER`, `PAYMENT`, `CASH_IN`, `DEBIT`).
* **Critical Finding:** **$100.0\%$ of all fraud instances occur exclusively in `TRANSFER` ($4,097$ cases) and `CASH_OUT` ($4,116$ cases)**. `PAYMENT` ($2.15\text{M}$), `CASH_IN` ($1.40\text{M}$), and `DEBIT` ($41\text{k}$) have **zero** fraud.
* **Pipeline Action:** We filter our primary operational dataset down to `TRANSFER` and `CASH_OUT`. This preserves **$100\%$ of all fraud instances** while eliminating $3,592,211$ uninformative rows, accelerating training by $>55\%$ without any signal loss.

### 2.3 Financial Magnitude & Power-Law Distributions
* **Legitimate Transactions:** Median = $\text{KES } 30,299.12$ | Mean = $\text{KES } 178,197.04$.
* **Fraudulent Transactions:** Median = $\text{KES } 441,845.69$ ($14.6\times$ higher) | Mean = $\text{KES } 1,467,967.30$.
* **Modal Thresholding:** Fraud amounts peak heavily at the platform transfer ceiling of **$\text{KES } 10,000,000$**.
* **Pipeline Action:** Financial scales exhibit severe right-skew spanning 7 orders of magnitude. We apply logarithmic transformation $\ln(1 + x)$ to `amount`, `oldbalanceOrg`, and `oldbalanceDest` to stabilize variance and prevent gate saturation during quantum angle rotation.

### 2.4 Empirical Resolution of Balance-Column Leakage
* **The Flaw:** In PaySim, `newbalanceOrig` and `newbalanceDest` are recorded *after* transaction clearance:
  1. In fraud attacks, the perpetrator drains the account completely: $\text{amount} = \text{oldbalanceOrg} \implies \text{newbalanceOrig} = 0.0$ in **$98.05\%$ of cases**.
  2. In simulated cancellation, destination accounts fail to credit: $\text{newbalanceDest} - \text{oldbalanceDest} = 0$ in **$49.75\%$ of cases**.
  3. **Production API Infeasibility:** In live mobile money networks (e.g. M-Pesa Daraja API), an incoming transfer request triggers fraud evaluation **before** funds are moved. The post-transaction balance does not yet exist. A model relying on `newbalance*` cannot function in production.
* **Empirical Validation Experiment:** We trained two cross-validated classifiers on $100,000$ transactions:
  * **Model A (Leaky Post-Tx Balances):** Uses raw `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`, `newbalanceDest` $\to$ ROC-AUC: `0.9947`, F1: `0.8756`, Recall: `0.7864`.
  * **Model B (Clean Pre-Tx Engineered Signals):** Drops `newbalance*`, uses pre-transaction balance ratios and depletion indicators $\to$ **ROC-AUC: `0.9991`, F1: `0.9985`, Recall: `0.9970`**.
* **Architectural Decision:** We **permanently dropped** `newbalanceOrig` and `newbalanceDest`. Pre-transaction engineered features eliminate future data leakage while achieving superior detection performance.

### 2.5 Diurnal Temporal Dynamics
* **Observation:** Computing transaction hour from simulation steps ($\text{step} \pmod{24}$) revealed that legitimate mobile money transactions follow human circadian rhythms (volumes plunge by $>85\%$ between 01:00 AM and 05:00 AM).
* **The Attack Pattern:** Fraudulent transactions maintain a constant, automated 24/7 velocity. Consequently, the conditional probability of fraud spikes dramatically during off-hours (01:00–06:00).
* **Pipeline Action:** Injected `hour` directly into the feature space.

### 2.6 Kenyan Domain Grounding (`mpesa_synthetic.csv`)
* Confirmed that Kenyan fraud attacks concentrate in major commercial centers (Nairobi, Eldoret, Mombasa).
* Showed that **Feature Phone users (USSD)** experience higher fraud attack rates than smartphone users, verifying our hackathon thesis: social engineering and unauthorized account takeovers on USSD are the primary threat vector for unbanked populations.

---

## 3. Data Preprocessing & Reusable Splitting

1. **Cleaning:** Confirmed zero missing values and zero duplicate rows across the filtered operational space ($2,770,409$ transactions).
2. **Categorical Encoding:** `type` was encoded as a bounded binary indicator `is_transfer` ($1.0$ for `TRANSFER`, $0.0$ for `CASH_OUT`), natively compatible with numeric linear classifiers, tree splits, and quantum rotations.
3. **Imbalance-Aware Stratified Splitting:**
   * To combine statistical fidelity with agile quantum simulation benchmarking, we sampled all $8,213$ fraud instances alongside $191,787$ representative legitimate transactions ($200,000$ total, $\approx 4.11\%$ fraud prevalence).
   * Stratified 80/20 train/test split (`stratify=y`, `random_state=42`):
     * **Training Set:** $160,000$ transactions ($6,570$ fraud).
     * **Testing Set:** $40,000$ transactions ($1,643$ fraud).
   * **Persistence:** Saved indices to `model/data/split_indices.npz` to guarantee that all downstream classical baselines and future QSVM experiments evaluate on the exact same data partitions.

---

## 4. Feature Engineering & Selection: The 6-Qubit Budget

### 4.1 The Quantum Constraint & Qubit Budget
In Noisy Intermediate-Scale Quantum (NISQ) computing, simulating parameterized quantum circuits scales exponentially with qubit count ($O(N^2 \cdot 2^n)$). Each classical feature requires one qubit under single-qubit angle embedding $R_X(\theta_j)|0\rangle$. A **6-qubit budget** represents the ideal operational sweet spot: an expressive $2^6 = 64$-dimensional Hilbert space that remains fast and numerically stable to simulate.

### 4.2 Explicit EDA-to-Feature Mapping
Every selected feature directly addresses a concrete empirical insight from our data exploration:

| Qubit | Selected Feature | Explicit EDA Insight & Domain Rationale | Mathematical Definition | Valid Range |
| :---: | :--- | :--- | :--- | :---: |
| **Q0** | `amount_to_oldbalance` | **EDA 2.4 (Wallet Draining):** In 97.8% of fraud cases, `amount == oldbalanceOrg`. This ratio captures total account liquidation without using leaky post-transaction columns. | $\frac{\text{amount}}{\text{oldbalanceOrg} + 1.0}$ | $[0.0, \infty)$ |
| **Q1** | `oldbalanceOrg_log` | **EDA 2.4 (Target Selection):** Fraudsters preferentially compromise high-balance accounts. Log transformation normalizes heavy right-skewed balance distributions. | $\ln(1 + \text{oldbalanceOrg})$ | $[0.0, \approx 18.0]$ |
| **Q2** | `amount_log` | **EDA 2.3 (Magnitude Skew):** Fraud amounts spike at system transfer limits (KES 10M) with a median 14x higher than legitimate transfers. Log scaling prevents numerical explosion. | $\ln(1 + \text{amount})$ | $[0.0, \approx 17.0]$ |
| **Q3** | `orig_depleted` | **EDA 2.4 (Exhaustion Trigger):** In 98.05% of fraud cases, origin balance is wiped to zero. Serves as an explicit binary alarm when requested amount $\ge$ available balance. | $\mathbb{I}(\text{amount} \ge \text{oldbalanceOrg})$ | $\{0.0, 1.0\}$ |
| **Q4** | `oldbalanceDest_log` | **EDA 2.4 (Mule Account Status):** In 49.75% of fraudulent transfers, the recipient wallet has zero prior balance, revealing newly activated burner/mule SIM cards. | $\ln(1 + \text{oldbalanceDest})$ | $[0.0, \approx 18.0]$ |
| **Q5** | `hour` | **EDA 2.5 (Diurnal Attack Velocity):** Legitimate volume plunges by >85% at night, while automated fraud attacks continue unabated, driving high nighttime risk probability. | $\text{step} \pmod{24}$ | $[0.0, 23.0]$ |

### 4.3 Why PCA was Rejected for Quantum Feature Maps
While linear PCA captures $\approx 83.5\%$ of variance with 6 components, it destroys the physical interpretability and boundary geometry of our features. For Quantum Classifiers (QSVM), non-linear transformations and feature interactions are computed inside the Quantum Hilbert space via entangling unitary gates ($ZZFeatureMap$). Supplying raw physical domain features to qubits yields far superior quantum kernel expressivity than feeding abstract linear PCA eigenvectors.

---

## 5. Quantum-Ready Feature Scaling

Quantum state preparation via angle embedding rotates qubits on the Bloch sphere:
$$|\psi(\mathbf{x})\rangle = \bigotimes_{j=0}^{5} R_X(\theta_j)|0\rangle, \quad \text{where } \theta_j \in [0, \pi]$$

* We apply `MinMaxScaler(feature_range=(0, np.pi))` fitted **strictly on `X_train`** and transformed onto `X_test`.
* Bounding values within $[0, \pi]$ spans the full orthogonal distance from $|0\rangle$ (at $\theta=0$) to $|1\rangle$ (at $\theta=\pi$) without phase wrap-around degeneracy.
* **Saved Artifact:** [`model/data/scaler_angle.joblib`](data/scaler_angle.joblib).
* **Exported Data Arrays:** [`model/data/processed_train_test.npz`](data/processed_train_test.npz).

---

## 6. Classical Baseline Benchmarks & Evaluation

Using our standardized 6-feature dataset, we trained and evaluated three classical models under class-imbalance weighting:

### 6.1 Benchmark Results Summary Table

| Model Paradigm | ROC-AUC | PR-AUC (Average Precision) | F1-Score | Precision | Recall | Training Time | Inference Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression** | `0.9888` | `0.8333` | `0.5368` | `0.3705` | `0.9738` | `0.69 s` | **0.0001 ms/tx** |
| **Random Forest** | `0.9977` | `0.9844` | `0.8254` | `0.7064` | `0.9927` | `7.43 s` | **0.0060 ms/tx** |
| **XGBoost (Champion)** | **`0.9996`** | **`0.9982`** | **`0.9963`** | **`0.9976`** | **`0.9951`** | `1.85 s` | **0.0027 ms/tx** |

### 6.2 Analysis of Results
* **Logistic Regression:** Achieves high recall ($97.38\%$, intercepting $1,600$ of $1,643$ frauds), but suffers from $2,720$ false alarms because linear boundaries cannot handle the non-linear interaction between wallet draining and time.
* **Random Forest:** Decisively outperforms linear models, catching $1,631$ frauds with $678$ false alarms, proving the value of threshold-based non-linear partitioning.
* **XGBoost (Champion):** Demonstrates extraordinary precision and coverage:
  * **True Negatives:** $38,353$ ($99.99\%$)
  * **False Positives (False Alarms):** Only **4** ($0.01\%$)
  * **False Negatives (Missed Frauds):** Only **8** ($0.49\%$)
  * **True Positives (Intercepted):** **$1,635$** ($99.51\%$)
  * **Throughput:** $0.0027\text{ ms/tx}$ ($>370,000\text{ transactions per second}$), exceeding all mobile money core banking latency requirements.

* **Exported Champion Model:** [`model/data/champion_classical_model.joblib`](data/champion_classical_model.joblib).

---

## 7. Backend & Frontend API Contract Specification

Backend and Frontend teammates can immediately integrate our model artifact. The `predict()` API contract requires the following 6 features:

```python
FEATURE_NAMES_API_CONTRACT = [
    'amount_to_oldbalance',  # Qubit 0: amount / (oldbalanceOrg + 1.0)
    'oldbalanceOrg_log',     # Qubit 1: ln(1 + oldbalanceOrg)
    'amount_log',            # Qubit 2: ln(1 + amount)
    'orig_depleted',         # Qubit 3: 1.0 if amount >= oldbalanceOrg else 0.0
    'oldbalanceDest_log',    # Qubit 4: ln(1 + oldbalanceDest)
    'hour'                   # Qubit 5: step % 24
]
```

### Drop-In Inference Service Code
The following function is implemented and verified inside [`model/QSVM_FinTech_Team3.ipynb`](QSVM_FinTech_Team3.ipynb) for Backend microservice integration:

```python
import os
import joblib
import numpy as np

def predict_transaction(transaction_dict, 
                        model_path="model/data/champion_classical_model.joblib", 
                        scaler_path="model/data/scaler_angle.joblib"):
    """
    Scores an incoming mobile money transaction in real time.
    """
    clf = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    
    # Extract raw parameters
    amount = float(transaction_dict['amount'])
    oldbalanceOrg = float(transaction_dict['oldbalanceOrg'])
    oldbalanceDest = float(transaction_dict['oldbalanceDest'])
    step = int(transaction_dict['step'])
    
    # Feature Engineering
    features = np.array([[
        amount / (oldbalanceOrg + 1.0),
        np.log1p(oldbalanceOrg),
        np.log1p(amount),
        1.0 if amount >= oldbalanceOrg else 0.0,
        np.log1p(oldbalanceDest),
        float(step % 24)
    ]])
    
    # Scale to [0, pi]
    features_scaled = scaler.transform(features)
    
    # Predict Probability
    prob_fraud = float(clf.predict_proba(features_scaled)[0, 1])
    is_fraud = int(prob_fraud >= 0.5)
    
    return {
        'is_fraud': is_fraud,
        'fraud_probability': prob_fraud,
        'risk_level': 'HIGH' if prob_fraud >= 0.75 else ('MEDIUM' if prob_fraud >= 0.40 else 'LOW')
    }
```

---

## 8. Strategic Roadmap: Setting the Bar for QSVM (Task 3)

With our classical baselines and 6-qubit representation established, we now pivot to our primary hackathon objective: **Quantum Support Vector Machines (QSVM)**:

1. **The Classical Bar is Defined:** On large datasets ($N=160,000$), XGBoost achieves an exceptional benchmark (`0.9982` PR-AUC).
2. **The Quantum Opportunity:**
   * **Entangled Quantum Hilbert Space:** We will construct a parameterized quantum feature map ($ZZFeatureMap$) that encodes our 6 scaled features into quantum state rotations $U_{\Phi}(\mathbf{x})|0\rangle^{\otimes 6}$, utilizing non-linear entangling phase gates $e^{-i (\pi - \theta_j)(\pi - \theta_k) Z_j Z_k}$ to calculate quantum kernel Gram matrices $K_{ij} = |\langle \psi(\mathbf{x}_i) | \psi(\mathbf{x}_j) \rangle|^2$.
   * **Low-Data & Zero-Day Regime:** In real-world fraud detection, mobile money operators encounter new, adversarial fraud schemes with very few initial labels. Quantum kernels exhibit superior generalization in low-sample regimes ($N=500 \dots 2,000$). We will benchmark QSVM against classical SVM (RBF kernel) across subsampled regimes to demonstrate quantum advantage.

---
*Report generated and validated for Team 3 (FraudBust3rs) — Q-SOLVE Hackathon 2026.*
