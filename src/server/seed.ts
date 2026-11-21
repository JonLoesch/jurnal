import type { Db } from "@/db/client";
import type { FieldType, Schedule } from "@/db/schema";
import * as j from "./journal";
import { requireOwner } from "./gate";

type MetricDef = { name: string; type: FieldType; config?: Record<string, unknown> };
type SectionDef = { name: string; schedule: Schedule; metrics: MetricDef[] };
type JurnalDef = { name: string; sections: SectionDef[] };

const weekly: Schedule = { count: 1, period: "week" };
const daily: Schedule = { count: 1, period: "day" };
const sets = (name: string, config: Record<string, unknown> = {}): MetricDef => ({ name, type: "sets", config: { unit: "lb", targetSets: 3, ...config } });
const yes = (name: string): MetricDef => ({ name, type: "yesno" });
const notes: MetricDef = { name: "Notes", type: "richtext" };

/**
 * Jonathan's own jurnals: the structure he keeps, not demo data. Exercise names carry their place in
 * Briana's plan (Ex2.3 is circuit 2, exercise 3), since circuits aren't a thing in the app.
 */
export const MY_JURNALS: JurnalDef[] = [
  {
    name: "Fitness",
    sections: [
      {
        name: "Lower Body Workout",
        schedule: weekly,
        metrics: [
          sets("Ex1.1 Barbell Squat"),
          sets("Ex1.2 Trap Bar RDL"),
          sets("Ex1.3 Single Leg Glute Bridge"),
          sets("Ex1.4 Toe Raises", { targetReps: 20 }),
          sets("Ex2.1 1 Leg Step Up"),
          sets("Ex2.2 Hamstring Curl"),
          sets("Ex2.3 Stationary Lateral Lunge"),
          sets("Ex2.4 Toe Press", { targetReps: 20 }),
          sets("Ex3.1 Elevated Forearm Plank"), // reps are seconds held
          sets("Ex3.2 Oblique Lean"),
          notes,
        ],
      },
      { name: "Upper Body Workout", schedule: weekly, metrics: [notes] }, // exercises come with Briana's plan
      { name: "TBD Workout", schedule: weekly, metrics: [notes] },
      {
        name: "Activity",
        schedule: daily,
        metrics: [
          { name: "Diet", type: "log" },
          { name: "Other activity", type: "log" },
        ],
      },
    ],
  },
  {
    name: "Habits",
    sections: [
      {
        name: "Morning",
        schedule: daily,
        metrics: [yes("Stretched"), yes("Woke up at a reasonable time"), yes("Made a plan for the day"), yes("Got some early sun"), notes],
      },
      {
        name: "Evening",
        schedule: daily,
        metrics: [
          yes("Brushed my teeth"),
          yes("Got the things done I wanted to get done"),
          yes("Closed down my work at a reasonable time"),
          notes,
        ],
      },
    ],
  },
];

/** Create whatever of MY_JURNALS is missing for this account, matching by name. Safe to run again. */
export async function seedMyJurnals(db: Db, accountId: string, defs: JurnalDef[] = MY_JURNALS) {
  const created: string[] = [];
  for (const def of defs) {
    const existing = (await j.listMyJurnals(db, accountId)).find((x) => x.name === def.name);
    const jurnal = existing ?? (await j.createJurnal(db, accountId, def.name));
    if (!existing) created.push(def.name);
    for (const sdef of def.sections) {
      let { allSections, allMetrics } = await requireOwner(db, accountId, jurnal.id);
      let section = allSections.find((s) => !s.isDefault && s.name === sdef.name);
      if (!section) {
        section = await j.addSection(db, accountId, jurnal.id, sdef.name);
        await j.updateSection(db, accountId, section.id, { schedule: sdef.schedule });
        created.push(`${def.name} / ${sdef.name}`);
      }
      for (const mdef of sdef.metrics) {
        if (allMetrics.some((m) => m.sectionId === section!.id && m.name === mdef.name)) continue;
        await j.addMetric(db, accountId, section.id, { name: mdef.name, fieldType: mdef.type, config: mdef.config });
        created.push(`${def.name} / ${sdef.name} / ${mdef.name}`);
      }
      ({ allSections, allMetrics } = await requireOwner(db, accountId, jurnal.id));
    }
  }
  return created;
}
