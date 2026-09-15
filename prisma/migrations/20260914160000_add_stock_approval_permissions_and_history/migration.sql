-- AlterTable
ALTER TABLE "StockDeductionAllocation" ADD COLUMN "rejectionHistory" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "dispatch_stock_approval_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dispatch_stock_approval_view" BOOLEAN NOT NULL DEFAULT false;
