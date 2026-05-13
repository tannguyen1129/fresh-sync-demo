# FreshSync - Smart Port Orchestration

## Tech Stack
- **Framework:** Next.js 14 (App Router), NestJS (Modular).
- **Database:** PostgreSQL, Redis.
- **Engine:** BullMQ, Prisma ORM.
- **Realtime:** Socket.io.
- **Tools:** Docker, pnpm workspaces.

## Quick Start
1. `docker compose up -d`
2. `pnpm i`
3. `pnpm --filter @freshsync/api db:push`
4. `pnpm --filter @freshsync/api db:seed`
5. `pnpm dev`

## Default Users (Password: 123456)
- Operator: ops@port.com
- Logistics: biz@logistics.com
- Driver: driver@fleet.com
- Authority: admin@authority.gov
- Shipping Line System: system@one-line.com
- TOS System: tos@terminal.local

## Demo Shortcuts
- Reset demo state: `pnpm demo:reset`
- Run API smoke test: `pnpm demo:smoke`
- Trigger disruption scenario: `pnpm demo:scenario:disruption`

## Core Demo Scenarios
- `CONT-001`: green path, booking confirm, driver assignment, smart empty return
- `CONT-013`: blocked path with `COMMERCIAL_HOLD`
- `CONT-014`: blocked path with `CONTAINER_NOT_READY`
- `CONT-003`: `ZONE_B` disruption / re-optimization path

## Demo Docs
- Scripted talk track: [docs/DEMO_SCRIPT.md](/home/ubuntu/projects/fresh-sync-demo/docs/DEMO_SCRIPT.md)
- Demo accounts, containers, depots: [docs/DEMO_DATA.md](/home/ubuntu/projects/fresh-sync-demo/docs/DEMO_DATA.md)
- Production deployment: [docs/DEPLOYMENT.md](/home/ubuntu/projects/fresh-sync-demo/docs/DEPLOYMENT.md)

## Production Deploy
- App containers bind to localhost only: `web` on `127.0.0.1:3100`, `api` on `127.0.0.1:4100`
- Public ingress uses system `nginx` + `certbot` for `freshsync.umtoj.edu.vn`
- Deploy/update app containers: `pnpm deploy:prod`
- Verify production: `API_URL=https://freshsync.umtoj.edu.vn/api pnpm demo:smoke`
