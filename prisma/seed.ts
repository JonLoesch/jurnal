import { Prisma, PrismaClient } from "@prisma/client";
import { addDays, compareAsc, startOfToday, subDays } from "date-fns";

const prisma = new PrismaClient();

const data: Array<{
  date: Date;
  mood: number;
  sleep: number;
  eat: number;
  move: number;
  talk: number;
  made: number;
}> = [
  {
    date: subDays(startOfToday(), 5),
    mood: 9,
    sleep: 7,
    eat: 7,
    move: 8,
    talk: 10,
    made: 7,
  },
  {
    date: subDays(startOfToday(), 4),
    mood: 8,
    sleep: 5,
    eat: 5,
    move: 6,
    talk: 3,
    made: 10,
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
  const theme = await prisma.theme.upsert({
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

  for (
    let date = subDays(startOfToday(), 10);
    compareAsc(date, startOfToday()) < 0;
    date = addDays(date, 1)
  ) {
    const existing = await prisma.entry.findFirst({
      where: { date },
    });
    if (!existing) {
      await prisma.entry.create({
        data: {
          date,
          themeId: theme.id,
        },
      });
    }
  }

  const m = await metrics();
  for (const d of data) {
    const entry = await prisma.entry.findFirstOrThrow({
      where: { date: d.date },
    });
    await addValue(m.mood, d.mood);
    await addValue(m.sleep, d.sleep);
    await addValue(m.eat, d.eat);
    await addValue(m.move, d.move);
    await addValue(m.talk, d.talk);
    await addValue(m.made, d.made);
    async function addValue(
      metric: Prisma.MetricGetPayload<null>,
      value: number,
    ) {
      return prisma.value.upsert({
        where: {
          entryId_metricKey: {
            entryId: entry.id,
            metricKey: metric.key,
          },
        },
        create: {
          entryId: entry.id,
          metricKey: metric.key,
          value,
        },
        update: {
          value,
        },
      });
    }
  }

  async function metrics() {
    async function m(key: string, name: string, sortOrder: number) {
      return prisma.metric.upsert({
        where: { key },
        update: {
          type: "ZeroToTen",
        },
        create: {
          themeId: theme.id,
          type: "ZeroToTen",
          key,
          name,
          sortOrder,
        },
      });
    }
    return {
      mood: await m("mood", "General Mood", 1),
      sleep: await m("sleep", "Slept well", 2),
      eat: await m("eat", "Ate Well", 3),
      move: await m("move", "Excersized", 4),
      talk: await m("talk", "Socially Active", 5),
      made: await m("made", "Was Productive", 6),
    };
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
