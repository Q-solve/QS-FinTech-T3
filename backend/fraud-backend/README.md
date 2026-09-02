# FraudBusters API

## Run locally

```bash
cd backend/fraud-backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` for the interactive API contract.

## Route structure

- `GET /api/v1/health` checks service availability.
- `GET /api/v1/models/active` exposes the active model metadata.
- `POST /api/v1/fraud/score` scores one mobile-money transaction.
- `POST /api/v1/fraud/score/batch` scores up to 1,000 transactions.
- `POST /api/v1/fraud/feedback` accepts confirmed fraud labels for evaluation.

The scorer is intentionally isolated in `app/services/fraud_scoring.py`. Replace its
`score` implementation with the serialized QSVM inference call after training on
PaySim; keep the request and response contracts stable for the frontend.