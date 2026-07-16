-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContractStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "ContractStatus" ADD VALUE 'ON_HOLD';

-- AlterEnum
ALTER TYPE "ContractType" ADD VALUE 'LICENSING';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MUR',
ADD COLUMN     "noticePeriod" TEXT,
ADD COLUMN     "recipientTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "renewalFrequency" TEXT NOT NULL DEFAULT 'Yearly',
ADD COLUMN     "serviceDescription" TEXT;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "lastContact" TEXT,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
