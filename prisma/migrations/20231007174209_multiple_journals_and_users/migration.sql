/*
  Warnings:

  - NA: You are about to drop the `Goal` table. If the table is not empty, all the data it contains will be lost.
  - FIXED: Added the required column `themeId` to the `Metric` table without a default value. This is not possible if the table is not empty.
  - FIXED: Added the required column `themeId` to the `Entry` table without a default value. This is not possible if the table is not empty.
  - NA: Added the required column `description` to the `Theme` table without a default value. This is not possible if the table is not empty.
  - NA: Added the required column `isPublic` to the `Theme` table without a default value. This is not possible if the table is not empty.
  - NA: Added the required column `name` to the `Theme` table without a default value. This is not possible if the table is not empty.
  - NA: Added the required column `ownerId` to the `Theme` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_metricKey_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_themeId_fkey";

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "themeId" INTEGER;

-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "themeId" INTEGER;

-- AlterTable
ALTER TABLE "Theme" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "ownerId" TEXT NOT NULL;

insert into "User" (id, email) values ('dev', 'dev@example.com');
insert into "Theme" (name, description, "ownerId", "isPublic") values ('', '', 'dev', true);

UPDATE "Entry" SET "themeId" = (select currval('"Theme_id_seq"'));
UPDATE "Metric" SET "themeId" = (select currval('"Theme_id_seq"'));
ALTER TABLE "Entry" ALTER COLUMN "themeId" SET NOT NULL;
ALTER TABLE "Metric" ALTER COLUMN "themeId" SET NOT NULL;

-- DropTable
DROP TABLE "Goal";

-- CreateTable
CREATE TABLE "Reader" (
    "id" SERIAL NOT NULL,
    "themeId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "Reader_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reader" ADD CONSTRAINT "Reader_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
