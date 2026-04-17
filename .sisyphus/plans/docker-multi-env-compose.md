# Dockerize + docker-compose multi-env (production/staging/development)

## TL;DR
> **Summary**: Add Next.js (frontend/) Docker image + single `compose.yaml` with profiles for prod/staging/dev; prod+staging run simultaneously on same host, same shared Docker network, different host ports.
> **Deliverables**:
> - `frontend/Dockerfile` (multi-stage build, `next start` on port 3002)
> - `frontend/.dockerignore`
> - `compose.yaml` (profiles: production/staging/development; shared network `semar-kos-shared`)
> - Env templates: `.env.example` + `.env.{production,staging,development}.example` (no real secrets committed)
> - `.gitignore` update for `.env.*` (keep examples tracked)
> - README update with Docker runbook + port matrix
> **Effort**: Medium
> **Parallel**: YES — 2 waves
> **Critical Path**: Dockerfile → compose.yaml → env/gitignore/docs → verification

## Context
### Original Request
- “bikin jadi docker container + docker compose, butuh 3 environment: production, staging, development; production dan staging pakai network yang sama”

### Interview Summary
- Prod + staging run simultaneously on same Docker host.
- No reverse proxy; differentiate by host ports.
- Python `src/*.py` not containerized.
- Keep existing GitHub Actions deploy (SSH + PM2) unchanged.

### Repo Facts (grounded)
- Next.js app lives in `frontend/`.
  - `frontend/package.json` scripts: `dev: next dev`, `build: next build`, `start: next start`.
- Current VPS deploy uses PM2 running `npm start -- -p 3002`.
  - `.github/workflows/deploy.yml` line 45-46.
- Frontend API route reads Google Maps key from env:
  - `frontend/app/api/directions/route.ts` uses `process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Python scripts use `GMAPS_API_KEY` via `python-dotenv` (out of container scope).
- No existing Docker artifacts; README mentions `.env.example` but file missing.

### Metis Review (gaps addressed)
- Port parity: keep container listening on **3002** to match current PM2 deploy; staging uses host 3003 mapped to container 3002.
- Bind address: explicitly pass `-H 0.0.0.0` for container reachability.
- `NEXT_PUBLIC_*` caveat: do not rely on runtime env_file for client bundle; prefer server-only `GOOGLE_MAPS_API_KEY`.
- Shared network: explicit named bridge network `semar-kos-shared` so prod+staging attach to same network object.
- Healthcheck: no `/health` route; use TCP-open check (no app code changes).

## Work Objectives
### Core Objective
Run 3 compose environments (prod/staging/dev) with consistent containerization for Next.js app; prod+staging share same Docker network; all runnable on same host with no reverse proxy.

### Deliverables
1. Next.js production container image buildable via Docker.
2. `compose.yaml` with profiles + port matrix.
3. Env templates + gitignore rules to prevent secret commits.
4. Docs updates.

### Definition of Done (agent-verifiable)
Commands (from repo root):
0. Prepare env files (examples → real, untracked):
   - `cp .env.production.example .env.production`
   - `cp .env.staging.example .env.staging`
   - `cp .env.development.example .env.development`
1. Build image:
   - `docker build -f frontend/Dockerfile -t semar-kos-frontend:local frontend`
2. Start prod + staging together:
   - `docker compose --profile production --profile staging up -d --build`
   - `curl -fsS http://localhost:3002/ >/dev/null`
   - `curl -fsS http://localhost:3003/ >/dev/null`
3. Verify shared network attachment:
   - `docker network inspect semar-kos-shared --format '{{json .Containers}}'` shows both containers present.
4. Start dev:
   - `docker compose --profile development up -d --build`
   - `curl -fsS http://localhost:3000/ >/dev/null`
5. Security guardrail:
   - `git status --porcelain` shows no committed real `.env.*` secrets; only `*.example` tracked.
6. CI workflow unchanged:
   - `git diff -- .github/workflows/deploy.yml` empty.

### Must Have
- Prod+staging: same Docker network object `semar-kos-shared`.
- Prod+staging: simultaneous run on same host (no port conflict).
- Dev: runnable separately with hot-reload style workflow (bind-mount).

