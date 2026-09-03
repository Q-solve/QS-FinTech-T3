# FraudBusters — Frontend
Quantum Fraud Detection for Mobile Money Networks in East Africa. Deploying quantum machine learning to detect real-time fraud patterns (SIM swaps, unauthorized transactions).

## 🌐 Live
**https://fraudbusters.boogiecoin.org/** — Fraud Busters dashboard (real model, live data).

## Run locally
```bash
pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/fraud-busters-web dev
# backend on :8000 provides the API (the dev proxy forwards /api -> :8000)
```
