import { Zoneless } from "~/lib/ZonelessDate";
import { AuthorizedContext } from "./AuthorizedContext";
import { JournalModel } from "./JournalModel";

export class MetricModel {
  constructor(
    private readonly context: AuthorizedContext<"journal">,
    private readonly merticId: string,
  ) {}

  get journal() {
    return new JournalModel(this.context);
  }

  values() {
    return this.context.prisma.value
      .findMany({
        where: {
          metricId: this.merticId,
        },
        include: {
          entry: true,
        },
        orderBy: {
          entry: {
            date: "asc",
          },
        },
      })
      .then((result) =>
        result.map(({ entry: { date, ...entry }, ...rest }) => ({
          ...rest,
          entry: { ...entry, date: Zoneless.fromDate(date) },
        })),
      );
  }
}
