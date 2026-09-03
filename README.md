# 🛡️ FraudBusters — Quantum-Enhanced Fraud Detection

**Q-SOLVE Hackathon 2026 (Kenya) · Challenge B · Team 3 (FraudBust3rs)**

Detecting mobile-money fraud in East Africa with a hybrid Quantum Machine Learning
approach. A quantum kernel + classical SVM (QSVM) scores transactions in real time,
benchmarked honestly against strong classical baselines.

---

## 🌐 Live demo (judges)

> **https://fraudbusters.boogiecoin.org/**
>
> - **App:** interactive Fraud Busters dashboard (overview, live analysis, benchmarks, demo)
> - **API:** `https://fraudbusters.boogiecoin.org/api/v1/overview` → live model status
> - **Model:** `qsvm-fraud-classifier` · `system_status: ready` · `execution_mode: live`

---

## What this repo contains

| Area | Path | Docs |
|---|---|---|
| **Frontend** (React + Vite + Tailwind, vibrant dark theme) | `frontend/artifacts/fraud-busters-web` | `frontend/README.md` |
| **Backend** (FastAPI, real-model inference) | `backend/fraud-backend` | `backend/fraud-backend/README.md` |
| **Model** (classical + QSVM, full benchmark report) | `model/` | `model/README.md` |
| **Deploy** (Docker + Traefik, one-command) | `deploy/` | `deploy/README.md` |

## Live API contract (what the frontend consumes)

- `GET /api/healthz` → health + model readiness
- `GET /api/v1/overview` → system posture
- `GET /api/v1/model-config` → active model feature schema
- `POST /api/v1/analyze` → score a transaction
- `GET /api/v1/benchmarks` → QSVM vs classical benchmark table

## Run it locally

```bash
# backend (real model)
cd backend/fraud-backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/fraud-busters-web dev
# open http://localhost:5173  (the frontend proxies /api -> :8000)
```

## Stack
Python 3.12 · FastAPI · Qiskit/QSVM · scikit-learn · XGBoost · React 19 · Vite ·
Tailwind · Radix UI · Docker · Traefik · Cloudflare

---

*Synthetic, anonymized transaction data only. Model output supports analyst
judgment — it does not make a guilt determination.*