### Must NOT Have (guardrails)
- No reverse proxy (Traefik/Nginx/Caddy) introduced.
- No Python container/service added.
- No changes to `.github/workflows/deploy.yml`.
- No secrets committed (only `.env*.example`).
- No Next.js config changes required (no `next.config.*` introduction).

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification via commands.
- Test decision: none (project has no test harness for this scope).
- QA policy: every task includes runnable docker/compose checks.
- Evidence files (executor must capture): `.sisyphus/evidence/task-{N}-{slug}.txt` (command output/log excerpts).

## Execution Strategy
### Parallel Execution Waves
Wave 1 (foundation; can run in parallel):
- Add `frontend/Dockerfile` (prod runtime)
- Add `frontend/.dockerignore`
- Add `compose.yaml` with profiles + networks + ports

Wave 2 (after Wave 1):
- Add env example files + `.gitignore` rules
- Update README with Docker runbook + port matrix

### Dependency Matrix (full)
- Task 1 blocks: Task 3
- Task 2 blocks: Task 3 (build context hygiene; not hard block but recommended)
- Task 3 blocks: Tasks 4-5 verification steps
- Task 4 blocks: Task 3 runtime (env_file), Task 5 docs accuracy

### Agent Dispatch Summary
- Wave 1: 3 tasks (category: quick/unspecified-low)
- Wave 2: 2 tasks (category: writing/unspecified-low)

## TODOs
> Implementation + Verification = ONE task.

- [x] 1. Add Next.js production Dockerfile (`frontend/Dockerfile`)

  **What to do**:
  - Create `frontend/Dockerfile` multi-stage:
    - Builder stage installs deps + runs `npm run build`.
    - Runner stage installs **prod** deps only (`npm ci --omit=dev`) then runs `next start`.
    - Listen on port **3002** and bind host `0.0.0.0`.
  - Use Node **20-slim** base.
  - Disable telemetry via `NEXT_TELEMETRY_DISABLED=1`.
  - Run as non-root (`USER node`) in runner stage.

  **Must NOT do**:
  - Do not add `next.config.*`.
  - Do not bake API keys via build args.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — file creation + Dockerfile wiring.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [3] | Blocked By: []

  **References**:
  - Start command parity: `.github/workflows/deploy.yml:45-46` (PM2 runs `npm start -- -p 3002`).
  - Frontend scripts: `frontend/package.json:4-8`.

  **Exact file content** (executor copy as-is, adjust only if build fails):
  ```dockerfile
  # syntax=docker/dockerfile:1
  
  FROM node:20-slim AS builder
  WORKDIR /app
  
  ENV NEXT_TELEMETRY_DISABLED=1
  
  COPY package.json package-lock.json ./
  RUN npm ci
  
  COPY . .
  RUN npm run build
  
  FROM node:20-slim AS runner
  WORKDIR /app
  
  ENV NODE_ENV=production
  ENV NEXT_TELEMETRY_DISABLED=1
  
  COPY package.json package-lock.json ./
  RUN npm ci --omit=dev && npm cache clean --force
  
  COPY --from=builder /app/public ./public
  COPY --from=builder /app/.next ./.next
  
  # optional but safe (avoid permission surprises)
  RUN chown -R node:node /app
  
  USER node
  EXPOSE 3002
  
  CMD ["npm","start","--","-p","3002","-H","0.0.0.0"]
  ```

  **Acceptance Criteria**:
  - [ ] `docker build -f frontend/Dockerfile -t semar-kos-frontend:local frontend` exits 0.
  - [ ] Evidence captured: `.sisyphus/evidence/task-1-dockerfile-build.txt` (build output tail + image id).

  **QA Scenarios**:
  ```
  Scenario: Build image
    Tool: Bash
    Steps:
      1) docker build -f frontend/Dockerfile -t semar-kos-frontend:local frontend
    Expected:
      - exit code 0
    Evidence: .sisyphus/evidence/task-1-dockerfile-build.txt
  
  Scenario: Run container listens on 3002
    Tool: Bash
    Steps:
      1) docker run --rm -d --name semar_tmp -p 3999:3002 semar-kos-frontend:local
      2) curl -fsS http://localhost:3999/ >/dev/null
      3) docker rm -f semar_tmp
    Expected:
      - curl exit 0
    Evidence: .sisyphus/evidence/task-1-dockerfile-run.txt
  ```

  **Commit**: YES | Message: `chore(docker): add Next.js production Dockerfile` | Files: [`frontend/Dockerfile`]

