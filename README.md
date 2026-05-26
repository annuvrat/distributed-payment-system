# Resilient Payment Processing System

A production-inspired backend payment processing system built using:

- Node.js
- TypeScript
- Hono
- Prisma
- PostgreSQL
- BullMQ
- Valkey (Redis-compatible)

The system demonstrates:

- asynchronous background processing
- durable retries
- exponential backoff
- idempotent payment creation
- webhook reconciliation
- distributed payment state handling
- immutable audit logging
- concurrency-safe processing

---

# Architecture

Client
↓
REST API
↓
BullMQ Queue
↓
Worker Service
↓
Gateway Simulation
↓
Webhook Reconciliation
↓
Audit Logs + PostgreSQL

---

# Features

## Payment Creation

- REST API endpoint
- asynchronous processing
- returns immediately with queued status

---

## Retry System

Retryable errors:

- gateway timeouts
# Resilient Payment Processing System

Production-inspired backend for payment processing using Hono, Prisma, BullMQ and Valkey (Redis-compatible).

Features
- Asynchronous background processing with durable retries
- Exponential backoff and idempotent payment creation
- Webhook reconciliation and immutable audit logs

Local development (Docker)

1. Build and start services (API, worker, Postgres, Valkey):

```bash
docker compose up --build
```

2. The API will be available at `http://localhost:3000`.

Environment
- See `.env.example` for required variables. When using Docker Compose the `postgres` and `valkey` services are exposed and the compose file sets sensible defaults.

Common commands

Install dependencies locally:

```bash
npm install
```

Run TypeScript typecheck:

```bash
npx tsc --noEmit
```

Run API locally (requires dev deps):

```bash
npx tsx index.ts
```

Run worker locally:

```bash
npx tsx worker.ts
```

Database & migrations

When running with Docker Compose the Postgres service is available at `postgres:5432` and the README's `.env.example` is configured to point to it.

Apply migrations and generate Prisma client:

```bash
npx prisma migrate dev
npx prisma generate
```

API Endpoints

- POST `/payments` — create and queue a payment.
  - Headers: `Idempotency-Key` (recommended)
  - Body: `{ "userId": "...", "amount": 500, "currency": "INR" }`
  - Responses: `202` (queued), `409` (idempotency conflict)

- GET `/payments/{id}` — fetch a payment by id.

- POST `/webhooks/payment` — gateway webhook for reconciliation.

Notes
- If you see `connect ETIMEDOUT`, ensure the `valkey`/Redis service is running and reachable (see Docker Compose).
- This repo's development runtime uses `tsx` to run TypeScript directly; the Docker image in `docker-compose.yml` installs all dependencies and runs `tsx` so you can develop without a separate build step.

Contributing
- Open issues or submit PRs for bug fixes and improvements.

License: MIT
ORM	Prisma
Queue	BullMQ
Redis Engine	Valkey
Background Workers	BullMQ Workers
Environment Variables
DATABASE_URL=


REDIS_HOST=127.0.0.1
REDIS_PORT=6379


MAX_RETRY_ATTEMPTS=3
RETRY_BASE_DELAY_MS=1000
Running Locally
Install dependencies
npm install
Start PostgreSQL

Configure PostgreSQL locally or using Docker.

Start Valkey / Redis
docker run -d -p 6379:6379 valkey/valkey
Run Prisma Migration
npx prisma migrate dev
Generate Prisma Client
npx prisma generate
Start API Server
npm run dev
Start Worker
npm run worker
API Endpoints
Create Payment
POST /payments

Headers:

Idempotency-Key: payment-123

Request:

{
  "userId": "user-id",
  "amount": 500,
  "currency": "INR"
}
Get Payment
GET /payments/:id
Webhook Callback
POST /webhooks/payment
Example Retry Flow

attempt 1 ↓ gateway timeout ↓ retry scheduled ↓ BullMQ delayed retry ↓ attempt 2 ↓ success

Design Decisions
Why BullMQ?

BullMQ provides:

persistent retries
delayed jobs
worker isolation
durable queue processing
retry orchestration
Why Webhook Reconciliation?

Real payment gateways are asynchronous.

Workers optimistically initiate payments. Webhooks reconcile final truth.

Why Audit Logs?

Payment systems require:

observability
debugging
compliance tracking
forensic analysis
Future Improvements
circuit breaker implementation
Bull Board dashboard
Docker Compose
metrics + observability
OpenTelemetry tracing
dead-letter queues
distributed locks