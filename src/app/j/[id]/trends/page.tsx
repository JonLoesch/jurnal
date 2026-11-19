import Link from "next/link";
import { getDb } from "@/db/client";
import { currentAccountId } from "@/server/session";
import { loadForViewer } from "@/server/gate";
import { orNotFound } from "@/server/page";
import { getMetricSeries } from "@/server/journal";
import { LineChart, card, linkButton } from "../../../_components";
import { redirect } from "next/navigation";

const NUMERIC = ["number", "stars", "yesno", "duration", "timeofday", "sets"];

export default async function TrendsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = await currentAccountId();
  if (!accountId) redirect("/login");
  const db = getDb();
  const viewer = { accountId };
  const { jurnal, allMetrics, access } = await orNotFound(loadForViewer(db, id, viewer));
  const metrics = allMetrics.filter((m) => access.metricIds.has(m.id) && NUMERIC.includes(m.fieldType));
  const series = await Promise.all(metrics.map((m) => getMetricSeries(db, id, m.id, viewer)));
  return (
    <div className="space-y-6">
      <p><Link href={`/j/${id}`} className={linkButton}>← {jurnal.name}</Link></p>
      <h1 className="text-2xl font-semibold">Trends</h1>
      {series.length === 0 && <p className="text-sm text-neutral-500">Nothing to chart yet. Numbers, stars, yes/no, durations and exercise sets can be charted.</p>}
      {series.map(({ metric, points }) => (
        <section key={metric.id} className={card}>
          <h2 className="mb-2 font-semibold">
            {metric.name}{metric.archivedAt ? " (retired)" : ""}
            <span className="ml-2 text-xs font-normal text-neutral-500">
              {metric.fieldType === "sets" ? "top weight per entry" : metric.fieldType === "timeofday" ? "minutes after midnight" : metric.fieldType === "yesno" ? "1 = yes" : ""}
            </span>
          </h2>
          <LineChart points={points} unit={metric.config.unit as string | undefined} />
        </section>
      ))}
    </div>
  );
}
