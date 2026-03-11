/*
  Warnings:

  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RentPayment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[agreementId]` on the table `Rental` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `agreementId` to the `Rental` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_rentalId_fkey";

-- DropForeignKey
ALTER TABLE "RentPayment" DROP CONSTRAINT "RentPayment_agreementId_fkey";

-- DropForeignKey
ALTER TABLE "RentPayment" DROP CONSTRAINT "RentPayment_tenantId_fkey";

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "agreementId" TEXT NOT NULL,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "RentPayment";

-- DropEnum
DROP TYPE "RentPaymentStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Rental_agreementId_key" ON "Rental"("agreementId");

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
