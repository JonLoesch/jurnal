import { useRouter } from "next/router";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { data } from "~/lib/fakeData";
import { GraphLayout } from "~/pages/graphs";


// const data = [{name: 'Page A', uv: 400, pv: 2400, amt: 2400}, ];
export default function Page() {
    const router = useRouter();
    const { metrics} = data;
    const metric = metrics.find(m => m.name === router.query.metric);
  return (
    <GraphLayout>
        {metric && 
      <LineChart width={400} height={400} data={metric.values().map(v => ({
        date: v.entry().date,
        zeroToTen: v.zeroToTen
      }))}>
        <Line type="monotone" dataKey="zeroToTen" stroke="#8884d8" />

        <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
            <XAxis dataKey="date" />
            <YAxis domain={[0,10]}/>
            <Tooltip/>
      </LineChart>
        }
    </GraphLayout>
  );
}
