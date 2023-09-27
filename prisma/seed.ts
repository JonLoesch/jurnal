import { Prisma, PrismaClient } from "@prisma/client";
import { addDays, compareAsc, startOfToday } from "date-fns";

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
    date: new Date("2023-09-23"),
    mood: 9,
    sleep: 7,
    eat: 7,
    move: 8,
    talk: 10,
    made: 7,
  },
  {
    date: new Date("2023-09-24"),
    mood: 8,
    sleep: 5,
    eat: 5,
    move: 6,
    talk: 3,
    made: 10,
  },
];

async function main() {
  for (
    let date = new Date("2023-09-15");
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
        },
      });
    }
  }

  const m = await metrics();
  for (const d of data) {
    console.log(d);
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
}

async function metrics() {
  async function m(key: string) {
    return prisma.metric.upsert({
      where: { key },
      update: {
        type: "ZeroToTen",
      },
      create: {
        type: "ZeroToTen",
        key,
      },
    });
  }
  return {
    mood: await m("mood"),
    sleep: await m("sleep"),
    eat: await m("eat"),
    move: await m("move"),
    talk: await m("talk"),
    made: await m("made"),
  };
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
