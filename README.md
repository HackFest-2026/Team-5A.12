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

## Agent implementation

CashPilot now includes a persistent, tool-using finance agent:

- OpenRouter planning with role-scoped read and write tools.
- Live dashboard, invoice, customer, payment, cash-flow, dispute, approval, audit, and tenant retrieval.
- Persistent runs, steps, evidence, pending actions, and idempotency keys.
- Confirm-before-execute writes for invoice creation/update, reminders, payments, disputes, and approvals.
- Authorization rechecks, payload hashing, expiry, idempotency, audit records, and read-after-write results.
- Proactive signals derived from live collection risk, pending approvals, customer invoices, and tenant status.
- Catalog-driven navigation for every registered page and product form; ambiguous and analytical requests go through OpenRouter.
- Interactive evidence cards, current UI context, token/latency metrics, and a visible execution trace.
- Proactive CFO command-center insight and invoice-level “Why overdue?” agent entry points.
- Eight-second undo window for agent-executed reminders and recorded payments.
- Local live-data fallback when OpenRouter is not configured.

### OpenRouter configuration

Add a server-side API key to `.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-3-flash-preview
```

The key is never exposed to the browser. Requests use OpenRouter's tool-calling API and request zero-data-retention routing. Keep account-level privacy controls enabled for sensitive finance data.
