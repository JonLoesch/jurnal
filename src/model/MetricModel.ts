import { Zoneless } from "~/lib/ZonelessDate";
import { AuthorizedContext } from "./AuthorizedContext";
import { ThemeModel } from "./ThemeModel";

export class MetricModel {
  constructor(
    private readonly context: AuthorizedContext<"theme">,
    private readonly metrickey: string,
  ) {}

  get theme() {
    return new ThemeModel(this.context);
  }

  values() {
    return this.context.prisma.value
      .findMany({
        where: {
          metricKey: this.metrickey,
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
