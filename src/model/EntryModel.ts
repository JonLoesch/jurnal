import { Prisma } from "@prisma/client";
import { AuthorizedContext } from "./AuthorizedContext";
import { DeltaStatic } from "quill";

export class EntryModel {
  constructor(
    protected readonly context: AuthorizedContext<"theme">,
    protected readonly postid: number,
  ) {}

  async obj<Include extends Prisma.EntryInclude>(include: Include) {
    return this.context.prisma.entry.findUniqueOrThrow({
      where: { id: this.postid },
      include,
    });
  }

  next(self: Prisma.EntryGetPayload<{ select: { date: true; id: true } }>) {
    return this.context.prisma.entry.findFirst({
      where: {
        OR: [
          {
            date: {
              gt: self.date,
            },
          },
          {
            date: { gte: self.date },
            id: { gt: self.id },
          },
        ],
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
  }
  prev(self: Prisma.EntryGetPayload<{ select: { date: true; id: true } }>) {
    return this.context.prisma.entry.findFirst({
      where: {
        OR: [
          {
            date: {
              lt: self.date,
            },
          },
          {
            date: { lte: self.date },
            id: { lt: self.id },
          },
        ],
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
  }
  values() {
    return this.context.prisma.metric.findMany({
      orderBy: {
        sortOrder: "asc",
      },
      include: {
        values: {
          where: {
            entryId: this.postid,
          },
        },
      },
    });
  }
}

export class EntryModelWithWritePermissions extends EntryModel {
  async edit(input: {
    values: Record<string, number | null>,
    firstLine: string | null,
    postJson: DeltaStatic | null
  }) {
    await this.context.prisma.$transaction(async (db) => {
      for (const [key, value] of Object.entries(input.values)) {
        if (value === null) {
          await db.value.deleteMany({
            where: {
              // entryId_metricKey: {
              entryId: this.postid,
              metricKey: key,
              // },
            },
          });
        } else {
          await db.value.upsert({
            where: {
              entryId_metricKey: {
                entryId: this.postid,
                metricKey: key,
              },
            },
            create: { entryId: this.postid, metricKey: key, value },
            update: { value },
          });
        }
      }
      await db.entry.update({
        where: { id: this.postid },
        data: {
          postQuill: input.postJson ?? undefined,
          postText: input.firstLine,
        },
      });
    });
  }
}
