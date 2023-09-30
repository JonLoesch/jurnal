/*
  Warnings:

  - Added the required column `sortOrder` to the `Metric` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "sortOrder" INTEGER;
UPDATE "Metric" SET     "sortOrder" =0;
UPDATE "Metric" SET     "sortOrder" =1 WHERE "key" = 'mood';
UPDATE "Metric" SET     "sortOrder" =2 WHERE "key" = 'sleep';
UPDATE "Metric" SET     "sortOrder" =3 WHERE "key" = 'eat';
UPDATE "Metric" SET     "sortOrder" =4 WHERE "key" = 'move';
UPDATE "Metric" SET     "sortOrder" =5 WHERE "key" = 'talk';
UPDATE "Metric" SET     "sortOrder" =6 WHERE "key" = 'made';

-- AlterTable
ALTER TABLE "Metric" ALTER COLUMN     "sortOrder" SET NOT NULL;