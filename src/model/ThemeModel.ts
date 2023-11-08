import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { AuthorizedContext } from "./AuthorizedContext";
import { Zoneless, ZonelessDate } from "~/lib/ZonelessDate";
import { DeltaStatic } from "quill";
import { AuthorizationError } from "./AuthorizationError";

export class ThemeModel {
  constructor(protected readonly context: AuthorizedContext<"theme">) {}

  obj<Include extends Prisma.ThemeInclude>(include: Include) {
    return this.context.prisma.theme.findUniqueOrThrow({
      where: { id: this.context.theme.id },
      include,
    });
  }

  metrics() {
    return db.metric
      .findMany({
        where: {
          themeId: this.context.theme.id,
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

  entries() {
    return db.entry
      .findMany({
        orderBy: [{ date: "desc" }, { id: "desc" }],
        where: {
          themeId: this.context.theme.id,
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
      themeId: this.context.theme.id,
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

export class ThemeModelWithWritePermissions extends ThemeModel {
  async editTheme(description: string | null, quill: DeltaStatic | null) {
    await this.context.prisma.theme.update({
      where: { id: this.context.theme.id },
      data: {
        quill: quill ?? undefined,
        description: description ?? undefined,
      },
    });
  }

  async newPost(date: ZonelessDate) {
    return this.context.prisma.entry.create({
      data: {
        themeId: this.context.theme.id,
        date: Zoneless.toDate(date),
      },
    })
  }
}