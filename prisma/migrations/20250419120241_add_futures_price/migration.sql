-- CreateTable
CREATE TABLE "FuturesPrice" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "contractMonth" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "rateChange" DOUBLE PRECISION NOT NULL,
    "rateChangePercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuturesPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuturesPrice_date_idx" ON "FuturesPrice"("date");

-- CreateIndex
CREATE INDEX "FuturesPrice_contractMonth_idx" ON "FuturesPrice"("contractMonth");

-- CreateIndex
CREATE UNIQUE INDEX "FuturesPrice_date_contractMonth_key" ON "FuturesPrice"("date", "contractMonth");
