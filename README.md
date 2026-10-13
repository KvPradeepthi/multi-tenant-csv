# Multi-Tenant CSV Export API

This repository implements a secure, shared-schema multi-tenant sales report API.

## Run with Docker

Copy `.env.example` to `.env` and set `JWT_SECRET` to a random value, then run:

```sh
docker compose up --build
```

The API listens on `http://localhost:3002` (container port 3000) and PostgreSQL is exposed on port `5433` (container port 5432). PostgreSQL is initialized with two
tenants, four users, and records assigned to multiple agents. The database
volume is initialized only on its first creation; use
`docker compose down -v` when a fresh seed is needed.

## API

### Login

```sh
curl -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"adminA@example.com","password":"secret123"}'
```

The response contains a signed JWT with `userId`, `tenantId`, and `role`
claims. Send it as `Authorization: Bearer <token>`.

### Export

`GET /api/reports/sales` returns an attachment named `sales_report.csv` with
the columns `id,amount,sale_date,client_name`. Admins receive every record
for their JWT tenant. Agents receive only records assigned to their JWT user.
Any `tenant_id` query parameter is ignored.

## Tests

The executable `run-tests.sh` starts the Docker services, waits for the health
endpoint, runs the Jest black-box suite, and tears the services down:

```sh
./run-tests.sh
```

For an already-running API and database, use:

```sh
npm ci
DATABASE_URL=postgres://app:app_password@localhost:5433/tenant_reports \
JWT_SECRET=replace-with-a-long-random-secret npm run test:isolation
```
