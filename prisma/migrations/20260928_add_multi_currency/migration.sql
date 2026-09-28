-- Add explicit EventFlow currencies and preserve existing BDT data.
CREATE TYPE "Currency" AS ENUM ('BDT', 'USD');

ALTER TABLE "Event"
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'BDT';

ALTER TABLE "Order"
ALTER COLUMN "currency" DROP DEFAULT,
ALTER COLUMN "currency" TYPE "Currency" USING ("currency"::"Currency"),
ALTER COLUMN "currency" SET DEFAULT 'BDT';

ALTER TABLE "Payment"
ALTER COLUMN "currency" DROP DEFAULT,
ALTER COLUMN "currency" TYPE "Currency" USING ("currency"::"Currency"),
ALTER COLUMN "currency" SET DEFAULT 'BDT';

ALTER TABLE "Refund"
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'BDT';

ALTER TABLE "Payout"
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'BDT';
