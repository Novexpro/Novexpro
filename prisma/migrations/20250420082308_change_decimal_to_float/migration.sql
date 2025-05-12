/*
  Warnings:

  - You are about to alter the column `month1Price` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `month1RateVal` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `month1RatePct` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(6,2)` to `DoublePrecision`.
  - You are about to alter the column `month2Price` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `month2RateVal` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `month2RatePct` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(6,2)` to `DoublePrecision`.
  - You are about to alter the column `month3Price` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `month3RateVal` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `month3RatePct` on the `AluminumSnapshot` table. The data in that column could be lost. The data in that column will be cast from `Decimal(6,2)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "AluminumSnapshot" ALTER COLUMN "month1Price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "month1RateVal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "month1RatePct" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "month2Price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "month2RateVal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "month2RatePct" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "month3Price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "month3RateVal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "month3RatePct" SET DATA TYPE DOUBLE PRECISION;
