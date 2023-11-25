import { Prisma, MetricGroup, Metric } from "@prisma/client";
import { AuthorizedContext } from "./AuthorizedContext";
import { DeltaStatic } from "quill";
import { AuthorizationError } from "./AuthorizationError";
import { JournalModel } from "./JournalModel";
import { Model } from "./Model";
import { MetricSchemaAndValue, metricSchemas } from "~/lib/metricSchemas";
import { z } from "zod";

export class PostModel extends Model<["journal", "post"]> {
  protected authChecks(): {
    scopes: readonly ["journal", "post"];
    read: true;
    write: boolean;
  } {
    return {
      scopes: ["journal", "post"],
      read: true,
      write: false,
    };
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
  metricValues() {
    return this.prisma.metric
      .findMany({
        where: {
          journalId: this.journalId,
        },
        orderBy: [
          {
            metricGroup: {
              sortOrder: "asc",
            },
          },
          {
            sortOrder: "asc",
          },
        ],
        include: {
          metricGroup: true,
          values: {
            where: {
              postId: this.postId,
            },
          },
        },
      })
      .then((r) =>
        r
          .map(({ values, metricSchema, ...metric }) => {
            const schemaAndValue = {
              metricType: metricSchema.metricType,
              value: values[0]?.metricValue ?? null,
              schema: metricSchema,
            } as MetricSchemaAndValue;
            return {
              ...metric,
              ...schemaAndValue,
            };
          })
          .reduce<
            Record<
              number,
              MetricGroup & {
                metrics: Array<
                  Omit<Metric, "values" | "metricSchema"> & MetricSchemaAndValue
                >;
              }
            >
          >(
            (acc, { metricGroup, ...metric }) => ({
              ...acc,
              [metricGroup.sortOrder]: {
                ...metricGroup,
                metrics: [
                  ...(acc[metricGroup.sortOrder]?.metrics ?? []),
                  metric,
                ],
              },
            }),
            {},
          ),
      );
  }
}

export class PostModelWithWritePermissions extends PostModel {
  protected authChecks(): {
    scopes: readonly ["journal", "post"];
    read: true;
    write: boolean;
  } {
    return {
      ...super.authChecks(),
      write: true,
    };
  }

  async edit(input: {
    firstLine: string | null;
    postJson: DeltaStatic | null;
  }) {
    await this.prisma.post.update({
      where: { id: this.postId },
      data: {
        quillData: input.postJson ?? undefined,
        text: input.firstLine,
      },
    });
  }
}
