# CashPilot Agentic

Agentic finance operations project built on the CashPilot PostgreSQL, Express, React, Node, Tailwind, and shadcn-style foundation.

See [RUNBOOK.md](./RUNBOOK.md) for complete startup, shutdown, TablePlus, reset, and troubleshooting instructions.

See [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md) for the context-aware agent design, implementation sequence, and evaluation gates.

## Run locally

```bash
cp .env.example .env
npm install
npm run db:up
npm run dev
```

Web: `http://localhost:5174`

API: `http://localhost:4001`

Sign in with one of the seeded accounts below. All use password `demo1234`.

- CFO / Owner — `maya@northstarlabs.in`
- Finance Manager — `dev@northstarlabs.in`
- Customer — `riya@acmeretail.in`
- Platform Admin — `anika@cashpilot.app`

Authentication uses revocable, HTTP-only database sessions. Roles and tenant scope are enforced by the API.

## Agent-ready foundation

`GET /api/context/catalog` exposes pages, widgets, filters, entities, metrics, actions, roles, and API bindings. Mutations are role-checked and recorded in the audit log.
