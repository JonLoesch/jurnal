import { Zoneless } from "~/lib/ZonelessDate";
import { AuthorizedContext } from "./AuthorizedContext";
import { JournalModel } from "./JournalModel";
import { Model } from "./Model";

export class MetricModel extends Model<['journal', 'metric']> {
  protected authChecks(): { scopes: readonly ["journal", "metric"]; read: true; write: boolean; } {
    return {
      scopes: ['journal', 'metric'],
      read: true,
      write: false,
    }
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
