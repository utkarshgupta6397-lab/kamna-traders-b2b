-- AlterTable
ALTER TABLE "Cart" ADD COLUMN "dispatchSlipNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cart_dispatchSlipNumber_key" ON "Cart"("dispatchSlipNumber");
