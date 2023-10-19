import { Prisma } from "@prisma/client";
import {
  GetServerSideProps,
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import { useRouter } from "next/router";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { z } from "zod";
import { getMetricMetadata } from "~/lib/getMetricMetadata";
import { GraphLayout } from "~/pages/journal/[themeid]/graphs";
import { db } from "~/server/db";
import { Zoneless } from "~/lib/ZonelessDate";
import { Layout } from "~/components/Layout";
import { authorize } from "~/lib/authorize";
import { getServerAuthSession } from "~/server/auth";

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const auth = await authorize.metric(db, getServerAuthSession(context), {
    key: z
      .string()
      .parse(context.query.metric),
  });
  if (!auth.read) {
    return authorize.redirectToLogin;
  }
  return {
    props: {
      auth,
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
      metrics: await getMetricMetadata(auth.themeid),
    },
  };
};

// const data = [{name: 'Page A', uv: 400, pv: 2400, amt: 2400}, ];
export default function Page(
  props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  return (
    <Layout themeid={props.auth.themeid}>
      <GraphLayout metrics={props.metrics} hideOnSmall>
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
    </Layout>
  );
}
