# Deploying FraudBusters → fraudbusters.boogiecoin.org

The site runs as a **Docker + Traefik** stack on the VPS. The stack is a FastAPI
backend (API + real model) and a React (Vite) frontend served by nginx, both
routed by Traefik for the hostname.

## How to reach the VPS

The VPS (`ubuntu@51.195.82.155:22022`) is not directly reachable from every
network. Reach it through the **homelab jump host** over Tailscale:

```bash
# labhouse = the "homelabboogie" Tailscale node
# from any Tailscale-connected host:
ssh -J root@100.79.181.102 -p 22022 -i ~/.ssh/boogie_vps ubuntu@51.195.82.155
```

Add to `~/.ssh/config` for a tidy `vps` alias through the jump:
```
Host labhouse
  HostName 100.79.181.102
  User root

Host vps
  HostName 51.195.82.155
  User ubuntu
  Port 22022
  IdentityFile ~/.ssh/boogie_vps
  ProxyJump labhouse
```
Then `ssh vps 'echo ok'`.

## Deploy (build + ship)

From the repo root (requires node + pnpm locally):
```bash
./deploy/deploy.sh vps
```
It:
1. builds `fraud-busters-web` → static bundle
2. ships the backend + model artifacts to `/opt/fraudbusters`
3. installs/restarts the Docker stack (see `deploy/fraudbusters-docker/`)

## Stack layout on the VPS (`/opt/fraudbusters`)

```text
/opt/fraudbusters
├── docker-compose.yml      # fraudbusters-api + fraudbusters-web on traefik-net
├── api/                    # FastAPI app + Dockerfile + model_data/*.joblib
└── web/
    ├── html/               # built React bundle (nginx)
    └── nginx.conf
```

Traefik routes:
- `Host(fraudbusters.boogiecoin.org)` → nginx (static app)
- `Host(fraudbusters.boogiecoin.org) && PathPrefix(/api)` → FastAPI

## Public DNS (Cloudflare)

`fraudbusters.boogiecoin.org` is proxied by Cloudflare. Ensure an **A record** for
`fraudbusters` points to the VPS origin (`51.195.82.155`) and the **SSL/TLS mode =
Full**, so Cloudflare forwards to Traefik.

## Verify

```bash
ssh vps "curl -sk https://127.0.0.1/ -H 'Host: fraudbusters.boogiecoin.org' | head -c 120"
curl -s https://fraudbusters.boogiecoin.org/api/v1/overview   # once DNS is set
```
