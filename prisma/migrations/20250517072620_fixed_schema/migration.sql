-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationMethod" AS ENUM ('WEB', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "PercentageType" AS ENUM ('GAIN', 'LOSS', 'GAINLOSS');

-- CreateTable
CREATE TABLE "Onboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "interestedMetals" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "MetalPrice" (
    "id" TEXT NOT NULL,
    "metal" TEXT NOT NULL,
    "spotPrice" DECIMAL(10,2) NOT NULL,
    "change" DECIMAL(10,2) NOT NULL,
    "changePercent" DECIMAL(6,2) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,

    CONSTRAINT "MetalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MCXPriceAlert" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "targetPrice" DECIMAL(10,2),
    "alertType" "AlertType" NOT NULL DEFAULT 'PRICE',
    "percentageType" "PercentageType",
    "targetPercentage" DECIMAL(6,2),
    "calculatedTarget" DECIMAL(10,2),
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "notificationMethod" "NotificationMethod" NOT NULL,
    "customMessage" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "MCXPriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LMEPriceAlert" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "targetPrice" DECIMAL(10,2),
    "alertType" "AlertType" NOT NULL DEFAULT 'PRICE',
    "percentageType" "PercentageType",
    "targetPercentage" DECIMAL(6,2),
    "calculatedTarget" DECIMAL(10,2),
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "notificationMethod" "NotificationMethod" NOT NULL,
    "customMessage" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "LMEPriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LME_3_MetalPrice" (
    "id" SERIAL NOT NULL,
    "rateOfChange" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "timeSpan" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LME_3_MetalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SBITTRate" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SBITTRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RBI_Rate" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RBI_Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LMECashSettlement" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "Dollar_Difference" DOUBLE PRECISION NOT NULL,
    "INR_Difference" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LMECashSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LME_West_Metal_Price" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "Price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LME_West_Metal_Price_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Onboarding_userId_key" ON "Onboarding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FuturesPrice_date_idx" ON "FuturesPrice"("date");

-- CreateIndex
CREATE INDEX "FuturesPrice_contractMonth_idx" ON "FuturesPrice"("contractMonth");

-- CreateIndex
CREATE UNIQUE INDEX "FuturesPrice_date_contractMonth_key" ON "FuturesPrice"("date", "contractMonth");

-- CreateIndex
CREATE INDEX "AluminumSnapshot_timestamp_idx" ON "AluminumSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "MetalPrice_metal_idx" ON "MetalPrice"("metal");

-- CreateIndex
CREATE INDEX "MetalPrice_lastUpdated_idx" ON "MetalPrice"("lastUpdated");

-- CreateIndex
CREATE INDEX "MCXPriceAlert_userId_idx" ON "MCXPriceAlert"("userId");

-- CreateIndex
CREATE INDEX "MCXPriceAlert_status_idx" ON "MCXPriceAlert"("status");

-- CreateIndex
CREATE INDEX "LMEPriceAlert_userId_idx" ON "LMEPriceAlert"("userId");

-- CreateIndex
CREATE INDEX "LMEPriceAlert_status_idx" ON "LMEPriceAlert"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SBITTRate_date_key" ON "SBITTRate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RBI_Rate_date_key" ON "RBI_Rate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LMECashSettlement_date_key" ON "LMECashSettlement"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LME_West_Metal_Price_date_key" ON "LME_West_Metal_Price"("date");

-- AddForeignKey
ALTER TABLE "MCXPriceAlert" ADD CONSTRAINT "MCXPriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMEPriceAlert" ADD CONSTRAINT "LMEPriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
