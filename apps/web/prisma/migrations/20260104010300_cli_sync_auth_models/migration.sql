-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('CREATED', 'UPLOADING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PatchStatus" AS ENUM ('PROPOSED', 'APPLIED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "DeviceCodeStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "provider" TEXT;

-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "baseSnapshotId" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "manifestHash" TEXT,
ADD COLUMN     "protocolVersion" TEXT,
ADD COLUMN     "status" "SnapshotStatus" NOT NULL DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "SnapshotFile" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mode" INTEGER,
ADD COLUMN     "mtime" TIMESTAMP(3),
ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CliToken" ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Patch" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "baseBlobHash" TEXT NOT NULL,
    "patchFormat" TEXT NOT NULL,
    "patchBody" TEXT NOT NULL,
    "status" "PatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "Patch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditIssue" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL,
    "path" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CliDeviceCode" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCodeHash" TEXT NOT NULL,
    "status" "DeviceCodeStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "clientId" TEXT,
    "deviceName" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intervalSeconds" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CliDeviceCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patch_snapshotId_idx" ON "Patch"("snapshotId");

-- CreateIndex
CREATE INDEX "Patch_snapshotId_status_idx" ON "Patch"("snapshotId", "status");

-- CreateIndex
CREATE INDEX "Patch_snapshotId_path_idx" ON "Patch"("snapshotId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "Patch_snapshotId_idempotencyKey_key" ON "Patch"("snapshotId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditIssue_snapshotId_idx" ON "AuditIssue"("snapshotId");

-- CreateIndex
CREATE INDEX "AuditIssue_severity_idx" ON "AuditIssue"("severity");

-- CreateIndex
CREATE INDEX "AuditIssue_ruleId_idx" ON "AuditIssue"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "CliDeviceCode_deviceCodeHash_key" ON "CliDeviceCode"("deviceCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "CliDeviceCode_userCodeHash_key" ON "CliDeviceCode"("userCodeHash");

-- CreateIndex
CREATE INDEX "CliDeviceCode_userId_idx" ON "CliDeviceCode"("userId");

-- CreateIndex
CREATE INDEX "CliDeviceCode_status_idx" ON "CliDeviceCode"("status");

-- CreateIndex
CREATE INDEX "CliDeviceCode_expiresAt_idx" ON "CliDeviceCode"("expiresAt");

-- CreateIndex
CREATE INDEX "Project_provider_idx" ON "Project"("provider");

-- CreateIndex
CREATE INDEX "Snapshot_baseSnapshotId_idx" ON "Snapshot"("baseSnapshotId");

-- CreateIndex
CREATE INDEX "Snapshot_manifestHash_idx" ON "Snapshot"("manifestHash");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_projectId_idempotencyKey_key" ON "Snapshot"("projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SnapshotFile_snapshotId_isDeleted_idx" ON "SnapshotFile"("snapshotId", "isDeleted");

-- CreateIndex
CREATE INDEX "SnapshotFile_snapshotId_orderIndex_idx" ON "SnapshotFile"("snapshotId", "orderIndex");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_baseSnapshotId_fkey" FOREIGN KEY ("baseSnapshotId") REFERENCES "Snapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patch" ADD CONSTRAINT "Patch_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditIssue" ADD CONSTRAINT "AuditIssue_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CliDeviceCode" ADD CONSTRAINT "CliDeviceCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

