-- Fixed migration: sirf wo cheezein jo abhi tak apply nahi hui hain

-- AlterTable — Agreement mein dissolution columns add karo
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "dissolutionNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "dissolvedAt" TIMESTAMP(3);
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "dissolvedBy" TEXT NOT NULL DEFAULT '';

-- CreateTable — DissolutionRequest (agar pehle se exist nahi karti)
CREATE TABLE IF NOT EXISTS "DissolutionRequest" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "DissolutionRequest_agreementId_key" ON "DissolutionRequest"("agreementId");

-- AddForeignKey (agar pehle se exist nahi karta)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DissolutionRequest_tenantId_fkey'
  ) THEN
    ALTER TABLE "DissolutionRequest" ADD CONSTRAINT "DissolutionRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DissolutionRequest_agreementId_fkey'
  ) THEN
    ALTER TABLE "DissolutionRequest" ADD CONSTRAINT "DissolutionRequest_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
