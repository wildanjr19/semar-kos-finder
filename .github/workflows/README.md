# GitHub Actions Workflows

## Workflows

| File | Trigger | Deploy Target | Method |
|------|---------|---------------|--------|
| `staging.yml` | Push to `staging` branch + manual | Staging VPS | Docker Compose |
| `deploy.yml` | Push to `main` branch | Production VPS | PM2 (legacy) |

---

## `staging.yml` — Docker-based Staging Deploy

### 1. Create GitHub Environment

Go to **Settings → Environments → New environment** and name it `staging`.

### 2. Add Environment Secrets

In the `staging` environment, add these secrets under **Environment secrets**:

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | VPS IP address or hostname |
| `SSH_USER` | SSH username (e.g. `ubuntu`) |
| `SSH_KEY` | Private SSH key (pem format, full content) |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key for geocoding |
| `JWT_SECRET` | Secret key for JWT signing |
| `ADMIN_PASSWORD_BCRYPT` | Bcrypt-hashed admin password |

### 3. Add Environment Variables

In the `staging` environment, add these under **Variables** (not Secrets):

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_DIR` | `/opt/semar-kos-staging` | Deploy path on VPS (where `compose.yaml` lives). Must be absolute — `~` won't expand |
| `WEB_PORT` | `3003` | Host port for staging web frontend |
| `BACKEND_PORT` | `8001` | Host port for staging backend API |
| `ADMIN_PORT` | `3004` | Host port for staging admin panel |

These variables map container ports to host ports in `compose.yaml`.

### 4. VPS Prerequisites

- Docker + Docker Compose installed
- SSH key auth configured
- User in `docker` group (no `sudo` needed for docker commands)
- No repo clone needed — workflow copies only `compose.yaml`

### 5. How It Works

1. **Build & Push**: Builds Docker images, pushes to GitHub Container Registry (`ghcr.io`)
2. **Copy**: Runner sparse-checkouts `compose.yaml`, SCPs it to `${APP_DIR}` on VPS
3. **Deploy**: SSH to VPS, generates `.env.staging`, logs in to GHCR, pulls images, starts containers
4. **Health Check**: Waits 15s then curls `${SSH_HOST}:${WEB_PORT}`

---

## `deploy.yml` — PM2-based Production Deploy

### 1. Add Repository Secrets

This workflow does **not** use a GitHub Environment. Add secrets at **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | Production VPS IP or hostname |
| `SSH_USER` | SSH username |
| `SSH_KEY` | Private SSH key |

### 2. VPS Prerequisites

- Node.js + npm + PM2 installed
- Repo cloned at `/home/ubuntu/semar-kos-finder`
- PM2 process `semarkosfinder` already configured (or auto-created on first run)

### 3. How It Works

1. SSH to VPS
2. `git pull origin main`
3. `npm install && npm run build`
4. Restart / start PM2 process on port `3002`

---

## Notes

- **No prefix needed**: Both workflows use plain secret names (`SSH_HOST`, `JWT_SECRET`, etc.). GitHub resolves environment-scoped secrets automatically when `environment:` is declared.
- **Port collision**: If host ports conflict, change the Variable values in the GitHub Environment settings — no code changes needed.
- **Concurrency**: `staging.yml` uses `concurrency: group: staging-deploy` to prevent overlapping deploys.
- **`APP_DIR` must be absolute**: Don't use `~` or `$HOME` — shell expansion doesn't work inside quoted workflow strings. Use `/home/ubuntu/semar-kos-staging` or `/opt/semar-kos-staging`.
