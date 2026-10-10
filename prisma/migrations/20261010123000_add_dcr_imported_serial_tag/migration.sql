-- CreateTable
CREATE TABLE "DcrImportedSerialTag" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "tag" VARCHAR(256) NOT NULL,
    "errorRemarks" TEXT,
    "importBatchId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DcrImportedSerialTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DcrImportedSerialTag_serialNumber_key" ON "DcrImportedSerialTag"("serialNumber");

-- CreateIndex
CREATE INDEX "DcrImportedSerialTag_serialNumber_idx" ON "DcrImportedSerialTag"("serialNumber");

-- CreateIndex
CREATE INDEX "DcrImportedSerialTag_importBatchId_idx" ON "DcrImportedSerialTag"("importBatchId");
