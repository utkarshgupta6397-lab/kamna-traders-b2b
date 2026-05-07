/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Sku` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Sku" DROP COLUMN "imageUrl",
ADD COLUMN     "caseSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "zohoBookItemId" BIGINT;

-- CreateIndex
CREATE INDEX "Sku_zohoBookItemId_idx" ON "Sku"("zohoBookItemId");
