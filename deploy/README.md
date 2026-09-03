# Deploy FraudBusters → fraudbusters.boogiecoin.org

The stack is a **FastAPI backend** + a **React (Vite) frontend**. Deployment does a
local production build, then pushes both to the VPS behind a reverse proxy.

## Why run it from YOUR machine
`ssh vps` (`51.195.82.155:22022`) is **not reachable from the sandbox network**
(connection times out — the VPS firewall likely allows only your IP). So run the
deploy from a terminal that can reach the VPS.

## 1. Confirm SSH works from your machine
```bash
ssh vps 'echo ok'
```
If this fails, you're on a network the VPS blocks. Open the SSH port for your IP,
or run from home.

## 2. Deploy (one command, from the repo root)
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh vps
```
It:
1. builds `fraud-busters-web` → static bundle
2. rsyncs backend + frontend + model artifacts to `/opt/fraudbusters`
3. installs a `fraudbusters` systemd service (API on `127.0.0.1:8000`)

## 3. Reverse proxy (Caddy/nginx) for the subdomain
Serve the built `frontend/` statically and proxy `/api` to the backend. Caddy:
```
fraudbusters.boogiecoin.org {
    root * /opt/fraudbusters/frontend
    reverse_proxy /api/* http://127.0.0.1:8000
    try_files {path} /index.html
}
```

## 4. Verify
```bash
curl -s https://fraudbusters.boogiecoin.org/api/v1/overview   # -> system_status ready
# open https://fraudbusters.boogiecoin.org/  (React app, real data)
```
