import type { metrics, sections } from "@/db/schema";

export type Metric = typeof metrics.$inferSelect;
export type Section = typeof sections.$inferSelect;

/**
 * The hidden default section is only worth showing while it is the jurnal's whole structure. Once other
 * sections exist and it holds no live metrics, it is just an empty "Entries" box, so leave it out.
 */
export function withoutEmptyDefault<S extends Pick<Section, "id" | "isDefault">>(
  all: S[],
  metrics: Pick<Metric, "sectionId" | "archivedAt">[],
): S[] {
  const others = all.some((s) => !s.isDefault);
  return all.filter((s) => !(s.isDefault && others && !metrics.some((m) => m.sectionId === s.id && !m.archivedAt)));
}
