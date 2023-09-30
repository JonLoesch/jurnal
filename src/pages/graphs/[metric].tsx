import { Prisma } from "@prisma/client";
import {
  GetServerSideProps,
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import { useRouter } from "next/router";
import { CartesianGrid, Line, Tooltip, XAxis, YAxis } from "recharts";
import dynamic from "next/dynamic";

const LineChart = dynamic(() => import("recharts").then((x) => x.LineChart), {
  ssr: false,
});

import { z } from "zod";
import { getMetricMetadata } from "~/lib/getMetricMetadata";
import { GraphLayout } from "~/pages/graphs";
import { db } from "~/server/db";
import { Zoneless } from "~/lib/ZonelessDate";

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  return {
    props: {
      values: (
        await db.value.findMany({
          where: {
            metricKey: z.string().min(1).parse(context.query.metric),
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
      ).map(({ entry: { date, ...entry }, ...rest }) => ({
        ...rest,
        entry: { ...entry, date: Zoneless.fromDate(date) },
      })),
      metrics: await getMetricMetadata(),
    },
  };
};

// const data = [{name: 'Page A', uv: 400, pv: 2400, amt: 2400}, ];
export default function Page(
  props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  return (
    <GraphLayout metrics={props.metrics}>
      <LineChart
        width={400}
        height={400}
        data={props.values.map((v) => ({
          date: Zoneless.toDate(v.entry.date),
          zeroToTen: v.value,
        }))}
      >
        <Line type="monotone" dataKey="zeroToTen" stroke="#8884d8" />

        <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 10]} />
        <Tooltip />
      </LineChart>
    </GraphLayout>
  );
}