- [x] 2. Add frontend build context ignores (`frontend/.dockerignore`)

  **What to do**:
  - Create `frontend/.dockerignore` to keep build context small and avoid leaking junk.

  **Must NOT do**:
  - Do not ignore `package-lock.json`.

  **Recommended Agent Profile**:
  - Category: `quick` — single small file.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [3] | Blocked By: []

  **References**:
  - Existing ignores (repo-level): `.gitignore:12-17`.

  **Exact file content**:
  ```gitignore
  node_modules
  .next
  out
  .git
  .env
  .env.*
  npm-debug.log
  yarn-error.log
  .DS_Store
  ```

  **Acceptance Criteria**:
  - [ ] `docker build -f frontend/Dockerfile -t semar-kos-frontend:local frontend` still exits 0.
  - [ ] Evidence: `.sisyphus/evidence/task-2-dockerignore.txt` (show file + successful build output snippet).

  **QA Scenarios**:
  ```
  Scenario: Docker build still succeeds
    Tool: Bash
    Steps:
      1) docker build -f frontend/Dockerfile -t semar-kos-frontend:local frontend
    Expected:
      - exit code 0
    Evidence: .sisyphus/evidence/task-2-dockerignore.txt
  ```

  **Commit**: YES | Message: `chore(docker): add frontend .dockerignore` | Files: [`frontend/.dockerignore`]

