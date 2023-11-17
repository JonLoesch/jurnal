import { Prisma, PrismaClient } from "@prisma/client";
import { addDays, compareAsc, startOfToday, subDays } from "date-fns";
import { z } from "zod";
import { MetricSchema, metricSchemas } from "~/lib/metricSchemas";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const sampleData: Array<{
  metricGroupName: string;
  metricGroupDescription: string;
  metrics: Array<
    {
      name: string;
      description: string;
    } & z.infer<(typeof metricSchemas)["validateMetricSchemaAndValues"]>
  >;
}> = [
  {
    metricGroupName: "Morning",
    metricGroupDescription: "Morning Routine",
    metrics: [
      {
        name: "Planned Day",
        description:
          "Was able to sort through mail, calendar, todo lists, etc... and come up with some goals for the day",
        metricType: "checkbox",
        schema: {},
        values: [
          { value: false },
          { value: false },
          { value: false },
          null,
          null,
          null,
          { value: true },
          { value: true },
          { value: true },
        ],
      },
      {
        name: "Slow Morning",
        description: "Was able to relax in the morning and didn't have to rush",
        metricType: "zeroToTen",
        schema: {
          labels: [
            "0 - Nope",
            undefined,
            "2 - A tiny bit",
            undefined,
            "4 - A tiny bit more",
            undefined,
            undefined,
            undefined,
            "8 - Yeah",
            undefined,
            "10 - HELL Yeah",
          ],
        },
        values: [
          { value: 0 },
          { value: 2 },
          { value: 10 },
          null,
          null,
          null,
          { value: 8 },
          { value: 4 },
          { value: 10 },
        ],
      },
      {
        name: "Journal",
        description:
          "How did your morning go?  What are your plans for the day?",
        metricType: "richText",
        schema: {},
        values: [
          { ops: [{ insert: "Sample Text (1)" }] },
          { ops: [{ insert: "Sample Text (2)" }] },
          { ops: [{ insert: "Sample Text (3)" }] },
          null,
          null,
          null,
          { ops: [{ insert: "Sample Text (4)" }] },
          { ops: [{ insert: "Sample Text (5)" }] },
          { ops: [{ insert: "Sample Text (6)" }] },
        ],
      },
    ],
  },
  {
    metricGroupName: "Evening",
    metricGroupDescription: "Evening routine",
    metrics: [
      // TODO
    ],
  },
  {
    metricGroupName: "Weekly",
    metricGroupDescription: "Weekly checkup",
    metrics: [
      {
        name: "Weight",
        description: "Weekly weight measurement",
        metricType: "numeric",
        schema: {
          units: "lbs",
        },
        values: [
          { value: 280 },
          { value: 280 },
          { value: 280 },
          null,
          null,
          null,
          { value: 280 },
          { value: 280 },
          { value: 280 },
        ],
      },
    ],
  },
];

async function main() {
  const email = "jonloesch@gmail.com";
  const placeholderEmail = "placeholder@example.com";
  const me =
    (await prisma.user.findUnique({
      where: { email },
    })) ??
    (await prisma.user.upsert({
      where: {
        email: placeholderEmail,
      },
      create: {
        email: placeholderEmail,
      },
      update: {},
    }));
  await prisma.user.update({
    where: { id: me.id },
    data: {
      role: "journaler",
    },
  });
  const journal = await prisma.journal.upsert({
    where: { id: 1 },
    create: {
      isPublic: true,
      description:
        "This is the default DEV journal.  Created by the Prisma seed script",
      name: "Dev Jurnal",
      ownerId: me.id,
    },
    update: {
      ownerId: me.id,
    },
  });

  for (let dayIndex = 0; dayIndex < 10; dayIndex++) {
    const date = subDays(startOfToday(), 10 - dayIndex);
    const post =
      (await prisma.post.findFirst({
        where: { date },
      })) ??
      (await prisma.post.create({
        data: {
          date,
          journalId: journal.id,
        },
      }));

    for (const metricGroupData of sampleData.map((x, index) => ({
      ...x,
      index,
    }))) {
      const metricGroup =
        (await prisma.metricGroup.findFirst({
          where: {
            journalId: journal.id,
            name: metricGroupData.metricGroupName,
          },
        })) ??
        (await prisma.metricGroup.create({
          data: {
            name: metricGroupData.metricGroupName,
            journalId: journal.id,
            sortOrder: metricGroupData.index + 1,
            description: metricGroupData.metricGroupDescription,
          },
        }));

      for (const metricData of metricGroupData.metrics.map((x, index) => ({
        ...x,
        index,
      }))) {
        const metric =
          (await prisma.metric.findFirst({
            where: {
              metricGroupId: metricGroup.id,
              name: metricData.name,
            },
          })) ??
          (await prisma.metric.create({
            data: {
              id: uuidv4(),
              metricGroupId: metricGroup.id,
              name: metricData.name,
              description: metricData.description,
              type: "legacy_deprecated",
              metricSchema: {
                ...metricData.schema,
                metricType: metricData.metricType,
              } as MetricSchema,
              journalId: journal.id, // deprecated
              sortOrder: metricData.index + 1,
            },
          }));

        const metricValue = metricData.values[dayIndex] ?? null;
        if (metricValue !== null) {
          await prisma.value.upsert({
            where: {
              postId_metricId: {
                postId: post.id,
                metricId: metric.id,
              },
            },
            create: {
              postId: post.id,
              metricId: metric.id,
              value: 0, //deprecated
              metricValue,
            },
            update: {
              metricValue,
            },
          });
        }
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
