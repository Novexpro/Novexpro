-- This is an empty migration.

-- CreateTable
CREATE TABLE "MetalPrice" (
    "id" TEXT NOT NULL,
    "metal" TEXT NOT NULL,
    "spotPrice" DECIMAL(10,2) NOT NULL,
    "change" DECIMAL(10,2) NOT NULL,
    "changePercent" DECIMAL(6,2) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetalPrice_metal_idx" ON "MetalPrice"("metal");

-- CreateIndex
CREATE INDEX "MetalPrice_lastUpdated_idx" ON "MetalPrice"("lastUpdated");