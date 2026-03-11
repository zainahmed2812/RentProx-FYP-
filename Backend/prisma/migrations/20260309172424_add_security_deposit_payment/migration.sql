-- CreateEnum
CREATE TYPE "SecurityDepositPaymentStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "SecurityDepositPayment" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "SecurityDepositPaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "rejectedReason" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "agreementId" TEXT NOT NULL,

    CONSTRAINT "SecurityDepositPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDepositPayment_agreementId_key" ON "SecurityDepositPayment"("agreementId");

-- AddForeignKey
ALTER TABLE "SecurityDepositPayment" ADD CONSTRAINT "SecurityDepositPayment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
