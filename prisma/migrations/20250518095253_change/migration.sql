/*
  Warnings:

  - You are about to drop the column `lastUpdated` on the `MetalPrice` table. All the data in the column will be lost.
  - You are about to drop the column `metal` on the `MetalPrice` table. All the data in the column will be lost.
  - You are about to drop the `FuturesPrice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LMEPriceAlert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LME_3_MetalPrice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MCXPriceAlert` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[clerkId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clerkId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "LMEPriceAlert" DROP CONSTRAINT "LMEPriceAlert_userId_fkey";

-- DropForeignKey
ALTER TABLE "MCXPriceAlert" DROP CONSTRAINT "MCXPriceAlert_userId_fkey";

-- DropIndex
DROP INDEX "MetalPrice_lastUpdated_idx";

-- DropIndex
DROP INDEX "MetalPrice_metal_idx";

-- AlterTable
ALTER TABLE "AluminumSnapshot" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "LMECashSettlement" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "LME_West_Metal_Price" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "MetalPrice" DROP COLUMN "lastUpdated",
DROP COLUMN "metal",
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "Onboarding" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "RBI_Rate" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "SBITTRate" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerkId" TEXT NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- DropTable
DROP TABLE "FuturesPrice";

-- DropTable
DROP TABLE "LMEPriceAlert";

-- DropTable
DROP TABLE "LME_3_MetalPrice";

-- DropTable
DROP TABLE "MCXPriceAlert";

-- CreateTable
CREATE TABLE "LME_3month" (
    "id" SERIAL NOT NULL,
    "rateOfChange" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "timeSpan" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata',

    CONSTRAINT "LME_3month_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
