# FraudBusters Forensic Console

A modern, dark security-operations dashboard wired to the **FraudBusters API**.
Live transaction scoring, model status, QSVM-vs-classical benchmark charts, and a
batch scored-cases table.

## Run it (one command)

The console is served directly by the backend at **`/console`**:

```bash
cd backend/fraud-backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000/console/**

- API docs: `http://localhost:8000/docs`
- Root `/` lists the available endpoints.

## Alternative (standalone, if you don't mount it on the backend)
```bash
cd frontend/forensic-dashboard
python3 -m http.server 8778
# open http://localhost:8778/index.html
```
Change the API host if your backend is remote:
```js
localStorage.setItem('fb_api', 'https://YOUR_HOST')   // run once in the console
```

## What it shows
- **Live model status** — `READY` when real model artifacts are in `model/data/`,
  else `FALLBACK` (rule-based).
- **Live transaction scorer** — POSTs to `/api/v1/fraud/score`, renders a risk
  gauge + verdict + risk factors.
- **Model evidence charts** — QSVM vs classical F1 / precision / false alarms and
  the N=5k→16k scaling results (from `model/README.md`).
- **Scored cases table** — batch via `/api/v1/fraud/score/batch`.

## To activate the REAL model
Drop the ML sub-team's artifacts into `QS-FinTech-T3/model/data/`:
- `champion_classical_model.joblib`
- `scaler_angle.joblib`

The backend (`app/services/ml_predictor.py`) loads them automatically and serves
real probabilities (feature contract: the 6-qubit budget — see `model/README.md` §3).
