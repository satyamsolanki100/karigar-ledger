-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLERK', 'FINANCE_HEAD');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('VAULT_OPENING', 'ISSUE', 'RECEIPT_PIECE', 'RECEIPT_SCRAP', 'RECEIPT_FILINGS', 'REFINER_OUT', 'REFINER_IN');

-- CreateEnum
CREATE TYPE "Location" AS ENUM ('VAULT', 'KARIGAR', 'REFINER', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('OVER_ALLOWANCE', 'DRIFT');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultWastagePct" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Karigar" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Karigar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KarigarAllowance" (
    "karigarId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "allowedWastagePct" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "KarigarAllowance_pkey" PRIMARY KEY ("karigarId","categoryId")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "allowedPct" DECIMAL(5,2) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "issuedFine" DECIMAL(10,3),
    "receivedFine" DECIMAL(10,3),
    "lossGrams" DECIMAL(10,3),
    "allowedGrams" DECIMAL(10,3),
    "excessGrams" DECIMAL(10,3),
    "actualPct" DECIMAL(5,2),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "txnNumber" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "fromLocation" "Location" NOT NULL,
    "toLocation" "Location" NOT NULL,
    "karigarId" TEXT,
    "jobId" TEXT,
    "grossWeight" DECIMAL(10,3) NOT NULL,
    "purityPct" DECIMAL(5,2) NOT NULL,
    "fineWeight" DECIMAL(10,3) NOT NULL,
    "huid" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredById" TEXT NOT NULL,
    "readingId" TEXT,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaleReading" (
    "id" TEXT NOT NULL,
    "photo" BYTEA NOT NULL,
    "photoMime" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "readWeight" DECIMAL(10,3),
    "readPurityPct" DECIMAL(5,2),
    "confidence" DECIMAL(4,3) NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "status" "ReadingStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaleReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LossAlert" (
    "id" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "jobId" TEXT,
    "kind" "AlertKind" NOT NULL,
    "allowedPct" DECIMAL(5,2) NOT NULL,
    "actualPct" DECIMAL(5,2) NOT NULL,
    "baselinePct" DECIMAL(5,2),
    "excessGrams" DECIMAL(10,3) NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "LossAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_name_key" ON "ItemCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Karigar_code_key" ON "Karigar"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_txnNumber_key" ON "LedgerEntry"("txnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_readingId_key" ON "LedgerEntry"("readingId");

-- CreateIndex
CREATE INDEX "LedgerEntry_karigarId_occurredAt_idx" ON "LedgerEntry"("karigarId", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_occurredAt_idx" ON "LedgerEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "LossAlert_status_createdAt_idx" ON "LossAlert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "KarigarAllowance" ADD CONSTRAINT "KarigarAllowance_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Karigar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarAllowance" ADD CONSTRAINT "KarigarAllowance_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Karigar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Karigar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "ScaleReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleReading" ADD CONSTRAINT "ScaleReading_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LossAlert" ADD CONSTRAINT "LossAlert_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Karigar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LossAlert" ADD CONSTRAINT "LossAlert_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LossAlert" ADD CONSTRAINT "LossAlert_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Slip numbers continue from the paper ledger, which ended at TX-30000.
CREATE SEQUENCE "txn_number_seq" START WITH 30001;
