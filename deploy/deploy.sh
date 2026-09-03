#!/usr/bin/env bash
# Deploy FraudBusters (backend + React frontend) to the VPS -> fraudbusters.boogiecoin.org
#
# Run from a machine that can reach `ssh vps` (e.g. your own terminal):
#   ./deploy/deploy.sh
#
# Requires locally: bash, node, pnpm, rsync. On VPS: python3-venv, nginx/caddy (or run behind).
set -euo pipefail

HOST="${1:-vps}"
APP_DIR="/opt/fraudbusters"
export PATH="$(npm prefix -g)/bin:$PATH"
cd "$(dirname "$0")/.."

echo "==> 1/5 Build the React frontend (fraud-busters-web)"
cd frontend
pnpm install >/dev/null 2>&1 || true
pnpm --filter @workspace/fraud-busters-web build 2>&1 | tail -5 || { echo "build failed (PORT/BASE_PATH?)"; }
cd ..

echo "==> 2/5 Sync backend to ${HOST}:${APP_DIR}"
ssh -o BatchMode=yes -o ConnectTimeout=20 "$HOST" "mkdir -p ${APP_DIR}"
rsync -az --delete --exclude '.venv' --exclude '__pycache__' --exclude '*.pyc' \
  ./backend/fraud-backend/ "${HOST}:${APP_DIR}/backend/"
rsync -az ./frontend/artifacts/fraud-busters-web/dist/public/ "${HOST}:${APP_DIR}/frontend/"
# ship real model artifacts (gitignored, needed for real scoring)
rsync -az ./model/data/champion_classical_model.joblib ./model/data/scaler_angle.joblib \
  "${HOST}:${APP_DIR}/backend/model_data/" 2>/dev/null || echo "  (no artifacts -> fallback)"

echo "==> 3/5 Set up backend venv + deps"
ssh -o BatchMode=yes "$HOST" "cd ${APP_DIR}/backend && python3 -m venv .venv && .venv/bin/pip install -q -U pip && .venv/bin/pip install -q -r requirements.txt"

echo "==> 4/5 Install systemd service (backend on 127.0.0.1:8000)"
ssh -o BatchMode=yes "$HOST" "cat > /tmp/fraudbusters.service" << 'SERVICE'
[Unit]
Description=FraudBusters API
After=network.target
[Service]
WorkingDirectory=/opt/fraudbusters/backend
Environment=MODEL_DATA_DIR=/opt/fraudbusters/backend/model_data
Environment=FRAUD_MODEL_NAME=qsvm-fraud-classifier
ExecStart=/opt/fraudbusters/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
SERVICE
ssh -o BatchMode=yes "$HOST" "sudo mv /tmp/fraudbusters.service /etc/systemd/system/fraudbusters.service && sudo systemctl daemon-reload && sudo systemctl enable --now fraudbusters"

echo "==> 5/5 Reverse proxy note"
echo "Serve the built frontend from ${APP_DIR}/frontend and proxy /api -> 127.0.0.1:8000"
echo "Caddy: fraudbusters.boogiecoin.org { root * /opt/fraudbusters/frontend; reverse_proxy /api/* 127.0.0.1:8000; try_files {path} /index.html }"
echo "Verify: curl -s https://fraudbusters.boogiecoin.org/api/v1/overview"
