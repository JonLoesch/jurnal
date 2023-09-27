import { db } from "~/server/db";

export const getMetricMetadata = async () => {
  const result = await db.metric.findMany({
    include: {
      values: {
        orderBy: {
          value: "desc",
        },
        take: 1,
      },
    },
  });
  return result.map(({ values, ...rest }) => ({
    ...rest,
    latestValue: values[0]?.value,
  }));
};
