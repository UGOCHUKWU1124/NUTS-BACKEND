/*
  Warnings:

  - The `addedFrom` column on the `carts` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "deliveryCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "serviceCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
DROP COLUMN "addedFrom",
ADD COLUMN     "addedFrom" JSONB;

-- AlterTable
ALTER TABLE "product_variants" ALTER COLUMN "options" SET DEFAULT '[]';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "stock_history" (
    "id" TEXT NOT NULL,
    "adjustment" INTEGER NOT NULL,
    "oldStockQuantity" INTEGER NOT NULL,
    "newStockQuantity" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_history_productId_createdAt_idx" ON "stock_history"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_history_variantId_createdAt_idx" ON "stock_history"("variantId", "createdAt");

-- AddForeignKey
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
