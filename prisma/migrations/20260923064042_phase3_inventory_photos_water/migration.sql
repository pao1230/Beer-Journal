-- CreateEnum
CREATE TYPE "InventoryReason" AS ENUM ('PURCHASE', 'ADJUSTMENT', 'BREW');

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "stockUnit" TEXT,
ADD COLUMN     "waterSalt" TEXT;

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" SERIAL NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION,
    "reason" "InventoryReason" NOT NULL,
    "brewSessionId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" SERIAL NOT NULL,
    "brewStepId" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryTransaction_ingredientId_idx" ON "InventoryTransaction"("ingredientId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_brewSessionId_idx" ON "InventoryTransaction"("brewSessionId");

-- CreateIndex
CREATE INDEX "Photo_brewStepId_idx" ON "Photo"("brewStepId");

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_brewSessionId_fkey" FOREIGN KEY ("brewSessionId") REFERENCES "BrewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_brewStepId_fkey" FOREIGN KEY ("brewStepId") REFERENCES "BrewStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
