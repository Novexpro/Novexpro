-- CreateTable
CREATE TABLE "AluminumSnapshot" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "month1Label" TEXT NOT NULL,
    "month1Price" DECIMAL(10,2) NOT NULL,
    "month1RateVal" DECIMAL(10,2) NOT NULL,
    "month1RatePct" DECIMAL(6,2) NOT NULL,
    "month2Label" TEXT NOT NULL,
    "month2Price" DECIMAL(10,2) NOT NULL,
    "month2RateVal" DECIMAL(10,2) NOT NULL,
    "month2RatePct" DECIMAL(6,2) NOT NULL,
    "month3Label" TEXT NOT NULL,
    "month3Price" DECIMAL(10,2) NOT NULL,
    "month3RateVal" DECIMAL(10,2) NOT NULL,
    "month3RatePct" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AluminumSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AluminumSnapshot_timestamp_idx" ON "AluminumSnapshot"("timestamp");
