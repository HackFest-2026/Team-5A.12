# CashPilot Agentic Local Runbook

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop running
- TablePlus (optional)

## First-time setup

Open a terminal and run:

```bash
cd /Users/shivanandhulikatti/Desktop/dev/hackathons/kle-hackfest/cashpilot-agentic
cp .env.example .env
npm install
npm run db:up
```

The database is automatically created and seeded from `db/init.sql` the first time its Docker volume starts.

## Start the complete application

Make sure Docker Desktop is running, then use two commands:

```bash
cd /Users/shivanandhulikatti/Desktop/dev/hackathons/kle-hackfest/cashpilot-agentic
npm run db:up
npm run dev
```

`npm run dev` starts both the React frontend and Express API. Keep this terminal open.

| Service | Address |
| --- | --- |
| Web application | http://localhost:5174 |
| API | http://localhost:4001 |
| API health check | http://localhost:4001/health |
| PostgreSQL | localhost:5435 |

## Demo logins

All demo accounts use password `demo1234`.

| Role | Email |
| --- | --- |
| CFO / Owner | `maya@northstarlabs.in` |
| Finance Manager | `dev@northstarlabs.in` |
| Customer | `riya@acmeretail.in` |
| Platform Admin | `anika@cashpilot.app` |

## Stop the complete application

1. In the terminal running `npm run dev`, press `Control + C`.
2. Stop PostgreSQL:

```bash
cd /Users/shivanandhulikatti/Desktop/dev/hackathons/kle-hackfest/cashpilot-agentic
npm run db:down
```

`db:down` stops the database without deleting its data. The next `db:up` continues with the same data.

## Connect using TablePlus

Create a new PostgreSQL connection with:

| Setting | Value |
| --- | --- |
| Name | CashPilot Local |
| Host | `127.0.0.1` |
| Port | `5435` |
| User | `cashpilot` |
| Password | `cashpilot` |
| Database | `cashpilot` |
| SSL | Disabled |

Click **Test**, then **Connect**. Application tables are under the `public` schema.

Important tables include `tenants`, `users`, `customers`, `invoices`, `payments`, `disputes`, `approvals`, `notifications`, `sessions`, and `audit_logs`.

## Reset the demo database

Use this only when you want to delete all local changes and restore the original seeded demo data:

```bash
npm run db:reset
```

This deletes only CashPilot's Docker database volume and recreates it from `db/init.sql`.

## Common problems

### Sign-in says “Failed to fetch”

The API is not running. Start the full application with:

```bash
npm run dev
```

Confirm that http://localhost:4001/health returns an `ok` response.

### Port already in use

Check which process is using the port:

```bash
lsof -nP -iTCP:4001 -sTCP:LISTEN
lsof -nP -iTCP:5174 -sTCP:LISTEN
```

Stop the old CashPilot Agentic terminal with `Control + C`, then run `npm run dev` again. The app intentionally uses a strict frontend port so it will not silently move from `5174` to another port.

### Database connection fails

Confirm Docker Desktop is running, then run:

```bash
npm run db:up
docker compose ps
```
