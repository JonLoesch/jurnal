/*
  Warnings:

  - Added the required column `metricSchema` to the `Metric` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metricValue` to the `Value` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "metricGroupId" INTEGER,
ADD COLUMN     "metricSchema" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Value" ADD COLUMN     "metricValue" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "MetricGroup" (
    "id" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "journalId" INTEGER NOT NULL,

    CONSTRAINT "MetricGroup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_metricGroupId_fkey" FOREIGN KEY ("metricGroupId") REFERENCES "MetricGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricGroup" ADD CONSTRAINT "MetricGroup_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
