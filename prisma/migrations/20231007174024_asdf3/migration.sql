/*
  Warnings:

  - You are about to drop the `Goal` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `themeId` to the `Metric` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_metricKey_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_themeId_fkey";

-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "themeId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Goal";

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
