/*
  Warnings:

  - You are about to drop the column `isActive` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the `Complaint` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PropertyImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SecurityDepositPayment` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DissolutionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- DropForeignKey
ALTER TABLE "Complaint" DROP CONSTRAINT "Complaint_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Complaint" DROP CONSTRAINT "Complaint_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PropertyImage" DROP CONSTRAINT "PropertyImage_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "SecurityDepositPayment" DROP CONSTRAINT "SecurityDepositPayment_agreementId_fkey";

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "dissolutionNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dissolvedAt" TIMESTAMP(3),
ADD COLUMN     "dissolvedBy" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "isActive";

-- DropTable
DROP TABLE "Complaint";

-- DropTable
DROP TABLE "PropertyImage";

-- DropTable
DROP TABLE "SecurityDepositPayment";

-- DropEnum
DROP TYPE "ComplaintStatus";

-- DropEnum
DROP TYPE "ComplaintType";

-- DropEnum
DROP TYPE "DepositPaymentStatus";

-- CreateTable
CREATE TABLE "DissolutionRequest" (
    "id" TEXT NOT NULL,
    "status" "DissolutionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "proposedVacateDate" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerNote" TEXT NOT NULL DEFAULT '',
    "respondedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,

    CONSTRAINT "DissolutionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DissolutionRequest_agreementId_key" ON "DissolutionRequest"("agreementId");

-- AddForeignKey
ALTER TABLE "DissolutionRequest" ADD CONSTRAINT "DissolutionRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DissolutionRequest" ADD CONSTRAINT "DissolutionRequest_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
