import { Prisma } from "@prisma/client";
import { AuthorizedContext } from "./AuthorizedContext";
import { DeltaStatic } from "quill";
import { AuthorizationError } from "./AuthorizationError";
import { JournalModel } from "./JournalModel";
import { Model } from "./Model";

export class PostModel  extends Model<['journal', 'post']> {
  protected authChecks(): { scopes: readonly ["journal", "post"]; read: true; write: boolean; } {
    return {
      scopes: ['journal', 'post'],
      read: true,
      write: false,
    }
  }

  protected get journalId() {
    return this._auth.journal.id;
  }
  protected get postId() {
    return this._auth.post.id;
  }

  async obj<Include extends Prisma.PostInclude>(include: Include) {
    return this.prisma.post.findUniqueOrThrow({
      where: { id: this.postId },
      include,
    });
  }

  next(self: Prisma.PostGetPayload<{ select: { date: true; id: true } }>) {
    return this.prisma.post.findFirst({
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
        journalId: this.journalId,
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
  }
  prev(self: Prisma.PostGetPayload<{ select: { date: true; id: true } }>) {
    return this.prisma.post.findFirst({
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
        journalId: this.journalId,
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
  }
  values() {
    return this.prisma.metric.findMany({
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

export class PostModelWithWritePermissions extends PostModel {
  protected authChecks(): { scopes: readonly ["journal", "post"]; read: true; write: boolean; } {
    return {
      ...super.authChecks(),
      write: true,
    }
  };

  async edit(input: {
    values: Record<string, number | null>,
    firstLine: string | null,
    postJson: DeltaStatic | null
  }) {
    await this.prisma.$transaction(async (db) => {
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
