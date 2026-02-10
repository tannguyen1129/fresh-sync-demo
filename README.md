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
- Driver: (Check seed console output)
- Authority: admin@authority.gov