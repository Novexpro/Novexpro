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
    "name" TEXT,
    "email" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MCX_3_Month" (
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

    CONSTRAINT "MCX_3_Month_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetalPrice" (
    "id" TEXT NOT NULL,
    "spotPrice" DECIMAL(10,2) NOT NULL,
    "change" DECIMAL(10,2) NOT NULL,
    "changePercent" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text),
    "source" TEXT,

    CONSTRAINT "MetalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LME_3Month" (
    "id" SERIAL NOT NULL,
    "rateOfChange" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "timeSpan" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LME_3Month_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "MCX_3_Month_timestamp_idx" ON "MCX_3_Month"("timestamp");
