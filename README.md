# Resilient Payment Processing System

A production-inspired, asynchronous payment backend built with **Node.js**, **TypeScript**, **Hono**, **Prisma**, **BullMQ**, and **Valkey** (Redis-compatible).

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Payment Lifecycle](#payment-lifecycle)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Docker (Recommended)](#docker-recommended)
  - [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Design Decisions](#design-decisions)
- [Future Improvements](#future-improvements)

---

## Overview

This system handles payment creation and processing in a **fully asynchronous, fault-tolerant** manner. Payments are accepted via REST, queued for background processing, retried on failure with exponential backoff, and reconciled via webhooks — with every state transition recorded in an immutable audit log.

---

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │  POST /payments
       ▼
┌─────────────┐        ┌──────────────────┐
│  REST API   │───────▶│  BullMQ Queue    │
│  (Hono)     │        │  (Valkey/Redis)  │
└─────────────┘        └────────┬─────────┘
                                │  Job dequeued
                                ▼
                       ┌─────────────────┐
                       │  Worker Service │
                       └────────┬────────┘
                                │
               ┌────────────────┼──────────────────┐
               │                │                  │
               ▼                ▼                  ▼
        ┌────────────┐  ┌──────────────┐  ┌──────────────┐
        │  Gateway   │  │  Retry with  │  │  Audit Log   │
        │ Simulation │  │  Exp Backoff │  │  (Postgres)  │
        └─────┬──────┘  └──────────────┘  └──────────────┘
              │
              │  Async callback
              ▼
       ┌─────────────────┐
       │ POST /webhooks  │
       │ /payment        │
       └────────┬────────┘
                │  Reconcile final state
                ▼
       ┌─────────────────┐
       │   PostgreSQL    │
       │  (via Prisma)   │
       └─────────────────┘
```

---

## Payment Lifecycle

```
Client sends POST /payments
         │
         ▼
API validates request & checks idempotency key
         │
         ├── Duplicate key? ──▶ 409 Conflict (return existing payment)
         │
         ▼
Payment record created (status: QUEUED)
         │
         ▼
Job pushed to BullMQ queue
         │
         ▼
API returns 202 Accepted immediately
         │
         ▼ (background)
Worker picks up job
         │
         ▼
Gateway called (simulated)
         │
         ├── Timeout / transient error?
         │         │
         │         ▼
         │   Retry scheduled (exponential backoff)
         │   Attempt 1 → wait 1s → Attempt 2 → wait 2s → Attempt 3 → wait 4s
         │         │
         │         └── Max retries exceeded? ──▶ status: FAILED + audit log
         │
         ├── Success?
         │         │
         │         ▼
         │   status: PROCESSING + audit log
         │         │
         │         ▼
         │   Gateway sends webhook: POST /webhooks/payment
         │         │
         │         ▼
         │   Status reconciled: COMPLETED + final audit log
         │
         └── Non-retryable error ──▶ status: FAILED immediately
```
---
## DataBase Schema
![Prisma Schema Diagram](docs/image.png)

---

## Features

| Feature | Description |
|---|---|
| **Idempotent Payments** | Duplicate requests with the same `Idempotency-Key` return the existing payment instead of creating a new one |
| **Async Processing** | Payments are queued and processed in the background; the API responds immediately with `202 Accepted` |
| **Durable Retries** | Failed jobs are retried automatically via BullMQ with configurable exponential backoff |
| **Webhook Reconciliation** | Gateway callbacks reconcile the true final state of each payment |
| **Immutable Audit Logs** | Every state transition is recorded in PostgreSQL for observability, debugging, and compliance |
| **Concurrency-Safe** | Workers process jobs in isolation; Prisma transactions prevent race conditions |

### Retryable vs Non-Retryable Errors

| Retryable | Non-Retryable |
|---|---|
| Gateway timeout | Invalid account |
| Network errors | Insufficient funds |
| 5xx gateway errors | Fraud decline |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js + TypeScript (`tsx`) |
| **HTTP Framework** | [Hono](https://hono.dev) |
| **ORM** | [Prisma](https://www.prisma.io) |
| **Database** | PostgreSQL |
| **Queue** | [BullMQ](https://bullmq.io) |
| **Redis Engine** | [Valkey](https://valkey.io) (Redis-compatible) |

---

## Getting Started

### Docker (Recommended)

Starts the API, worker, PostgreSQL, and Valkey in one command:

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`.

Migrations and Prisma client generation are handled automatically on startup.

---

### Local Setup

**1. Install dependencies**

```bash
npm install
```

**2. Configure environment**

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and Redis settings
```

**3. Start Valkey (Redis)**

```bash
docker run -d -p 6379:6379 valkey/valkey
```

**4. Run database migrations**

```bash
npx prisma migrate dev
npx prisma generate
```

**5. Start the API server**

```bash
npx tsx index.ts
```
**6. Start the worker** (in a separate terminal)
![api server](server.png)

```bash
npx tsx worker.ts
```

---
![worker server](worker.png)

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payments

# Valkey / Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Retry configuration
MAX_RETRY_ATTEMPTS=3
RETRY_BASE_DELAY_MS=1000
```

See `.env.example` for the full reference. When using Docker Compose, these are pre-configured with sensible defaults.

---

## API Reference

### `POST /payments` — Create a payment

**Headers**

| Header | Required | Description |
|---|---|---|
| `Idempotency-Key` | Recommended | Unique key to prevent duplicate payments |
| `Content-Type` | Yes | `application/json` |

**Request body**

```json
{
  "userId": "user-abc123",
  "amount": 500,
  "currency": "INR"
}
```

**Responses**

| Status | Meaning |
|---|---|
| `202 Accepted` | Payment queued successfully |
| `409 Conflict` | Idempotency key already used; returns existing payment |

---

### `GET /payments/:id` — Get payment status

Returns the current status and audit trail for a payment.

---

### `POST /webhooks/payment` — Gateway webhook

Called by the payment gateway to deliver the final outcome. Reconciles the payment status in the database.

---

## Design Decisions

### Why BullMQ?

BullMQ provides persistent, Redis-backed job queues with built-in support for delayed retries, worker isolation, and durable processing — exactly what payment flows require. Jobs survive server restarts; retries are orchestrated without custom timers.

### Why Webhook Reconciliation?

Real payment gateways are asynchronous. Workers optimistically initiate payments, but the gateway's webhook is the authoritative source of truth. Reconciliation ensures the database always reflects the actual final outcome, not just what the worker believed happened.

### Why Immutable Audit Logs?

Payments require a full, tamper-evident history for compliance, debugging, and dispute resolution. Every state transition — from `QUEUED` to `PROCESSING` to `COMPLETED` or `FAILED` — is appended as a separate record, never overwritten.

---

