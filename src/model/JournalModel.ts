import { Prisma, PrismaPromise } from "@prisma/client";
import { db } from "~/server/db";
import { AuthorizedContext } from "./AuthorizedContext";
import { Zoneless, ZonelessDate } from "~/lib/ZonelessDate";
import { DeltaStatic } from "quill";
import { AuthorizationError } from "./AuthorizationError";
import { Model } from "./Model";
import { z } from "zod";
import { metricSchemas } from "~/lib/metricSchemas";
import { v4 as uuidv4 } from "uuid";

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
              post: {
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

const validateMetric = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("update"),
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  z.object({
    operation: z.literal("create"),
    schema: metricSchemas.validateMetricSchema,
    name: z.string(),
    description: z.string(),
  }),
]);
const validateMetricGroup = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("update"),
    id: z.number(),
    metrics: validateMetric.array(),
    name: z.string(),
    description: z.string(),
  }),
  z.object({
    operation: z.literal("create"),
    metrics: validateMetric.array(),
    name: z.string(),
    description: z.string(),
  }),
]);

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

  public static validateMetricGroups = validateMetricGroup.array();
  async editJournal(
    description?: string,
    quill?: DeltaStatic,
    metricGroups?: Array<z.infer<typeof validateMetricGroup>>,
  ) {
    await this.prisma.$transaction(async () => {
      await this.prisma.journal.update({
        where: { id: this.journalId },
        data: {
          quill: quill,
          description: description,
        },
      });
      const updatedGroupIds: number[] = [];
      const updatedMetricIds: string[] = [];
      for (const [groupIndex, groupData] of metricGroups?.entries() ?? []) {
        const group =
          groupData.operation === "create"
            ? await this.prisma.metricGroup.create({
                data: {
                  name: groupData.name,
                  description: groupData.description,
                  sortOrder: groupIndex + 1,
                  journalId: this.journalId,
                },
              })
            : await this.prisma.metricGroup.update({
                where: {
                  id: groupData.id,
                  journalId: this.journalId,
                },
                data: {
                  name: groupData.name,
                  description: groupData.description,
                  sortOrder: groupIndex + 1,
                },
              });
        for (const [metricIndex, metricData] of groupData.metrics.entries()) {
          const metric = metricData.operation === 'create' ?
          await this.prisma.metric.create({
            data: {
              description: metricData.description,
              name: metricData.name,
              sortOrder: metricIndex + 1,
              journalId: this.journalId,
              metricGroupId: group.id,
              type: 'deprecated',
              metricSchema: metricData.schema,
              id: uuidv4(),
            }
          }) : await this.prisma.metric.update({
            where: {
              id: metricData.id,
              journalId: this.journalId,
            },
            data: {
              metricGroupId: group.id,
              description: metricData.description,
              name: metricData.name,
              sortOrder: metricIndex + 1,
            }
          });
          updatedMetricIds.push(metric.id);
        }
        updatedGroupIds.push(group.id);
      }
      await this.prisma.metricGroup.updateMany({
        data: {
          active: false,
        },
        where: {
          journalId: this.journalId,
          id: {
            notIn: updatedGroupIds,
          }
        }
      });
      await this.prisma.metric.updateMany({
        data: {
          active: false,
        },
        where: {
          journalId: this.journalId,
          id: {
            notIn: updatedMetricIds,
          }
        }
      });
    });
    //   ...(metricGroups?.reduce<PrismaPromise<unknown>[]>(
    //     (acc, group) => [
    //       ...acc,
    //       ...group.metrics.map((metric, metricIndex) =>
    //         this.prisma.metric.update({
    //           where: { id: metric.id },
    //           data: {
    //             metricGroupId: group.id,
    //             sortOrder: metricIndex + 1,
    //           },
    //         }),
    //       ),
    //     ],
    //     [],
    //   ) ?? []),
    //   ...(metricGroups?.map((group, groupIndex) =>
    //     this.prisma.metricGroup.update({
    //       where: { id: group.id },
    //       data: {
    //         sortOrder: groupIndex + 1,
    //       },
    //     }),
    //   ) ?? []),
    // ]);
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