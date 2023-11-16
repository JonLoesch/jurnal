import { Prisma } from "@prisma/client";
import {
  GetServerSideProps,
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { GraphLayout } from "~/pages/journal/[journalId]/graphs";
import { Zoneless } from "~/lib/ZonelessDate";
import { JournalScopeLayout } from "~/components/Layout";
import { withAuth } from "~/model/Authorization";
import { fromUrl } from "~/lib/urls";


export const getServerSideProps = withAuth(fromUrl.metricId, (auth, params) => auth.metric(params.metricId, async model => ({
  values: await model.values(),
  metrics: await model.journal.metrics(),
})));

// const data = [{name: 'Page A', uv: 400, pv: 2400, amt: 2400}, ];
export default function Page(
  props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  return (
    <JournalScopeLayout journalId={props._auth.journal.id}>
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
    </JournalScopeLayout>
  );
}