- [x] 3. Add `compose.yaml` with 3 profiles + shared prod/staging network

  **What to do**:
  - Create `compose.yaml` in repo root.
  - Services:
    - `web_prod` (profile `production`): host `3002:3002`, env_file `.env.production`, network `semar_shared`.
    - `web_staging` (profile `staging`): host `3003:3002`, env_file `.env.staging`, network `semar_shared`.
    - `web_dev` (profile `development`): host `3000:3000`, bind-mount `./frontend:/app`, uses `npm run dev` with `-H 0.0.0.0`.
  - Define named network:
    - `semar_shared` with `name: semar-kos-shared` (bridge).
    - `semar_dev` default (separate).
  - Add healthcheck for prod/staging using TCP open on 127.0.0.1:3002 (no `/health` route).

  **Must NOT do**:
  - Do not add reverse proxy services.
  - Do not use fixed `container_name` (avoid collisions).

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — compose design + run verification.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [4,5] | Blocked By: [1,2]

  **References**:
  - Docker build context: `frontend/` (Next.js app).
  - Port parity: `.github/workflows/deploy.yml:45-46`.

  **Exact file content**:
  ```yaml
  name: semar-kos-finder
  
  services:
    web_prod:
      profiles: ["production"]
      build:
        context: ./frontend
        dockerfile: Dockerfile
      image: semar-kos-frontend:prod
      ports:
        - "3002:3002"
      env_file:
        - ./.env.production
      environment:
        NODE_ENV: production
        NEXT_TELEMETRY_DISABLED: "1"
      networks:
        - semar_shared
      restart: unless-stopped
      init: true
      healthcheck:
        test:
          [
            "CMD",
            "node",
            "-e",
            "const net=require('net');const s=net.connect(3002,'127.0.0.1');s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1));"
          ]
        interval: 10s
        timeout: 3s
        retries: 10
        start_period: 10s
  
    web_staging:
      profiles: ["staging"]
      build:
        context: ./frontend
        dockerfile: Dockerfile
      image: semar-kos-frontend:staging
      ports:
        - "3003:3002"
      env_file:
        - ./.env.staging
      environment:
        NODE_ENV: production
        NEXT_TELEMETRY_DISABLED: "1"
      networks:
        - semar_shared
      restart: unless-stopped
      init: true
      healthcheck:
        test:
          [
            "CMD",
            "node",
            "-e",
            "const net=require('net');const s=net.connect(3002,'127.0.0.1');s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1));"
          ]
        interval: 10s
        timeout: 3s
        retries: 10
        start_period: 10s
  
    web_dev:
      profiles: ["development"]
      image: node:20-slim
      working_dir: /app
      ports:
        - "3000:3000"
      env_file:
        - ./.env.development
      environment:
        NEXT_TELEMETRY_DISABLED: "1"
        # uncomment if file watching flaky on non-linux hosts
        # WATCHPACK_POLLING: "true"
      volumes:
        - ./frontend:/app
        - dev_node_modules:/app/node_modules
        - dev_next_cache:/app/.next
      command: >
        sh -lc "test -x node_modules/.bin/next || npm ci; npm run dev -- -p 3000 -H 0.0.0.0"
      networks:
        - semar_dev
  
  networks:
    semar_shared:
      name: semar-kos-shared
      driver: bridge
    semar_dev:
      driver: bridge
  
  volumes:
    dev_node_modules:
    dev_next_cache:
  ```

  **Acceptance Criteria**:
  - [ ] `docker compose config` exits 0.
  - [ ] `docker compose --profile production --profile staging up -d --build` exits 0.
  - [ ] `curl -fsS http://localhost:3002/ >/dev/null` exits 0.
  - [ ] `curl -fsS http://localhost:3003/ >/dev/null` exits 0.
  - [ ] `docker network inspect semar-kos-shared --format '{{json .Containers}}'` output includes both `web_prod` and `web_staging` container ids/names.
  - [ ] Evidence: `.sisyphus/evidence/task-3-compose-prod-staging.txt` (compose up + curls + network inspect).

  **QA Scenarios**:
  ```
  Scenario: Prod + staging run concurrently
    Tool: Bash
    Steps:
      0) cp .env.production.example .env.production
      1) cp .env.staging.example .env.staging
      1) docker compose --profile production --profile staging up -d --build
      2) curl -fsS http://localhost:3002/ >/dev/null
      3) curl -fsS http://localhost:3003/ >/dev/null
      4) docker network inspect semar-kos-shared --format '{{json .Containers}}'
    Expected:
      - both curl exit 0
      - network inspect shows 2 containers attached
    Evidence: .sisyphus/evidence/task-3-compose-prod-staging.txt
  
  Scenario: Dev starts and serves on 3000
    Tool: Bash
    Steps:
      0) cp .env.development.example .env.development
      1) docker compose --profile development up -d
      2) curl -fsS http://localhost:3000/ >/dev/null
    Expected:
      - curl exit 0
    Evidence: .sisyphus/evidence/task-3-compose-dev.txt
  ```

  **Commit**: YES | Message: `chore(compose): add profiles for prod/staging/dev` | Files: [`compose.yaml`]

