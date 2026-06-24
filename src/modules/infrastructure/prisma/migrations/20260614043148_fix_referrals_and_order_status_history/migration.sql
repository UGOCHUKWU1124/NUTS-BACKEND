/*
  Warnings:

  - You are about to drop the column `changedById` on the `order_status_history` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "order_status_history" DROP CONSTRAINT "order_status_history_changedById_fkey";

-- AlterTable
ALTER TABLE "order_status_history" DROP COLUMN "changedById",
ADD COLUMN     "changedByAdminId" TEXT,
ADD COLUMN     "changedByCreatorId" TEXT,
ADD COLUMN     "changedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "order_status_history_changedByUserId_idx" ON "order_status_history"("changedByUserId");

-- CreateIndex
CREATE INDEX "order_status_history_changedByCreatorId_idx" ON "order_status_history"("changedByCreatorId");

-- CreateIndex
CREATE INDEX "order_status_history_changedByAdminId_idx" ON "order_status_history"("changedByAdminId");

-- CreateIndex
CREATE INDEX "referrals_referredUserId_idx" ON "referrals"("referredUserId");

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changedByCreatorId_fkey" FOREIGN KEY ("changedByCreatorId") REFERENCES "creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changedByAdminId_fkey" FOREIGN KEY ("changedByAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
