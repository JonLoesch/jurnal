import { Prisma } from "@prisma/client";
import { AuthorizedContext } from "./AuthorizedContext";
import { DeltaStatic } from "quill";

export class PostModel {
  constructor(
    protected readonly context: AuthorizedContext<"journal">,
    protected readonly postId: number,
  ) {}

  async obj<Include extends Prisma.PostInclude>(include: Include) {
    return this.context.prisma.post.findUniqueOrThrow({
      where: { id: this.postId },
      include,
    });
  }

  next(self: Prisma.PostGetPayload<{ select: { date: true; id: true } }>) {
    return this.context.prisma.post.findFirst({
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
  prev(self: Prisma.PostGetPayload<{ select: { date: true; id: true } }>) {
    return this.context.prisma.post.findFirst({
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
            entryId: this.postId,
          },
        },
      },
    });
  }
}

export class EntryModelWithWritePermissions extends PostModel {
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
              entryId: this.postId,
              metricId: key,
              // },
            },
          });
        } else {
          await db.value.upsert({
            where: {
              entryId_metricId: {
                entryId: this.postId,
                metricId: key,
              },
            },
            create: { entryId: this.postId, metricId: key, value },
            update: { value },
          });
        }
      }
      await db.post.update({
        where: { id: this.postId },
        data: {
          quillData: input.postJson ?? undefined,
          text: input.firstLine,
        },
      });
    });
  }
}
