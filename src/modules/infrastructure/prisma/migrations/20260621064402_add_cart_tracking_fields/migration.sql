-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "inStockQuantity" INTEGER,
ADD COLUMN     "isVariant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lowStockAlert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lowStockQuantity" INTEGER,
ADD COLUMN     "productAvailability" TEXT DEFAULT 'in_stock',
ADD COLUMN     "recommendedProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stockHistory" JSONB;

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "abandonedCartAlerted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "addedFrom" TEXT DEFAULT 'web',
ADD COLUMN     "trackExpiry" TIMESTAMP(3),
ADD COLUMN     "trackQuantity" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "creators_isActive_isApproved_storeSlug_idx" ON "creators"("isActive", "isApproved", "storeSlug");

-- CreateIndex
CREATE INDEX "creators_isActive_isApproved_createdAt_idx" ON "creators"("isActive", "isApproved", "createdAt");

-- CreateIndex
CREATE INDEX "discount_codes_code_isActive_expiresAt_idx" ON "discount_codes"("code", "isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "discount_codes_creatorId_isActive_scope_idx" ON "discount_codes"("creatorId", "isActive", "scope");

-- CreateIndex
CREATE INDEX "order_items_orderId_productId_idx" ON "order_items"("orderId", "productId");

-- CreateIndex
CREATE INDEX "order_items_creatorId_orderId_idx" ON "order_items"("creatorId", "orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_createdAt_idx" ON "order_items"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_userId_status_createdAt_idx" ON "orders"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "product_variants_productId_isActive_isDeleted_idx" ON "product_variants"("productId", "isActive", "isDeleted");

-- CreateIndex
CREATE INDEX "products_price_idx" ON "products"("price");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_isActive_isDeleted_createdAt_idx" ON "products"("isActive", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "products_creatorId_isActive_isDeleted_createdAt_idx" ON "products"("creatorId", "isActive", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "users_isActive_createdAt_idx" ON "users"("isActive", "createdAt");
