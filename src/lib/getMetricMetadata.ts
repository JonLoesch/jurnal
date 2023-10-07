import { db } from "~/server/db";

export const getMetricMetadata = async (themeId: number) => {
  const result = await db.metric.findMany({
    where: {
      themeId,
    },
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
