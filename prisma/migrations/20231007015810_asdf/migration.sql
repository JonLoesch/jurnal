/*
  Warnings:

  - You are about to drop the column `userId` on the `Theme` table. All the data in the column will be lost.
  - Added the required column `ownerId` to the `Theme` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Theme" DROP CONSTRAINT "Theme_userId_fkey";

-- AlterTable
ALTER TABLE "Theme" DROP COLUMN "userId",
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
