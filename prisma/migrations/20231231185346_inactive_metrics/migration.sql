-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "MetricGroup" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
