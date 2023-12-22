import { Prisma, PrismaClient } from "@prisma/client";
import { addDays, compareAsc, startOfToday, subDays } from "date-fns";
import { z } from "zod";
import {
  Metric,
  MetricSchema,
  MetricType,
  metricSchemas,
} from "~/lib/metricSchemas";
import { v4 as uuidv4 } from "uuid";
import { zeroToTen } from "~/components/metrics/zeroToTen";

const prisma = new PrismaClient();

const sampleValues: { [K in MetricType]: Metric<K>["value"][] } = {
  checkbox: [
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
  numeric: [
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
  zeroToTen: [
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
  richText: [
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
};

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
        name: "Planned the Day",
        description:
          "Was able to sort through mail, calendar, todo lists, etc... and come up with some goals for the day",
        metricType: "checkbox",
        schema: {},
        values: sampleValues.checkbox,
      },
      {
        name: "Enjoyed the Day",
        description: "Was able to relax in the morning and didn't have to rush",
        metricType: "zeroToTen",
        schema: {
          labels: [
            "0 - Nope",
            null,
            "2 - A tiny bit",
            null,
            "4 - A tiny bit more",
            null,
            null,
            null,
            "8 - Yeah",
            null,
            "10 - HELL Yeah",
          ],
        },
        values: sampleValues.zeroToTen,
      },
      {
        name: "Siezed the Day",
        description:
          "Started the day off right by getting some early basic physical activity in",
        metricType: "checkbox",
        schema: {},
        values: sampleValues.checkbox,
      },
      {
        name: "Goals",
        description:
          "How did your morning go?  What are your plans for the day?",
        metricType: "richText",
        schema: {},
        values: sampleValues.richText,
      },
    ],
  },
  {
    metricGroupName: "Evening",
    metricGroupDescription: "Evening routine",
    metrics: [
      {
        name: "Productive",
        description: "How much did you get done today?",
        metricType: "zeroToTen",
        schema: {
          labels: [
            "Absolutely nothing",
            null,
            "Technically a little bit",
            null,
            "A slow day",
            null,
            "A respectable amount",
            null,
            "An amount I'm proud of",
            null,
            "Best day ever",
          ],
        },
        values: sampleValues.zeroToTen,
      },
      {
        name: "Follow through",
        description:
          "Was what you got done the same thing as what you PLANNED to get done?",
        metricType: "checkbox",
        schema: {},
        values: sampleValues.checkbox,
      },
      {
        name: "Diet - no non-hungry eating",
        description:
          "Did you refrain from eating when you werent hungry?  (boredom, stress, etc...)",
        metricType: "checkbox",
        schema: {},
        values: sampleValues.checkbox,
      },
      {
        name: "Diet - no junk food",
        description: "Did you refrain from eating excessive junk food?",
        metricType: "checkbox",
        schema: {},
        values: sampleValues.checkbox,
      },
      {
        name: "Diet - nutrition",
        description:
          "Did you get enough fiber / vitamins?  (did you eat at least one fruit or vegetable)",
        metricType: "checkbox",
        schema: {},
        values: sampleValues.checkbox,
      },
      {
        name: "Exercised",
        description: "How much did you move today?",
        metricType: "zeroToTen",
        schema: {
          labels: [
            "Not at all",
            null,
            null,
            "I at least got outdoors",
            null,
            null,
            "Either a respectable amount of low-intensity, or at least one high-intensity thing",
            null,
            "A mix of low intensity and high intensity, got outdoors multiple times",
            null,
            "Enough to feel good and tired",
          ],
        },
        values: sampleValues.zeroToTen,
      },
      {
        name: "Mood",
        description: "What was your general mood like today?",
        metricType: "zeroToTen",
        schema: {
          labels: [
            "Terrible",
            null,
            null,
            "Bad",
            null,
            null,
            "Okay",
            null,
            "Good",
            null,
            "Excellent",
          ],
        },
        values: sampleValues.zeroToTen,
      },
      {
        name: "Journal",
        description: "How did your day go?",
        metricType: "richText",
        schema: {},
        values: sampleValues.richText,
      },
      {
        name: "Wind down",
        description: "Did you get the chance to relax in the evening?",
        metricType: "zeroToTen",
        schema: {
          labels: [
            "Nope",
            null,
            null,
            "I at least didn't go straight from a computer or TV to bed",
            null,
            null,
            "I feel like I've had a slow evening",
            null,
            null,
            null,
            "Spent the evening on the porch (or similar)",
          ],
        },
        values: sampleValues.zeroToTen,
      },
      {
        name: "Brush teeth",
        description: "Do it!",
        metricType: "checkbox",
        schema: {},
        values: sampleValues.checkbox,
      },
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
        values: sampleValues.numeric,
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

  const metricGroupIds: number[] = [];
  const metricIds: string[] = [];

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
      await prisma.metricGroup.update({
        where: { id: metricGroup.id },
        data: {
          sortOrder: metricGroupData.index + 1,
          description: metricGroupData.metricGroupDescription,
        },
      });
      metricGroupIds.push(metricGroup.id);

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
        console.log(metric.id, metricData.schema, metricData.metricType);
        await prisma.metric.update({
          where: { id: metric.id },
          data: {
            description: metricData.description,
            type: "legacy_deprecated",
            metricSchema: {
              ...metricData.schema,
              metricType: metricData.metricType,
            } as MetricSchema,
            journalId: journal.id, // deprecated
            sortOrder: metricData.index + 1,
          },
        });

        metricIds.push(metric.id);

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

  await prisma.value.deleteMany({
    where: {
      metricId: {
        notIn: metricIds,
      },
    },
  });
  await prisma.metric.deleteMany({
    where: {
      id: {
        notIn: metricIds
      }
    }
  });
  await prisma.metricGroup.deleteMany({
    where: {
      id: {
        notIn: metricGroupIds,
      },
    },
  });
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
