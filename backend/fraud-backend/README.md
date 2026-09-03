# FraudBusters API — Backend

FastAPI backend that scores mobile-money transactions with the **real trained
model** and serves the frontend's API contract. Part of QS-FinTech-T3 (Challenge B,
Team 3).

## Run locally

```bash
cd backend/fraud-backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for the interactive API.

## Frontend contract endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/healthz` | health + `model_ready` |
| `GET /api/v1/overview` | system posture + primary model |
| `GET /api/v1/model-config` | active model feature schema |
| `POST /api/v1/analyze` | score a transaction → `AnalyzeResponse` |
| `GET /api/v1/benchmarks` | QSVM vs classical benchmark table |

## Raw scoring endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health` | service availability |
| `GET /api/v1/models/active` | active model metadata + readiness |
| `POST /api/v1/fraud/score` | score one transaction |
| `POST /api/v1/fraud/score/batch` | score up to 1,000 transactions |
| `POST /api/v1/fraud/feedback` | accept confirmed labels for evaluation |

## Real-model wiring

- `app/services/ml_predictor.py` loads **`champion_classical_model.joblib`** +
  **`scaler_angle.joblib`** from `MODEL_DATA_DIR` (default `model/data/` at the repo
  root) and maps raw fields → the 6-qubit feature contract (`amount_to_oldbalance`,
  `oldbalanceOrg_log`, `amount_log`, `orig_depleted`, `oldbalanceDest_log`, `hour`).
- `app/services/fraud_scoring.py` uses the model when it is available; otherwise it
  **falls back** to a deterministic rule scorer so the API always boots.
- `app/services/contract_service.py` builds the frontend responses (overview,
  model-config, analyze, benchmarks) from the live model + measured benchmark data.
- Schemas matching the generated React client are in `app/schemas/contract.py`.

### Model status

- `GET /api/v1/models/active` → `status: "ready"` when the artifacts are present,
  `"fallback"` otherwise.
- `GET /api/v1/overview` → `system_status`/`execution_mode` reflect the same.

## Env vars

| Var | Default | Notes |
|---|---|---|
| `MODEL_DATA_DIR` | `../model/data` | where the `.joblib` artifacts live |
| `FRAUD_APP_NAME` | `FraudBusters API` | |
| `FRAUD_API_PREFIX` | `/api/v1` | |
| `FRAUD_CORS_ORIGINS` | `localhost:3000,5173,5174,8778` | comma-separated |
| `FRAUD_MODEL_NAME` | `qsvm-fraud-classifier` | returned as `model_used` |

## Notes for teammates

- The scorer/contract layers are isolated, so swapping in the ML sub-team's PaySim
  champion artifacts (same filenames in `model/data/`) is a drop-in change.
- Requests/responses follow `app/schemas/` and the generated frontend client, so the
  dashboard and API stay in sync.
