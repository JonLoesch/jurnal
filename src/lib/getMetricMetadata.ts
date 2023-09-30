import { db } from "~/server/db";

export const getMetricMetadata = async () => {
  const result = await db.metric.findMany({
    include: {
      values: {
        orderBy: {
          entry: {
            date: 'desc',
          }
        },
        take: 1,
      },
    },
    orderBy: {
      sortOrder: 'asc'
    }
  });
  return result.map(({ values, ...rest }) => ({
    ...rest,
    latestValue: values[0]?.value,
  }));
};
