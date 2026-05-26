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
- transient network failures

Non-retryable errors:

- insufficient funds
- business validation failures

Retry strategy:

- exponential backoff
- BullMQ durable retries
- retries survive server restarts

---

## Idempotency

Duplicate requests with the same:

```http
Idempotency-Key
eturn the same payment response.

Prevents:

duplicate charges
duplicate payment rows
accidental client retries
Concurrency Protection

The worker uses database locking semantics:

lockedAt
workerId

This prevents:

multiple workers processing the same payment
race conditions
duplicate gateway execution
Audit Logging

Every important payment transition is persisted:

payment created
processing started
retry scheduled
payment success
payment failure
webhook reconciliation
duplicate webhook ignored

This creates a complete immutable audit trail.

Webhook Reconciliation

The system supports asynchronous gateway callbacks.

Features:

duplicate webhook protection
final-state conflict handling
state reconciliation
idempotent webhook processing
Payment Lifecycle

PENDING ↓ PROCESSING ↓ SUCCESS

OR

PENDING ↓ PROCESSING ↓ RETRY_SCHEDULED ↓ PROCESSING ↓ FAILED

Tech Stack
Layer	Technology
API Framework	Hono
Runtime	Node.js
Language	TypeScript
Database	PostgreSQL
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