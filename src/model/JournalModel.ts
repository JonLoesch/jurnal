import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { AuthorizedContext } from "./AuthorizedContext";
import { Zoneless, ZonelessDate } from "~/lib/ZonelessDate";
import { DeltaStatic } from "quill";
import { AuthorizationError } from "./AuthorizationError";

export class JournalModel {
  constructor(protected readonly context: AuthorizedContext<"journal">) {}

  obj<Include extends Prisma.JournalInclude>(include: Include) {
    return this.context.prisma.journal.findUniqueOrThrow({
      where: { id: this.context.journal.id },
      include,
    });
  }

  metrics() {
    return db.metric
      .findMany({
        where: {
          themeId: this.context.journal.id,
        },
        include: {
          values: {
            orderBy: {
              entry: {
                date: "desc",
              },
            },
            take: 1,
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      })
      .then((result) =>
        result.map(({ values, ...rest }) => ({
          ...rest,
          latestValue: values[0]?.value,
        })),
      );
  }

  posts() {
    return db.post
      .findMany({
        orderBy: [{ date: "desc" }, { id: "desc" }],
        where: {
          journalId: this.context.journal.id,
        },
      })
      .then((result) =>
        result.map(({ date, ...rest }) => ({
          ...rest,
          date: Zoneless.fromDate(date),
        })),
      );
  }

  async subscribe(setSubscribe: boolean) {
    const userId = this.context.session?.user.id;
    if (userId == null) {
      throw new AuthorizationError();
    }
    const subscription = {
      themeId: this.context.journal.id,
      userId,
    };

    if (setSubscribe) {
      await db.themeSubscription.upsert({
        where: {
          themeId_userId: subscription,
        },
        create: subscription,
        update: {},
      });
    } else {
      await db.themeSubscription.delete({
        where: {
          themeId_userId: subscription,
        },
      });
    }
  }

}

export class ThemeModelWithWritePermissions extends JournalModel {
  async editJournal(description: string | null, quill: DeltaStatic | null) {
    await this.context.prisma.journal.update({
      where: { id: this.context.journal.id },
      data: {
        quill: quill ?? undefined,
        description: description ?? undefined,
      },
    });
  }

  async newPost(date: ZonelessDate) {
    return this.context.prisma.post.create({
      data: {
        journalId: this.context.journal.id,
        date: Zoneless.toDate(date),
      },
    })
  }
}