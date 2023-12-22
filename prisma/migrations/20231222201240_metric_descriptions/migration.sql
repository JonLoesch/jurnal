/*
  Warnings:

  - Added the required column `description` to the `Metric` table without a default value. This is not possible if the table is not empty.
  - Made the column `metricGroupId` on table `Metric` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `description` to the `MetricGroup` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Metric" DROP CONSTRAINT "Metric_metricGroupId_fkey";

-- Manual fill:
update "Metric" set "description" = "name";

-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "description" TEXT NOT NULL,
ALTER COLUMN "metricGroupId" SET NOT NULL;

-- AlterTable
CREATE SEQUENCE metricgroup_id_seq;
ALTER TABLE "MetricGroup" ADD COLUMN     "description" TEXT NOT NULL,
ALTER COLUMN "id" SET DEFAULT nextval('metricgroup_id_seq');
ALTER SEQUENCE metricgroup_id_seq OWNED BY "MetricGroup"."id";


-- Manual fill:
insert into "MetricGroup" select nextval('metricgroup_id_seq') as id, 1 as "sortOrder", 'Assorted' as "name", "id" as "journalId", 'Metrics captured before we started fully organizing them' as "description" from "Theme";
update "Metric" SET "metricGroupId"="MetricGroup".id FROM "MetricGroup" WHERE "Metric"."themeId" = "MetricGroup"."journalId" AND "MetricGroup"."name" = 'Assorted';

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_metricGroupId_fkey" FOREIGN KEY ("metricGroupId") REFERENCES "MetricGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
