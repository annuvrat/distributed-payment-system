/*
  Warnings:

  - A unique constraint covering the columns `[gateway_reference_id]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `event_type` to the `payment_audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `request_hash` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('PAYMENT_CREATED', 'PROCESSING_STARTED', 'GATEWAY_TIMEOUT', 'RETRY_SCHEDULED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'WEBHOOK_RECEIVED', 'WEBHOOK_DUPLICATE_IGNORED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'RETRY_SCHEDULED';

-- DropIndex
DROP INDEX "payments_idempotency_key_idx";

-- AlterTable
ALTER TABLE "payment_audit_logs" ADD COLUMN     "attempt_number" INTEGER,
ADD COLUMN     "event_type" "PaymentEventType" NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "last_attempt_at" TIMESTAMP(3),
ADD COLUMN     "last_failure_reason" TEXT,
ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "next_retry_at" TIMESTAMP(3),
ADD COLUMN     "request_hash" TEXT NOT NULL,
ADD COLUMN     "worker_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_reference_id_key" ON "payments"("gateway_reference_id");

-- CreateIndex
CREATE INDEX "payments_locked_at_idx" ON "payments"("locked_at");

-- CreateIndex
CREATE INDEX "payments_status_locked_at_idx" ON "payments"("status", "locked_at");
