import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { AuthorizedContext } from "./AuthorizedContext";
import { Zoneless, ZonelessDate } from "~/lib/ZonelessDate";
import { DeltaStatic } from "quill";
import { AuthorizationError } from "./AuthorizationError";
import { Model } from "./Model";

export class JournalModel extends Model<["journal"]> {
  protected authChecks(): {
    scopes: readonly ["journal"];
    read: true;
    write: boolean;
  } {
    return {
      scopes: ["journal"],
      read: true,
      write: false,
    };
  }

  protected get journalId() {
    return this._auth.journal.id;
  }

  obj<Include extends Prisma.JournalInclude>(include: Include) {
    return this.prisma.journal.findUniqueOrThrow({
      where: { id: this.journalId },
      include,
    });
  }

  metrics() {
    return db.metric
      .findMany({
        where: {
          journalId: this.journalId,
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
          journalId: this.journalId,
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
    const userId = this.session?.user.id;
    if (userId == null) {
      throw new AuthorizationError();
    }
    const subscription = {
      journalId: this.journalId,
      userId,
    };

    if (setSubscribe) {
      await db.themeSubscription.upsert({
        where: {
          journalId_userId: subscription,
        },
        create: subscription,
        update: {},
      });
    } else {
      await db.themeSubscription.delete({
        where: {
          journalId_userId: subscription,
        },
      });
    }
  }
}

export class JournalModelWithWritePermissions extends JournalModel {
  protected authChecks(): {
    scopes: readonly ["journal"];
    read: true;
    write: boolean;
  } {
    return {
      ...super.authChecks(),
      write: true,
    };
  }

  constructor(context: AuthorizedContext<["journal"]>) {
    super(context);
    if (!context._auth.journal.write) {
      throw new AuthorizationError();
    }
  }

  async editJournal(description: string | null, quill: DeltaStatic | null) {
    await this.prisma.journal.update({
      where: { id: this.journalId },
      data: {
        quill: quill ?? undefined,
        description: description ?? undefined,
      },
    });
  }

  async newPost(date: ZonelessDate) {
    return this.prisma.post.create({
      data: {
        journalId: this.journalId,
        date: Zoneless.toDate(date),
      },
    });
  }
}
