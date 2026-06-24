/*
  Warnings:

  - You are about to drop the column `inStockQuantity` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `isVariant` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `lowStockAlert` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `lowStockQuantity` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `productAvailability` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `recommendedProducts` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `stockHistory` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `product_variants` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "product_variants_sku_key";

-- AlterTable
ALTER TABLE "cart_items" DROP COLUMN "inStockQuantity",
DROP COLUMN "isVariant",
DROP COLUMN "lowStockAlert",
DROP COLUMN "lowStockQuantity",
DROP COLUMN "price",
DROP COLUMN "productAvailability",
DROP COLUMN "recommendedProducts",
DROP COLUMN "stockHistory",
ADD COLUMN     "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "price",
ADD COLUMN     "productSnapshot" JSONB,
ADD COLUMN     "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "variantSnapshot" JSONB;

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "color",
DROP COLUMN "name",
DROP COLUMN "price",
DROP COLUMN "size",
DROP COLUMN "sku",
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "options" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "hasVariants" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "price" SET DEFAULT 0;
