/*
  Warnings:

  - Added the required column `themeId` to the `Entry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "themeId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
