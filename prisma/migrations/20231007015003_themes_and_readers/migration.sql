/*
  Warnings:

  - The primary key for the `Goal` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Goal` table. All the data in the column will be lost.
  - Made the column `themeId` on table `Goal` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metricKey` on table `Goal` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `description` to the `Theme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isPublic` to the `Theme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Theme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Theme` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_metricKey_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_themeId_fkey";

-- AlterTable
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_pkey",
DROP COLUMN "id",
ALTER COLUMN "themeId" SET NOT NULL,
ALTER COLUMN "metricKey" SET NOT NULL,
ADD CONSTRAINT "Goal_pkey" PRIMARY KEY ("themeId", "metricKey");

-- AlterTable
ALTER TABLE "Theme" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Reader" (
    "id" SERIAL NOT NULL,
    "themeId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "Reader_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_metricKey_fkey" FOREIGN KEY ("metricKey") REFERENCES "Metric"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reader" ADD CONSTRAINT "Reader_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
