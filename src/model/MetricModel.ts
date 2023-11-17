import { Zoneless } from "~/lib/ZonelessDate";
import { AuthorizedContext } from "./AuthorizedContext";
import { JournalModel } from "./JournalModel";
import { Model } from "./Model";
import { z } from "zod";
import { GenericMetricChange, metricSchemas } from "~/lib/metricSchemas";

export class MetricModel extends Model<["journal", "metric"]> {
  protected authChecks(): {
    scopes: readonly ["journal", "metric"];
    read: true;
    write: boolean;
  } {
    return {
      scopes: ["journal", "metric"],
      read: true,
      write: false,
    };
  }

  protected get metricId() {
    return this._auth.metric.id;
  }

  values() {
    return this.prisma.value
      .findMany({
        where: {
          metricId: this.metricId,
        },
        include: {
          post: true,
        },
        orderBy: {
          post: {
            date: "asc",
          },
        },
      })
      .then((result) =>
        result.map(({ post: { date, ...post }, ...rest }) => ({
          ...rest,
          post: { ...post, date: Zoneless.fromDate(date) },
        })),
      );
  }
}

export class MetricModeWithWritePermissions extends MetricModel {
  protected authChecks(): {
    scopes: readonly ["journal", "metric"];
    read: true;
    write: boolean;
  } {
    return {
      ...super.authChecks(),
      write: true,
    };
  }

  protected get metricType() {
    return this._auth.metric.metricType;
  }

  async editValue({
    postId,
    change,
  }: {
    postId: number;
    change: GenericMetricChange | null;
  }) {
    if (change === null) {
      await this.prisma.value.delete({
        where: {
          postId_metricId: {
            postId,
            metricId: this.metricId,
          },
        },
      });
    } else {
      await this.prisma.$transaction(async (db) => {
        const postId_metricId = {
          postId,
          metricId: this.metricId,
        };
        const existing = await db.value.findUnique({
          where: { postId_metricId },
        });
        const newValue = metricSchemas.updateMetricValue(
          this.metricType,
          existing?.metricValue ?? null,
          change,
        );
        if (newValue === null) {
          await db.value.delete({ where: { postId_metricId } });
        } else {
          await db.value.upsert({
            where: { postId_metricId },
            create: {
              metricValue: newValue,
              value: 0,
              ...postId_metricId,
            },
            update: {
              metricValue: newValue,
            },
          });
        }
      });
    }
    return { success: true };
  }
}
