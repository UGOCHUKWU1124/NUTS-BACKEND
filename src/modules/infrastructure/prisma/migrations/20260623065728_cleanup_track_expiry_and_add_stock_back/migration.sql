/*
  Warnings:

  - You are about to drop the column `trackExpiry` on the `carts` table. All the data in the column will be lost.
  - You are about to drop the column `trackQuantity` on the `carts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "carts" DROP COLUMN "trackExpiry",
DROP COLUMN "trackQuantity";

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;