- [x] 4. Add env templates + ignore real env files safely

  **What to do**:
  - Add missing `.env.example` at repo root (README already references it).
  - Add per-environment examples:
    - `.env.production.example`
    - `.env.staging.example`
    - `.env.development.example`
  - Update `.gitignore` to ignore real `.env.*` while keeping examples committed.
  - Document variable mapping:
    - Python scripts use `GMAPS_API_KEY`.
    - Next.js server route uses `GOOGLE_MAPS_API_KEY` (preferred) with fallback to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

  **Must NOT do**:
  - Do not commit `.env.production`, `.env.staging`, `.env.development` (real secrets).

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — env hygiene + gitignore.
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [5] | Blocked By: [3]

  **References**:
  - README env instructions: `README.md` “Setup Environment”.
  - Frontend env usage: `frontend/app/api/directions/route.ts:15`.
  - Current gitignore env rules: `.gitignore:18-21`.

  **Exact content** (examples; executor create these files):
  - `.env.example`
    ```
    # Used by Python scripts in /src (host-run, not containerized)
    GMAPS_API_KEY=replace_me
    
    # Used by Next.js server (dockerized)
    GOOGLE_MAPS_API_KEY=replace_me
    ```
  - `.env.production.example`
    ```
    GOOGLE_MAPS_API_KEY=replace_me
    ```
  - `.env.staging.example`
    ```
    GOOGLE_MAPS_API_KEY=replace_me
    ```
  - `.env.development.example`
    ```
    GOOGLE_MAPS_API_KEY=replace_me
    ```
  - `.gitignore` update (append near “Sensitive Data”):
    ```gitignore
    # --- Sensitive Data (Docker/Compose) ---
    .env.*
    !.env.example
    !.env.production.example
    !.env.staging.example
    !.env.development.example
    ```

  **Acceptance Criteria**:
  - [ ] `git status --porcelain` shows the new `*.example` files as tracked additions; no real `.env.*` present.
  - [ ] `docker compose --profile production --profile staging up -d` still starts when user provides real `.env.production` + `.env.staging` locally.
  - [ ] Evidence: `.sisyphus/evidence/task-4-env-templates.txt` (list files + gitignore diff).

  **QA Scenarios**:
  ```
  Scenario: Examples exist, secrets ignored
    Tool: Bash
    Steps:
      1) ls -la .env.example .env.production.example .env.staging.example .env.development.example
      2) git check-ignore -v .env.production .env.staging .env.development || true
    Expected:
      - example files exist
      - real env files would be ignored (after user creates them)
    Evidence: .sisyphus/evidence/task-4-env-templates.txt
  ```

  **Commit**: YES | Message: `chore(env): add env examples + ignore real env files` | Files: [`.env.example`, `.env.production.example`, `.env.staging.example`, `.env.development.example`, `.gitignore`]

- [x] 5. Update README with Docker runbook + port matrix

  **What to do**:
  - Update `README.md`:
    - Add “Docker (production/staging)” section with exact commands.
    - Add “Docker (development)” section.
    - Add port matrix table:
      - dev: `http://localhost:3000`
      - prod: `http://localhost:3002`
      - staging: `http://localhost:3003`
    - Add note: existing VPS deploy still uses PM2; Docker path is additional, not wired into CI.
    - Add note about env vars: `GOOGLE_MAPS_API_KEY` required for directions API route.

  **Must NOT do**:
  - Do not delete existing non-docker instructions; append.

  **Recommended Agent Profile**:
  - Category: `writing` — docs update.
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [] | Blocked By: [3,4]

  **References**:
  - Existing run instructions: `README.md` “Menjalankan Aplikasi”.
  - Compose commands: `compose.yaml` (from Task 3).

  **Acceptance Criteria**:
  - [ ] `grep -n "Docker" -n README.md | head` shows added sections.
  - [ ] Commands in README match compose profiles: `production`, `staging`, `development`.
  - [ ] Evidence: `.sisyphus/evidence/task-5-readme-docker.txt` (README excerpt lines + commands).

  **QA Scenarios**:
  ```
  Scenario: README commands actually work
    Tool: Bash
    Steps:
      1) docker compose --profile production --profile staging up -d --build
      2) curl -fsS http://localhost:3002/ >/dev/null
      3) curl -fsS http://localhost:3003/ >/dev/null
    Expected:
      - both curls exit 0
    Evidence: .sisyphus/evidence/task-5-readme-docker.txt
  ```

  **Commit**: YES | Message: `docs: document docker compose environments + ports` | Files: [`README.md`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> Run 4 review agents in parallel. All must approve. Present consolidated results to user; wait explicit “okay”.
- [x] F1. Plan Compliance Audit — oracle [APPROVE]
- [x] F2. Code Quality Review — unspecified-high [APPROVE]
- [x] F3. Real Manual QA — unspecified-high [APPROVE]
- [x] F4. Scope Fidelity Check — oracle [APPROVE]

## Commit Strategy
- Prefer 1 commit per task (1→5). No changes to `.github/workflows/deploy.yml`.

## Success Criteria
- Three compose profiles runnable; prod+staging share `semar-kos-shared` and run concurrently.
- No secrets committed; env examples present.
- Documentation updated and matches reality.
